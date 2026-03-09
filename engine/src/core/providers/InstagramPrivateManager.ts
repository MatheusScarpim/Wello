import EventEmitter from 'events'
import {
  IgCheckpointError,
  IgLoginTwoFactorRequiredError,
} from 'instagram-private-api'
import {
  IgApiClientExt,
  withFbnsAndRealtime,
  GraphQLSubscriptions,
  SkywalkerSubscriptions,
} from 'instagram_mqtt'

import instagramPrivateInstanceRepository, {
  IgPrivateStatus,
  IInstagramPrivateInstance,
} from '../../api/repositories/InstagramPrivateInstanceRepository'
import type { IncomingMessage } from '../whatsapp/WhatsAppManager'

export interface IgInstanceInfo {
  id: string
  name: string
  sessionName: string
  username: string
  status: IgPrivateStatus
  profilePic?: string
  fullName?: string
  igUserId?: string
  botEnabled: boolean
  botId?: string | null
  departmentIds: string[]
  challengeType?: 'totp' | 'sms'
}

interface PendingTwoFactor {
  twoFactorIdentifier: string
  verificationMethod: string
  username: string
}

// Usamos 'any' porque withFbnsAndRealtime estende IgApiClient via mixin dinâmico
// adicionando realtime, fbns, importState, exportState ao objeto
interface InstanceData {
  ig: any
  status: IgPrivateStatus
  config: IInstagramPrivateInstance
  pendingTwoFactor?: PendingTwoFactor
  pendingCheckpoint?: boolean
  seenItemIds: Set<string>
  userThreadMap: Map<string, string> // userId → threadId
}

class InstagramPrivateManager extends EventEmitter {
  private static instance: InstagramPrivateManager
  private instances: Map<string, InstanceData> = new Map()

  private constructor() {
    super()
  }

  public static getInstance(): InstagramPrivateManager {
    if (!InstagramPrivateManager.instance) {
      InstagramPrivateManager.instance = new InstagramPrivateManager()
    }
    return InstagramPrivateManager.instance
  }

  /**
   * Cria um IgApiClient base (sem realtime)
   */
  private createBaseClient(username: string): IgApiClientExt {
    const ig = new IgApiClientExt()
    ;(ig.state as any).constants = {
      ...(ig.state as any).constants,
      APP_VERSION: '317.0.0.34.109',
      APP_VERSION_CODE: '562016793',
      BLOKS_VERSION_ID: 'dc8e498e9028b19b2c49b0c0b4e6f31df6cf66e972e34e4cf7c2996e315aa4d7',
    }
    ig.state.generateDevice(username)
    return ig
  }

  /**
   * Aplica o mixin de realtime/exportState após o login
   */
  private applyRealtimeMixin(ig: IgApiClientExt): any {
    return withFbnsAndRealtime(ig)
  }

  /**
   * Restaura sessões salvas no banco ao iniciar o sistema
   */
  public async initialize(): Promise<void> {
    const accounts = await instagramPrivateInstanceRepository.findAllActive()
    console.log(`📸 Inicializando ${accounts.length} conta(s) Instagram privado...`)

    for (const account of accounts) {
      try {
        if (account.sessionData) {
          await this.restoreSession(account.sessionName)
        }
      } catch (error) {
        console.error(`❌ Erro ao restaurar sessão Instagram ${account.name}:`, error)
        await instagramPrivateInstanceRepository.updateStatus(account.sessionName, 'disconnected')
      }
    }
  }

  /**
   * Restaura sessão a partir dos cookies salvos no banco
   */
  private async restoreSession(sessionName: string): Promise<void> {
    const config = await instagramPrivateInstanceRepository.findBySessionName(sessionName)
    if (!config?.sessionData) return

    console.log(`📸 [${config.name}] Restaurando sessão Instagram...`)

    const baseIg = this.createBaseClient(config.username)

    try {
      // Aplica o mixin ANTES de restaurar o state, para registrar os hooks de FBNS
      const ig = this.applyRealtimeMixin(baseIg)

      // importState aceita string ou objeto — sessionData pode estar em ambos formatos
      await ig.importState(config.sessionData)

      const instanceData: InstanceData = {
        ig,
        status: 'connecting',
        config,
        seenItemIds: new Set(),
        userThreadMap: new Map(),
      }
      this.instances.set(sessionName, instanceData)

      await instagramPrivateInstanceRepository.updateStatus(sessionName, 'connecting')

      await this.startRealtime(sessionName)

      console.log(`✅ [${config.name}] Sessão Instagram restaurada com sucesso`)
    } catch (error) {
      console.error(`❌ [${config.name}] Falha ao restaurar sessão Instagram:`, error)
      this.instances.delete(sessionName)
      await instagramPrivateInstanceRepository.updateStatus(sessionName, 'disconnected')
    }
  }

  /**
   * Inicia login de uma conta com username e password
   */
  public async connectAccount(sessionName: string): Promise<{
    status: IgPrivateStatus
    challengeType?: 'totp' | 'sms'
    error?: string
  }> {
    const config = await instagramPrivateInstanceRepository.findBySessionName(sessionName)
    if (!config) throw new Error(`Conta ${sessionName} não encontrada`)

    console.log(`📸 [${config.name}] Conectando conta Instagram: ${config.username}`)

    await instagramPrivateInstanceRepository.updateStatus(sessionName, 'connecting')

    // Usa cliente base para login (sem mixin de realtime)
    const baseIg = this.createBaseClient(config.username)

    const instanceData: InstanceData = {
      ig: baseIg,
      status: 'connecting',
      config,
      seenItemIds: new Set(),
        userThreadMap: new Map(),
    }
    this.instances.set(sessionName, instanceData)

    try {
      // preLoginFlow é opcional — simula o app real, mas pode falhar com checkpoint
      try { await baseIg.simulate.preLoginFlow() } catch (_) {}

      const loggedUser = await baseIg.account.login(config.username, config.password)

      // postLoginFlow também é opcional
      try { await baseIg.simulate.postLoginFlow() } catch (_) {}

      // Após login bem-sucedido, aplica mixin de realtime
      const ig = this.applyRealtimeMixin(baseIg)
      instanceData.ig = ig
      instanceData.config = { ...config, igUserId: String(loggedUser.pk) }

      await this.persistSession(sessionName, ig, {
        igUserId: String(loggedUser.pk),
        profilePic: loggedUser.profile_pic_url,
        fullName: loggedUser.full_name,
      })

      await this.startRealtime(sessionName)

      return { status: 'connected' }
    } catch (err: any) {
      if (err instanceof IgLoginTwoFactorRequiredError) {
        return await this.handleTwoFactorRequired(sessionName, err, instanceData)
      }

      if (err instanceof IgCheckpointError) {
        return await this.handleCheckpointRequired(sessionName, instanceData)
      }

      // Checkpoint pode vir como erro genérico com 'checkpoint_required' no body
      if (err?.message?.includes('checkpoint_required') || err?.response?.body?.checkpoint_url) {
        baseIg.state.checkpoint = err?.response?.body
        return await this.handleCheckpointRequired(sessionName, instanceData)
      }

      console.error(`❌ [${config.name}] Erro ao conectar:`, err.message)
      instanceData.status = 'error'
      await instagramPrivateInstanceRepository.updateStatus(sessionName, 'error')
      this.instances.delete(sessionName)
      return { status: 'error', error: err.message }
    }
  }

  private async handleTwoFactorRequired(
    sessionName: string,
    err: IgLoginTwoFactorRequiredError,
    instanceData: InstanceData,
  ): Promise<{ status: IgPrivateStatus; challengeType: 'totp' | 'sms' }> {
    const info = (err.response.body as any).two_factor_info
    const isTOTP = !!info?.totp_two_factor_on
    const challengeType: 'totp' | 'sms' = isTOTP ? 'totp' : 'sms'

    instanceData.pendingTwoFactor = {
      twoFactorIdentifier: info?.two_factor_identifier || '',
      verificationMethod: isTOTP ? '0' : '1',
      username: instanceData.config.username,
    }
    instanceData.status = 'challenge'

    await instagramPrivateInstanceRepository.updateStatus(sessionName, 'challenge', {
      challengeType,
    })

    this.emit('challenge', { sessionName, challengeType })
    console.log(`🔐 [${instanceData.config.name}] 2FA exigido (${challengeType})`)

    return { status: 'challenge', challengeType }
  }

  private async handleCheckpointRequired(
    sessionName: string,
    instanceData: InstanceData,
  ): Promise<{ status: IgPrivateStatus; challengeType: 'sms' }> {
    try {
      await instanceData.ig.challenge.auto(true)
      instanceData.pendingCheckpoint = true
      instanceData.status = 'challenge'

      await instagramPrivateInstanceRepository.updateStatus(sessionName, 'challenge', {
        challengeType: 'sms',
      })

      this.emit('challenge', { sessionName, challengeType: 'sms' })
      console.log(`🔐 [${instanceData.config.name}] Checkpoint exigido (SMS/email)`)
    } catch (e) {
      console.error(`❌ Erro ao processar checkpoint:`, e)
    }

    return { status: 'challenge', challengeType: 'sms' }
  }

  /**
   * Completa o fluxo de 2FA/challenge com o código recebido
   */
  public async handleChallenge(sessionName: string, code: string): Promise<IgPrivateStatus> {
    const data = this.instances.get(sessionName)
    if (!data) throw new Error(`Sessão ${sessionName} não encontrada`)

    try {
      if (data.pendingTwoFactor) {
        const loggedUser = await data.ig.account.twoFactorLogin({
          username: data.pendingTwoFactor.username,
          verificationCode: code.trim(),
          twoFactorIdentifier: data.pendingTwoFactor.twoFactorIdentifier,
          verificationMethod: data.pendingTwoFactor.verificationMethod,
          trustThisDevice: '1',
        })

        // Aplica mixin de realtime após 2FA bem-sucedido
        const ig = this.applyRealtimeMixin(data.ig)
        data.ig = ig
        data.pendingTwoFactor = undefined
        data.config = { ...data.config, igUserId: String(loggedUser.pk) }

        await this.persistSession(sessionName, ig, {
          igUserId: String(loggedUser.pk),
          profilePic: loggedUser.profile_pic_url,
          fullName: loggedUser.full_name,
        })
      } else if (data.pendingCheckpoint) {
        await data.ig.challenge.sendSecurityCode(code.trim())
        data.pendingCheckpoint = false
        // Aplica mixin de realtime após checkpoint bem-sucedido
        const ig = this.applyRealtimeMixin(data.ig)
        data.ig = ig
        await this.persistSession(sessionName, ig)
      } else {
        throw new Error('Nenhum challenge pendente para esta sessão')
      }

      await this.startRealtime(sessionName)
      return 'connected'
    } catch (err: any) {
      console.error(`❌ Erro ao completar challenge:`, err.message)
      await instagramPrivateInstanceRepository.updateStatus(sessionName, 'error')
      data.status = 'error'
      throw err
    }
  }

  /**
   * Obtém o userId da sessão (do cookie ou do config salvo)
   */
  private getUserId(data: InstanceData): string {
    try {
      return data.ig.state.cookieUserId
    } catch (_) {
      return data.config.igUserId || ''
    }
  }

  /**
   * Inicia a conexão MQTT real-time para receber DMs
   */
  private async startRealtime(sessionName: string): Promise<void> {
    const data = this.instances.get(sessionName)
    if (!data) return

    const { config, ig } = data

    // Marca como conectado ANTES de tentar MQTT — o login já deu certo
    data.status = 'connected'
    this.instances.set(sessionName, data)
    await instagramPrivateInstanceRepository.updateStatus(sessionName, 'connected')
    this.emit('connected', { sessionName })

    const userId = this.getUserId(data)
    if (!userId) {
      console.warn(`⚠️ [${config.name}] userId não encontrado — MQTT não será iniciado`)
      return
    }

    try {
      // Verifica se o mixin de realtime está disponível
      if (!ig.realtime) {
        console.warn(`⚠️ [${config.name}] Realtime não disponível — apenas envio de mensagens`)
        return
      }

      // Para realtime anterior se houver
      if (ig.realtime?.mqtt?.connected) {
        try { await ig.realtime.disconnect() } catch (_) {}
      }

      ig.realtime.on('message', async (data: any) => {
        console.log(`📩 [${config.name}] DM recebida (message event):`, JSON.stringify(data).substring(0, 300))
        try {
          await this.processRealtimeMessage(sessionName, 'message', data)
        } catch (e) {
          console.error(`❌ [${config.name}] Erro ao processar msg realtime:`, e)
        }
      })

      ig.realtime.on('direct', async (data: any) => {
        console.log(`📩 [${config.name}] DM recebida (direct event):`, JSON.stringify(data).substring(0, 300))
        try {
          await this.processDirectEvent(sessionName, data)
        } catch (e) {
          console.error(`❌ [${config.name}] Erro ao processar direct event:`, e)
        }
      })

      // Log de todos os eventos recebidos para debug
      ig.realtime.on('receive', (_topic: any, messages: any) => {
        const msgList = Array.isArray(messages) ? messages : [messages]
        for (const m of msgList) {
          console.log(`📡 [${config.name}] receive event:`, JSON.stringify(m?.data || m).substring(0, 300))
        }
      })

      ig.realtime.on('error', (err: any) => {
        console.error(`❌ [${config.name}] Realtime erro:`, err?.message)
      })

      ig.realtime.on('disconnect', () => {
        console.log(`🔌 [${config.name}] Realtime desconectado`)
      })

      ig.fbns?.on('push', (notification: any) => {
        console.log(`📨 [${config.name}] FBNS push:`, notification?.collapseKey)
      })

      // Busca seq_id do inbox — necessário para iris (recebimento de DMs)
      let irisData: any = undefined
      try {
        irisData = await ig.feed.directInbox().request()
        console.log(`📡 [${config.name}] Inbox OK (seq_id: ${irisData?.seq_id})`)
      } catch (inboxErr: any) {
        console.warn(`⚠️ [${config.name}] Inbox falhou (${inboxErr?.response?.statusCode || inboxErr.message})`)
        // Tenta com versão 222 temporariamente
        const saved = { ...(ig.state as any).constants }
        try {
          ;(ig.state as any).constants = {
            ...saved,
            APP_VERSION: '222.0.0.13.114',
            APP_VERSION_CODE: '350696709',
          }
          irisData = await ig.feed.directInbox().request()
          console.log(`📡 [${config.name}] Inbox OK com v222 (seq_id: ${irisData?.seq_id})`)
        } catch (e: any) {
          console.warn(`⚠️ [${config.name}] Inbox v222 também falhou (${e?.response?.statusCode || e.message})`)
        } finally {
          ;(ig.state as any).constants = saved
        }
      }

      await ig.realtime.connect({
        graphQlSubs: [
          GraphQLSubscriptions.getAppPresenceSubscription(),
          GraphQLSubscriptions.getDirectStatusSubscription(),
          GraphQLSubscriptions.getDirectTypingSubscription(userId),
        ],
        skywalkerSubs: [
          SkywalkerSubscriptions.directSub(userId),
          SkywalkerSubscriptions.liveSub(userId),
        ],
        ...(irisData ? { irisData } : {}),
        connectOverrides: {},
      })

      console.log(`✅ [${config.name}] MQTT conectado — aguardando DMs`)
    } catch (err: any) {
      // MQTT falhou mas a conta continua conectada (envio funciona, recebimento não)
      console.warn(`⚠️ [${config.name}] MQTT falhou (${err.message}) — envio funciona, recebimento de DMs indisponível`)
    }
  }

  /**
   * Processa eventos 'direct' (via GraphQL/Skywalker — não depende do iris)
   */
  private async processDirectEvent(sessionName: string, data: any): Promise<void> {
    const instance = this.instances.get(sessionName)
    if (!instance) return

    // Formato: { op: 'add', path: '/direct_v2/threads/...', value: { item_id, ... } }
    if (data?.op !== 'add' || !data?.path?.includes('/direct_v2/threads/')) return

    const value = data.value
    if (!value?.item_id) return

    if (instance.seenItemIds.has(value.item_id)) return
    instance.seenItemIds.add(value.item_id)

    const myUserId = instance.ig.state.cookieUserId
    if (String(value.user_id) === String(myUserId)) return

    // Extrai thread_id do path
    const threadMatch = data.path.match(/\/direct_v2\/threads\/(\d+)/)
    if (threadMatch && value.user_id) {
      instance.userThreadMap.set(String(value.user_id), threadMatch[1])
    }

    const incoming = this.normalizeRealtimeItem(value, sessionName, instance.config.name)
    if (!incoming) return

    this.emit('message', {
      sessionName,
      instanceName: instance.config.name,
      message: incoming,
    })
  }

  /**
   * Processa mensagens recebidas via MQTT/realtime (evento 'message' do iris)
   */
  private async processRealtimeMessage(
    sessionName: string,
    _topic: string,
    data: any,
  ): Promise<void> {
    const instance = this.instances.get(sessionName)
    if (!instance) return

    const msg = data?.message
    if (!msg) return

    // Filtra DMs — aceita tanto formato antigo (op='add') quanto novo (delta_type)
    const isNewMessage = msg.op === 'add' || data.delta_type === 'deltaNewMessage'
    if (!isNewMessage || !msg.path?.includes('/direct_v2/threads/')) return
    if (!msg.item_id) return

    // Evita processar a mesma mensagem duas vezes
    if (instance.seenItemIds.has(msg.item_id)) return
    instance.seenItemIds.add(msg.item_id)

    // Ignora mensagens enviadas pela própria conta
    const myUserId = instance.ig.state.cookieUserId
    if (String(msg.user_id) === String(myUserId)) return

    // Mapeia userId → threadId para usar no envio de respostas
    if (msg.thread_id && msg.user_id) {
      instance.userThreadMap.set(String(msg.user_id), String(msg.thread_id))
    }

    console.log(`📨 [${instance.config.name}] DM processada: type=${msg.item_type}, user=${msg.user_id}, thread=${msg.thread_id}`)

    const incoming = this.normalizeRealtimeItem(msg, sessionName, instance.config.name)
    if (!incoming) return

    this.emit('message', {
      sessionName,
      instanceName: instance.config.name,
      message: incoming,
    })
  }

  private normalizeRealtimeItem(
    item: any,
    sessionName: string,
    instanceName: string,
  ): IncomingMessage | null {
    try {
      const senderId = String(item.user_id)
      const itemId = String(item.item_id)
      const itemType: string = item.item_type || 'unknown'

      let text = ''
      let type: string = 'text'
      let mediaUrl: string | undefined

      switch (itemType) {
        case 'text':
          text = item.text || ''
          type = 'text'
          break
        case 'media':
          text = ''
          type = item.media?.media_type === 2 ? 'video' : 'image'
          mediaUrl =
            item.media?.image_versions2?.candidates?.[0]?.url ||
            item.media?.video_versions?.[0]?.url
          break
        case 'voice_media':
          text = ''
          type = 'audio'
          mediaUrl = item.voice_media?.media?.audio?.audio_src
          console.log(`🎤 voice_media structure:`, JSON.stringify(item.voice_media).substring(0, 500))
          break
        case 'animated_media':
          text = ''
          type = 'image'
          mediaUrl = item.animated_media?.images?.fixed_height?.url
          break
        default:
          return null
      }

      return {
        identifier: senderId,
        message: text,
        idMessage: itemId,
        name: senderId,
        provider: 'instagram_private',
        identifierProvider: sessionName,
        type,
        mediaUrl,
        _sessionName: sessionName,
        _instanceName: instanceName,
      } as IncomingMessage
    } catch {
      return null
    }
  }

  /**
   * Envia mensagem de texto para um usuário
   */
  public async sendText(
    sessionName: string,
    userId: string,
    text: string,
  ): Promise<{ idMessage: string }> {
    const data = this.instances.get(sessionName)
    if (!data?.ig) throw new Error(`Instância ${sessionName} não conectada`)

    // Envia via MQTT se temos threadId, senão fallback HTTP
    const threadId = data.userThreadMap.get(userId)
    if (threadId && data.ig.realtime?.direct) {
      await data.ig.realtime.direct.sendText({ threadId, text })
      return { idMessage: `mqtt_${Date.now()}` }
    }

    const threadResult = await data.ig.direct.createGroupThread([parseInt(userId, 10)])
    const result = await data.ig.entity.directThread(threadResult.thread_id).broadcastText(text)
    return { idMessage: result?.payload?.item_id || '' }
  }

  /**
   * Envia mídia (link de imagem/vídeo) para um usuário via DM
   */
  public async sendMedia(
    sessionName: string,
    userId: string,
    mediaUrl: string,
    _type: 'image' | 'video',
  ): Promise<{ idMessage: string }> {
    const data = this.instances.get(sessionName)
    if (!data?.ig) throw new Error(`Instância ${sessionName} não conectada`)

    const threadId = data.userThreadMap.get(userId)
    if (threadId && data.ig.realtime?.direct) {
      await data.ig.realtime.direct.sendText({ threadId, text: mediaUrl })
      return { idMessage: `mqtt_${Date.now()}` }
    }

    const threadResult = await data.ig.direct.createGroupThread([parseInt(userId, 10)])
    const result = await data.ig.entity.directThread(threadResult.thread_id).broadcastLink(mediaUrl, [mediaUrl])
    return { idMessage: result?.payload?.item_id || '' }
  }

  /**
   * Desconecta uma conta do Instagram
   */
  public async disconnectAccount(sessionName: string): Promise<void> {
    const data = this.instances.get(sessionName)

    if (data?.ig?.realtime?.mqtt?.connected) {
      try {
        await data.ig.realtime.disconnect()
      } catch (_) {}
    }

    this.instances.delete(sessionName)
    await instagramPrivateInstanceRepository.updateStatus(sessionName, 'disconnected')
    this.emit('disconnected', { sessionName })
    console.log(`🔌 Conta Instagram ${sessionName} desconectada`)
  }

  /**
   * Remove uma conta completamente
   */
  public async deleteAccount(id: string): Promise<boolean> {
    const instance = await instagramPrivateInstanceRepository.findById(id)
    if (instance) {
      await this.disconnectAccount(instance.sessionName)
    }
    return instagramPrivateInstanceRepository.deleteInstance(id)
  }

  /**
   * Lista todas as contas com status atual
   */
  public async listInstances(): Promise<IgInstanceInfo[]> {
    const dbInstances = await instagramPrivateInstanceRepository.findAll()

    return dbInstances.map((inst) => {
      const data = this.instances.get(inst.sessionName)
      return {
        id: inst._id!.toString(),
        name: inst.name,
        sessionName: inst.sessionName,
        username: inst.username,
        status: data?.status ?? inst.status,
        profilePic: inst.profilePic,
        fullName: inst.fullName,
        igUserId: inst.igUserId,
        botEnabled: inst.botEnabled,
        botId: inst.botId,
        departmentIds: inst.departmentIds,
        challengeType: inst.challengeType,
      }
    })
  }

  public async getInstanceInfo(sessionName: string): Promise<IgInstanceInfo | null> {
    const inst = await instagramPrivateInstanceRepository.findBySessionName(sessionName)
    if (!inst) return null

    const data = this.instances.get(sessionName)
    return {
      id: inst._id!.toString(),
      name: inst.name,
      sessionName: inst.sessionName,
      username: inst.username,
      status: data?.status ?? inst.status,
      profilePic: inst.profilePic,
      fullName: inst.fullName,
      igUserId: inst.igUserId,
      botEnabled: inst.botEnabled,
      botId: inst.botId,
      departmentIds: inst.departmentIds,
      challengeType: inst.challengeType,
    }
  }

  private async persistSession(
    sessionName: string,
    ig: any,
    extra?: Partial<IInstagramPrivateInstance>,
  ): Promise<void> {
    try {
      // exportState (do IgApiClientExt) já retorna uma string JSON
      const sessionData = typeof ig.exportState === 'function'
        ? await ig.exportState()
        : JSON.stringify(await ig.state.serialize())
      await instagramPrivateInstanceRepository.updateSessionData(sessionName, sessionData)
      if (extra) {
        await instagramPrivateInstanceRepository.updateStatus(sessionName, 'connected', extra)
      }
    } catch (err) {
      console.warn(`⚠️ Falha ao salvar sessão Instagram:`, err)
    }
  }
}

export default InstagramPrivateManager.getInstance()
