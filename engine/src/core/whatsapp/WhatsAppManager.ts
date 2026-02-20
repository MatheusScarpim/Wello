import type { tokenStore } from '@wppconnect-team/wppconnect'
import * as wpp from '@wppconnect-team/wppconnect'
import EventEmitter from 'events'
import util from 'util'

import whatsappSessionRepository from '../../api/repositories/WhatsAppSessionRepository'
import MediaProcessor from '../helpers/MediaProcessor'
import { prepareLocalMediaPayload } from '../helpers/WhatsAppMediaHelper'
import sessionTokenStore from './SessionTokenStore'

/**
 * Configuração do WhatsApp
 */
export interface WhatsAppConfig {
  sessionName: string
  headless?: boolean
  debug?: boolean
  logQR?: boolean
  autoClose?: number
  tokenStore?: 'file' | 'memory' | tokenStore.TokenStore
  folderNameToken?: string
}

/**
 * Mensagem recebida processada
 */
export interface IncomingMessage {
  identifier: string
  message: string
  idMessage: string
  quotedMsg?: string
  name: string
  provider: string
  identifierProvider?: string
  type: string
  photo?: string
  mediaUrl?: string
  mediaStorage?: {
    provider: 'azure_blob'
    blobName: string
    container: string
    size: number
  }
  _sessionName?: string
  _instanceName?: string
}

/**
 * Gerenciador do WhatsApp usando WPPConnect
 * Implementa padrão Singleton
 */
class WhatsAppManager extends EventEmitter {
  private static instance: WhatsAppManager
  private client: wpp.Whatsapp | null = null
  private config: WhatsAppConfig
  private isConnecting: boolean = false
  private connectionAttempts: number = 0
  private maxReconnectAttempts: number = 5
  private wasConnected: boolean = false // Rastreia se já esteve conectado
  private currentQrCode: string | null = null // Armazena QR Code atual
  private qrCodeTimestamp: number = 0 // Timestamp do QR Code

  private constructor() {
    super()
    this.config = {
      sessionName: process.env.BOT_NAME || 'nxzap-session',
      headless: true,
      debug: false,
      logQR: true,
      autoClose: 1000000,
      tokenStore: sessionTokenStore,
      folderNameToken: './tokens',
    }
  }

  /**
   * Retorna a instância única do WhatsAppManager
   */
  public static getInstance(): WhatsAppManager {
    if (!WhatsAppManager.instance) {
      WhatsAppManager.instance = new WhatsAppManager()
    }
    return WhatsAppManager.instance
  }

  /**
   * Conecta ao WhatsApp
   */
  public async connect(customConfig?: Partial<WhatsAppConfig>): Promise<void> {
    if (this.client) {
      console.log('✅ Cliente WhatsApp já está conectado')
      return
    }

    if (this.isConnecting) {
      console.log('⏳ Conexão já está em andamento...')
      // Aguarda a conexão em andamento terminar (timeout de 30 segundos)
      const maxWaitTime = 30000
      const startTime = Date.now()
      while (this.isConnecting && Date.now() - startTime < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      // Se conectou com sucesso durante a espera
      if (this.client) {
        console.log('✅ Cliente WhatsApp conectado durante a espera')
        return
      }

      // Se ainda está tentando conectar, retorna erro
      if (this.isConnecting) {
        throw new Error('Timeout ao aguardar conexão em andamento')
      }

      // Se não conectou, tenta novamente
      console.log('⚠️  Tentativa anterior falhou, tentando novamente...')
    }

    if (process.env.NXZAP_WPP === 'false') {
      console.log('⚠️  WhatsApp desabilitado via variável de ambiente')
      return
    }

    this.isConnecting = true

    try {
      // Mescla configurações
      if (customConfig) {
        this.config = { ...this.config, ...customConfig }
      }

      const activeTokenStore = this.config.tokenStore ?? sessionTokenStore

      console.log('🔄 Conectando ao WhatsApp...')

      this.client = await wpp.create({
        session: this.config.sessionName,
        headless: this.config.headless,
        devtools: false,
        debug: this.config.debug,
        logQR: this.config.logQR,
        browserWS: '',
        disableWelcome: false,
        updatesLog: true,
        autoClose: this.config.autoClose,
        waitForLogin: false,
        tokenStore: activeTokenStore,
        folderNameToken: this.config.folderNameToken,
        puppeteerOptions: {
          protocolTimeout: 300000,
        },
        browserArgs: [
          '--no-sandbox',
          '--aggressive-cache-discard',
          '--disable-cache',
          '--disable-application-cache',
          '--disable-offline-load-stale-cache',
          '--disk-cache-size=0',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-sync',
          '--disable-translate',
          '--hide-scrollbars',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-first-run',
          '--safebrowsing-disable-auto-update',
          '--ignore-certificate-errors',
          '--ignore-ssl-errors',
          '--ignore-certificate-errors-spki-list',
        ],
        catchQR: (base64Qr, asciiQR, attempt) => {
          console.log(`📱 QR Code gerado (tentativa ${attempt})`)
          this.currentQrCode = base64Qr
          this.qrCodeTimestamp = Date.now()
          this.emit('qrcode', base64Qr)
        },
        statusFind: (statusSession, session) => {
          console.log(`📊 Status da sessão: ${statusSession}`)
          if (statusSession === 'isLogged' || statusSession === 'inChat') {
            this.currentQrCode = null // Limpa QR quando conectado
          }
        },
      })

      this.setupEventHandlers()
      this.connectionAttempts = 0
      console.log('✅ Conectado ao WhatsApp com sucesso')
      // NÃO emite 'connected' aqui - será emitido quando estado for CONNECTED
      // this.emit('connected')
    } catch (error: any) {
      console.error('❌ Erro ao conectar ao WhatsApp:', error)

      // Tratamento especial para erro de navegador já em execução
      if (
        error.message &&
        error.message.includes('The browser is already running')
      ) {
        console.error(
          '⚠️  Navegador já está em execução. Aguardando limpeza automática...',
        )
        this.client = null
      }

      this.handleConnectionError(error)
      throw error
    } finally {
      this.isConnecting = false
    }
  }

  /**
   * Configura os handlers de eventos do WhatsApp
   */
  private setupEventHandlers(): void {
    if (!this.client) return

    // Mudança de estado
    this.client.onStateChange(async (state) => {
      console.log(`📱 Estado do WhatsApp alterado: ${state}`)
      this.emit('stateChange', state)

      switch (state) {
        case 'CONNECTED':
          console.log('✅ WhatsApp conectado')
          this.wasConnected = true
          this.connectionAttempts = 0 // Reseta contador de tentativas
          try {
            const hostDevice = await client.getHostDevice()
            await this.persistSessionInfo(hostDevice)
          } catch (error) {
            console.warn('⚠️ Falha ao persistir sessão do WhatsApp:', error)
          }
          this.emit('connected') // Emite evento de conexão bem-sucedida
          break
        case 'UNPAIRED':
          console.log('⚠️  WhatsApp desconectado')
          // Só trata como desconexão se já estava conectado antes
          // UNPAIRED durante inicialização é normal (aguardando QR scan)
          if (this.wasConnected) {
            this.handleDisconnection()
          }
          break
        case 'CONFLICT':
          console.log('⚠️  Conflito detectado - Múltiplas sessões')
          break
        case 'UNLAUNCHED':
          console.log('⚠️  WhatsApp não iniciado')
          break
      }
    })

    // Recebimento de mensagens
    this.client.onMessage(async (message) => {
      try {
        console.log('📥 Mensagem recebida bruta:', {
          from: message.from,
          type: message.type,
          isGroup: message.isGroupMsg,
          hasMedia: Boolean(message.isMedia),
        })
        console.log(
          '[WPPConnect Raw Full]',
          util.inspect(message, { depth: 4, colors: false }),
        )

        // Filtros de mensagens inválidas
        if (this.shouldIgnoreMessage(message)) {
          return
        }

        const processedMessage = await this.processIncomingMessage(message)
        this.emit('message', processedMessage)
      } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error)
      }
    })
  }

  /**
   * Verifica se a mensagem deve ser ignorada
   */
  private async persistSessionInfo(hostDevice?: any): Promise<void> {
    if (!this.client) return

    try {
      const device = hostDevice || (await this.client.getHostDevice())
      const phoneNumber =
        (device as any)?.wid?.user || (device as any)?.phone?.device

      console.log(
        `💾 [${this.config.sessionName}] persistSessionInfo (phone=${phoneNumber})`,
      )
      if (typeof this.client.getSessionTokenBrowser === 'function') {
        const token = await this.client.getSessionTokenBrowser(true)
        console.log(
          `💾 [${this.config.sessionName}] getSessionTokenBrowser result: ${token ? 'token' : 'none'}`,
        )
        if (token) {
          await whatsappSessionRepository.upsertToken(
            this.config.sessionName,
            token,
            phoneNumber,
          )
          return
        }
      }

      if (phoneNumber) {
        await whatsappSessionRepository.updatePhoneNumber(
          this.config.sessionName,
          phoneNumber,
        )
      }
    } catch (error) {
      console.warn('Falha ao persistir sessão do WhatsApp:', error)
    }
  }

  private shouldIgnoreMessage(message: any): boolean {
    const ignoreTypes = [
      'gp2',
      'ciphertext',
      'e2e_notification',
      'notification',
      'notification_template',
      'protocol',
      'broadcast_notification',
      'group_notification',
    ]

    return (
      message.isGroupMsg ||
      message.from === 'status@broadcast' ||
      ignoreTypes.includes(message.type)
    )
  }

  /**
   * Processa uma mensagem recebida
   */
  private async processIncomingMessage(message: any): Promise<IncomingMessage> {
    const messageType = await this.getMessageType(message)
    const resolvedFrom = await this.resolveFromIdentifier(message.from)
    const identifier = this.normalizePhoneNumber(
      resolvedFrom.replace('@c.us', ''),
    )

    // Processa mídia se for mensagem de mídia
    let mediaData = null
    if (MediaProcessor.isMediaType(message.type)) {
      mediaData = await MediaProcessor.processWhatsAppMedia(message)
    }

    return {
      identifier,
      message: messageType.message,
      idMessage: messageType.idMessage,
      quotedMsg: messageType.quotedMsg,
      name: message.notifyName,
      provider: 'whatsapp',
      identifierProvider: messageType.identifierProvider,
      type: messageType.type,
      photo: await this.getProfilePicture(resolvedFrom),
      mediaUrl: mediaData?.mediaUrl,
      mediaStorage: mediaData?.mediaStorage,
    }
  }

  private async resolveFromIdentifier(rawFrom: string): Promise<string> {
    if (!rawFrom.endsWith('@lid')) {
      return rawFrom
    }

    if (!this.client || !(this.client as any).getPnLidEntry) {
      return rawFrom
    }

    try {
      const mapping = await (this.client as any).getPnLidEntry(rawFrom)
      const phoneSerialized = mapping?.phoneNumber?._serialized
      if (phoneSerialized) {
        return phoneSerialized
      }
    } catch (error) {
      console.warn('⚠️ Falha ao mapear LID para telefone:', error)
    }

    return rawFrom
  }

  /**
   * Extrai informações do tipo de mensagem
   * Suporta respostas de listas e botões interativos
   */
  private async getMessageType(message: any): Promise<any> {
    const result = {
      message: '',
      type: message.type,
      idMessage: message.id,
      quotedMsg: undefined as string | undefined,
      identifierProvider: message.from,
    }

    switch (message.type) {
      case 'chat':
        result.message = message.body
        break

      // Resposta de lista interativa
      case 'list_response':
        if (message.listResponse && message.listResponse.singleSelectReply) {
          result.message = message.listResponse.singleSelectReply.selectedRowId
          result.type = 'interactive'
        } else {
          result.message = message.body || ''
        }
        break

      // Resposta de botão interativo
      case 'buttons_response':
        if (message.selectedButtonId) {
          result.message = message.selectedButtonId
          result.type = 'interactive'
        } else {
          result.message = message.body || ''
        }
        break

      case 'image':
      case 'video':
      case 'audio':
      case 'ptt':
      case 'document':
        result.message = message.caption || ''
        break

      default:
        result.message = message.body || ''
    }

    if (message.quotedMsg) {
      result.quotedMsg = message.quotedMsg.id
    }

    return result
  }

  /**
   * Normaliza número de telefone (adiciona 9 se necessário)
   */
  private normalizePhoneNumber(phone: string): string {
    // Remove caracteres especiais
    const cleaned = phone.replace(/\D/g, '')

    // Se for Brasil (55) e tiver 12 dígitos sem o 9, adiciona
    if (cleaned.startsWith('55') && cleaned.length === 12) {
      return `55${cleaned.charAt(2)}9${cleaned.substring(3)}`
    }

    return cleaned
  }

  /**
   * Constrói o identificador completo do WhatsApp (JID)
   */
  private formatRecipient(to: string): string {
    const normalized = this.normalizePhoneNumber(to)
    return `${normalized}@c.us`
  }

  /**
   * Obtém foto de perfil em base64
   */
  private async getProfilePicture(
    contactId: string,
  ): Promise<string | undefined> {
    try {
      if (!this.client) return undefined
      const profilePic = await this.client.getProfilePicFromServer(contactId)
      return profilePic || undefined
    } catch (error) {
      return undefined
    }
  }

  /**
   * Envia uma mensagem de texto
   */
  public async sendTextMessage(
    to: string,
    message: string,
    quotedMsgId?: string,
  ): Promise<any> {
    if (!this.client) {
      throw new Error('Cliente WhatsApp não está conectado')
    }

    const formattedNumber = this.formatRecipient(to)

    // Se tiver quotedMsgId, usa reply para citar a mensagem
    if (quotedMsgId) {
      return await this.client.reply(formattedNumber, message, quotedMsgId)
    }

    return await this.client.sendText(formattedNumber, message)
  }

  /**
   * Envia uma imagem
   */
  public async sendImage(
    to: string,
    pathOrBase64: string,
    filename?: string,
    caption?: string,
  ): Promise<any> {
    if (!this.client) {
      throw new Error('Cliente WhatsApp não está conectado')
    }

    const formattedNumber = this.formatRecipient(to)
    console.log('[WhatsAppManager] sendImage', {
      to: formattedNumber,
      filename: filename || 'image',
      hasBase64Prefix: pathOrBase64.startsWith('data:'),
      size: pathOrBase64.length,
    })
    const targetFilename = filename || 'image'
    const mediaFile = await prepareLocalMediaPayload(
      pathOrBase64,
      targetFilename,
    )
    try {
      return await this.client.sendImage(
        formattedNumber,
        mediaFile.path,
        targetFilename,
        caption,
      )
    } finally {
      await mediaFile.cleanup()
    }
  }

  /**
   * Envia um arquivo
   */
  public async sendFile(
    to: string,
    pathOrBase64: string,
    filename: string,
    caption?: string,
  ): Promise<any> {
    if (!this.client) {
      throw new Error('Cliente WhatsApp não está conectado')
    }

    const formattedNumber = this.formatRecipient(to)
    const mediaFile = await prepareLocalMediaPayload(pathOrBase64, filename)
    try {
      return await this.client.sendFile(
        formattedNumber,
        mediaFile.path,
        filename,
        caption,
      )
    } finally {
      await mediaFile.cleanup()
    }
  }

  /**
   * Envia um audio como mensagem de voz (PTT)
   */
  public async sendPtt(
    to: string,
    pathOrBase64: string,
    filename: string,
    caption?: string,
  ): Promise<any> {
    if (!this.client) {
      throw new Error('Cliente WhatsApp não está conectado')
    }

    const formattedNumber = this.formatRecipient(to)
    const mediaFile = await prepareLocalMediaPayload(pathOrBase64, filename)
    // Garante que o filename tenha extensão .ogg (formato final após conversão)
    const oggFilename = filename.replace(/\.(webm|mp4|m4a|mp3|wav|aac)$/i, '.ogg')
    try {
      return await this.client.sendPtt(
        formattedNumber,
        mediaFile.path,
        oggFilename,
        caption,
      )
    } finally {
      await mediaFile.cleanup()
    }
  }

  /**
   * Envia uma lista interativa
   */
  public async sendList(
    to: string,
    title: string,
    description: string,
    buttonText: string,
    sections: Array<{
      title: string
      rows: Array<{
        rowId: string
        title: string
        description?: string
      }>
    }>,
  ): Promise<any> {
    if (!this.client) {
      throw new Error('Cliente WhatsApp não está conectado')
    }

    const formattedNumber = this.formatRecipient(to)
    return await this.client.sendListMessage(formattedNumber, {
      buttonText,
      description,
      sections,
      title,
    })
  }

  /**
   * Envia botões interativos
   */
  public async sendButtons(
    to: string,
    title: string,
    description: string,
    buttons: Array<{
      id: string
      text: string
    }>,
    footer?: string,
  ): Promise<any> {
    if (!this.client) {
      throw new Error('Cliente WhatsApp não está conectado')
    }

    const formattedNumber = this.formatRecipient(to)
    return await this.client.sendButtons(
      formattedNumber,
      title,
      buttons,
      description,
      footer,
    )
  }

  /**
   * Envia localização
   */
  public async sendLocation(
    to: string,
    latitude: number,
    longitude: number,
    title?: string,
    address?: string,
  ): Promise<any> {
    if (!this.client) {
      throw new Error('Cliente WhatsApp não está conectado')
    }

    const formattedNumber = this.formatRecipient(to)
    return await this.client.sendLocation(
      formattedNumber,
      latitude,
      longitude,
      title,
      address,
    )
  }

  /**
   * Envia contato
   */
  public async sendContact(to: string, contactId: string): Promise<any> {
    if (!this.client) {
      throw new Error('Cliente WhatsApp não está conectado')
    }

    const formattedNumber = this.formatRecipient(to)
    return await this.client.sendContactVcard(formattedNumber, contactId)
  }

  /**
   * Retorna o cliente WhatsApp
   */
  public getClient(): wpp.Whatsapp {
    if (!this.client) {
      throw new Error('Cliente WhatsApp não está conectado')
    }
    return this.client
  }

  /**
   * Verifica se está conectado
   */
  public isConnected(): boolean {
    return this.client !== null
  }

  /**
   * Retorna o QR Code atual
   */
  public getQrCode(): string | null {
    // QR Code expira após 60 segundos
    if (this.currentQrCode && Date.now() - this.qrCodeTimestamp > 60000) {
      this.currentQrCode = null
    }
    return this.currentQrCode
  }

  /**
   * Retorna o status completo da conexão
   */
  public async getStatus(): Promise<{
    connected: boolean
    authenticated: boolean
    qrCode: string | null
    phoneNumber?: string
    name?: string
    platform?: string
  }> {
    const status = {
      connected: this.client !== null,
      authenticated: this.wasConnected,
      qrCode: this.getQrCode(),
      phoneNumber: undefined as string | undefined,
      name: undefined as string | undefined,
      platform: 'whatsapp' as string | undefined,
    }

    if (this.client && this.wasConnected) {
      try {
        const hostDevice = await this.client.getHostDevice()
        if (hostDevice) {
          status.phoneNumber =
            (hostDevice as any).wid?.user || (hostDevice as any).phone?.device
          status.name = (hostDevice as any).pushname
        }
      } catch (error) {
        console.error('Erro ao obter informações do dispositivo:', error)
      }
    }

    return status
  }

  /**
   * Trata desconexão
   */
  private async handleDisconnection(): Promise<void> {
    this.client = null
    this.emit('disconnected')

    if (this.connectionAttempts < this.maxReconnectAttempts) {
      this.connectionAttempts++
      console.log(
        `🔄 Tentando reconectar (${this.connectionAttempts}/${this.maxReconnectAttempts})...`,
      )

      // Aguarda um pouco antes de tentar reconectar (backoff exponencial)
      const waitTime = Math.min(
        1000 * Math.pow(2, this.connectionAttempts - 1),
        30000,
      )
      console.log(
        `⏳ Aguardando ${waitTime / 1000}s antes de tentar reconectar...`,
      )
      await new Promise((resolve) => setTimeout(resolve, waitTime))

      try {
        await this.connect()
      } catch (error) {
        console.error('❌ Erro ao tentar reconectar:', error)
      }
    } else {
      console.error('❌ Número máximo de tentativas de reconexão atingido')
    }
  }

  /**
   * Trata erros de conexão
   */
  private handleConnectionError(error: any): void {
    this.emit('error', error)
  }

  /**
   * Desconecta do WhatsApp
   */
  public async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close()
        this.client = null
        this.wasConnected = false
        console.log('🔌 Desconectado do WhatsApp')
        this.emit('disconnected')
      } catch (error) {
        console.error('❌ Erro ao desconectar:', error)
      }
    }
  }
}

export default WhatsAppManager.getInstance()
