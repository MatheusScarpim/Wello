import axios from 'axios'

import whatsappInstanceRepository from '@/api/repositories/WhatsAppInstanceRepository'
import InstagramManager from '../providers/InstagramManager'
import MetaManager from '../providers/MetaManager'
import { prepareLocalMediaPayload } from '../helpers/WhatsAppMediaHelper'
import WhatsAppManager from '../whatsapp/WhatsAppManager'
import WhatsAppMultiManager from '../whatsapp/WhatsAppMultiManager'

/**
 * Interface para envio de mensagem
 */
export interface SendMessageParams {
  to: string
  provider: 'whatsapp' | 'meta_whatsapp' | 'meta' | 'instagram' | 'telegram' // Provider determina qual serviço usar
  message?: string
  type?:
    | 'text'
    | 'image'
    | 'document'
    | 'audio'
    | 'video'
    | 'list'
    | 'buttons'
    | 'location'
    | 'contact'
    | 'sticker'
    | 'sticker_gif'
    | 'poll'
  mediaUrl?: string
  mediaBase64?: string
  caption?: string
  filename?: string
  quotedMessageId?: string
  mediaStorage?: {
    provider: 'azure_blob' | 'local'
    blobName?: string
    container?: string
    size?: number
    originalUrl?: string
  }
  // Para listas
  listTitle?: string
  listDescription?: string
  listButtonText?: string
  listSections?: Array<{
    title: string
    rows: Array<{
      rowId: string
      title: string
      description?: string
    }>
  }>
  // Para botões
  buttonsTitle?: string
  buttonsDescription?: string
  buttons?: Array<{
    id: string
    text: string
  }>
  buttonsFooter?: string
  // Para localização
  latitude?: number
  longitude?: number
  locationTitle?: string
  locationAddress?: string
  // Para contato
  contactId?: string
  operatorName?: string
  // Credenciais Meta (quando vier via request)
  metaAccessToken?: string
  metaPhoneNumberId?: string
  metaApiVersion?: string
  metaBaseUrl?: string
  // Credenciais Instagram Direct (quando vier via request)
  instagramAccessToken?: string
  instagramAccountId?: string
  instagramApiVersion?: string
  instagramBaseUrl?: string
  // Instância específica do WhatsApp (multi-instance)
  sessionName?: string
}

/**
 * Resultado do envio
 */
export interface SendMessageResult {
  success: boolean
  messageId?: string
  mediaId?: string
  error?: string
  provider: string
}

/**
 * Serviço unificado de mensagens
 * Detecta o provider e usa o serviço correto
 */
export class MessagingService {
  private static instance: MessagingService
  private isReconnecting: boolean = false

  private constructor() {}

  public static getInstance(): MessagingService {
    if (!MessagingService.instance) {
      MessagingService.instance = new MessagingService()
    }
    return MessagingService.instance
  }

  /**
   * Envia mensagem usando o provider correto
   */
  public async sendMessage(
    params: SendMessageParams,
  ): Promise<SendMessageResult> {
    const normalizedProvider =
      params.provider === 'meta' ? 'meta_whatsapp' : params.provider

    try {
      if (normalizedProvider === 'whatsapp' && params.sessionName) {
        const instance = await whatsappInstanceRepository.findBySessionName(
          params.sessionName,
        )
        const shouldRouteToMeta =
          instance?.connectionType === 'meta_official' &&
          !!instance.metaConfig?.enabled

        if (shouldRouteToMeta) {
          return await this.sendViaMeta({
            ...params,
            provider: 'meta_whatsapp',
          })
        }
      }

      switch (normalizedProvider) {
        case 'whatsapp':
          return await this.sendViaWppConnect(params)

        case 'meta_whatsapp':
          return await this.sendViaMeta(params)

        case 'instagram':
          return await this.sendViaInstagram(params)

        case 'telegram':
          return await this.sendViaTelegram(params)

        default:
          return {
            success: false,
            error: `Provider ${normalizedProvider} não suportado`,
            provider: normalizedProvider,
          }
      }
    } catch (error: any) {
      console.error(`❌ Erro ao enviar mensagem via ${normalizedProvider}:`, error)
      return {
        success: false,
        error: error.message || 'Erro desconhecido',
        provider: normalizedProvider,
      }
    }
  }

  /**
   * Envia via WPPConnect
   */
  private async sendViaWppConnect(
    params: SendMessageParams,
  ): Promise<SendMessageResult> {
    const {
      to,
      message,
      type = 'text',
      mediaUrl,
      mediaBase64,
      caption,
      filename,
      quotedMessageId,
      listTitle,
      listDescription,
      listButtonText,
      listSections,
      buttonsTitle,
      buttonsDescription,
      buttons,
      buttonsFooter,
      latitude,
      longitude,
      locationTitle,
      locationAddress,
      contactId,
      sessionName,
    } = params

    // Log breve de payload de mídia (sem expor base64 completo)
    if (type !== 'text') {
      const effectiveHasMedia = Boolean(mediaBase64) || Boolean(mediaUrl)
      const mediaSource = mediaBase64
        ? 'mediaBase64'
        : mediaUrl?.startsWith('data:')
          ? 'mediaUrl(data-uri)'
          : mediaUrl
            ? 'mediaUrl(http)'
            : 'nenhum'
      console.log('[MessagingService] Envio WPP', {
        to,
        type,
        mediaSource,
        hasMedia: effectiveHasMedia,
        mediaPreview: (mediaBase64 || mediaUrl || '').substring(0, 80),
        filename,
        caption: caption || message,
        sessionName: sessionName || 'default',
      })
      if (!mediaBase64 && mediaUrl?.startsWith('data:')) {
        console.warn(
          '[MessagingService] ⚠️ data URI veio em mediaUrl ao inves de mediaBase64 — prepareMediaPayload trata corretamente',
        )
      }
    }

    // Tenta usar a instância específica se sessionName foi fornecido
    let multiClient: any = null
    if (sessionName) {
      multiClient = WhatsAppMultiManager.getClient(sessionName)
      if (!multiClient) {
        console.warn(
          `⚠️ Instância ${sessionName} não encontrada, usando default`,
        )
        multiClient = await WhatsAppMultiManager.getDefaultClient()
      }
    } else {
      multiClient = await WhatsAppMultiManager.getDefaultClient()
    }

    if (multiClient) {
      return await this.sendViaWppMultiInstance(params, multiClient)
    }

    const connectionStatus = await this.ensureWhatsAppConnection()
    if (!connectionStatus.ok) {
      return {
        success: false,
        error: connectionStatus.error || 'WhatsApp não está conectado.',
        provider: 'whatsapp',
      }
    }

    const executeSend = async () => {
      let result: any

      switch (type) {
        case 'text':
          if (!message) {
            throw new Error('Mensagem de texto é obrigatória')
          }
          result = await WhatsAppManager.sendTextMessage(
            to,
            message,
            quotedMessageId,
          )
          break

        case 'list':
          if (
            !listTitle ||
            !listDescription ||
            !listButtonText ||
            !listSections
          ) {
            throw new Error(
              'Título, descrição, texto do botão e seções são obrigatórios para listas',
            )
          }
          result = await WhatsAppManager.sendList(
            to,
            listTitle,
            listDescription,
            listButtonText,
            listSections,
          )
          break

        case 'buttons':
          if (!buttonsTitle || !buttonsDescription || !buttons) {
            throw new Error('Título, descrição e botões são obrigatórios')
          }
          result = await WhatsAppManager.sendButtons(
            to,
            buttonsTitle,
            buttonsDescription,
            buttons,
            buttonsFooter,
          )
          break

        case 'location':
          if (latitude === undefined || longitude === undefined) {
            throw new Error('Latitude e longitude são obrigatórias')
          }
          result = await WhatsAppManager.sendLocation(
            to,
            latitude,
            longitude,
            locationTitle,
            locationAddress,
          )
          break

        case 'contact':
          if (!contactId) {
            throw new Error('ID do contato é obrigatório')
          }
          result = await WhatsAppManager.sendContact(to, contactId)
          break

        case 'image':
          if (!mediaUrl && !mediaBase64) {
            throw new Error('URL ou base64 da imagem é obrigatório')
          }
          {
            const imagePayload = await this.prepareMediaPayload(
              mediaUrl,
              mediaBase64,
            )
            result = await WhatsAppManager.sendImage(
              to,
              imagePayload,
              filename || 'image.jpg',
              caption || message,
            )
          }
          break

        case 'audio':
          if (!mediaUrl && !mediaBase64) {
            throw new Error('URL ou base64 do arquivo é obrigatório')
          }
          {
            const audioPayload = await this.prepareMediaPayload(
              mediaUrl,
              mediaBase64,
            )
            result = await WhatsAppManager.sendPtt(
              to,
              audioPayload,
              filename || 'audio.ogg',
              caption || message,
            )
          }
          break

        case 'document':
        case 'video':
          if (!mediaUrl && !mediaBase64) {
            throw new Error('URL ou base64 do arquivo é obrigatório')
          }
          {
            const filePayload = await this.prepareMediaPayload(
              mediaUrl,
              mediaBase64,
            )
            result = await WhatsAppManager.sendFile(
              to,
              filePayload,
              filename || 'file',
              caption || message,
            )
          }
          break

        default:
          throw new Error(`Tipo ${type} não suportado para WPPConnect`)
      }

      return result
    }

    let retried = false

    try {
      const result = await executeSend()
      return {
        success: true,
        messageId: result?.id || result?.key?.id,
        provider: 'whatsapp',
      }
    } catch (error: any) {
      if (!retried && this.shouldRetryAfterDetachedFrame(error)) {
        retried = true
        console.warn(
          '⚠️  Detected detached frame; resetting WhatsApp client and retrying',
        )
        try {
          await this.resetWhatsAppClient()
          const retryResult = await executeSend()
          return {
            success: true,
            messageId: retryResult?.id || retryResult?.key?.id,
            provider: 'whatsapp',
          }
        } catch (retryError: any) {
          const retryMessage =
            this.formatErrorMessage(retryError) || 'detached frame persistente'
          throw new Error(`Erro WPPConnect: ${retryMessage}`)
        }
      }

      const formattedMessage = this.formatErrorMessage(error)
      throw new Error(`Erro WPPConnect: ${formattedMessage}`)
    }
  }

  private async sendViaWppMultiInstance(
    params: SendMessageParams,
    client: any,
  ): Promise<SendMessageResult> {
    const {
      to,
      message,
      type = 'text',
      mediaUrl,
      mediaBase64,
      caption,
      filename,
      quotedMessageId,
      listTitle,
      listDescription,
      listButtonText,
      listSections,
      buttonsTitle,
      buttonsDescription,
      buttons,
      buttonsFooter,
      latitude,
      longitude,
      locationTitle,
      locationAddress,
      contactId,
    } = params

    const formattedNumber = this.formatRecipient(to)

    try {
      let result: any

      switch (type) {
        case 'text':
          if (!message) {
            throw new Error('Mensagem de texto e obrigatoria')
          }
          if (quotedMessageId) {
            result = await client.reply(
              formattedNumber,
              message,
              quotedMessageId,
            )
          } else {
            result = await client.sendText(formattedNumber, message)
          }
          break

        case 'list':
          if (
            !listTitle ||
            !listDescription ||
            !listButtonText ||
            !listSections
          ) {
            throw new Error(
              'Titulo, descricao, texto do botao e secoes sao obrigatorios para listas',
            )
          }
          result = await client.sendListMessage(formattedNumber, {
            buttonText: listButtonText,
            description: listDescription,
            sections: listSections,
            title: listTitle,
          })
          break

        case 'buttons':
          if (!buttonsTitle || !buttonsDescription || !buttons) {
            throw new Error('Titulo, descricao e botoes sao obrigatorios')
          }
          result = await client.sendButtons(
            formattedNumber,
            buttonsTitle,
            buttons,
            buttonsDescription,
            buttonsFooter,
          )
          break

        case 'location':
          if (latitude === undefined || longitude === undefined) {
            throw new Error('Latitude e longitude sao obrigatorias')
          }
          result = await client.sendLocation(
            formattedNumber,
            latitude,
            longitude,
            locationTitle,
            locationAddress,
          )
          break

        case 'contact':
          if (!contactId) {
            throw new Error('ID do contato e obrigatorio')
          }
          result = await client.sendContactVcard(formattedNumber, contactId)
          break

        case 'sticker':
          if (!mediaUrl && !mediaBase64) {
            throw new Error('URL ou base64 da imagem e obrigatorio para sticker')
          }
          {
            const stickerPayload = await this.prepareMediaPayload(mediaUrl, mediaBase64)
            result = await client.sendImageAsSticker(formattedNumber, stickerPayload)
          }
          break

        case 'sticker_gif':
          if (!mediaUrl && !mediaBase64) {
            throw new Error('URL ou base64 e obrigatorio para sticker animado')
          }
          {
            const stickerGifPayload = await this.prepareMediaPayload(mediaUrl, mediaBase64)
            result = await (client as any).sendImageAsStickerGif(formattedNumber, stickerGifPayload)
          }
          break

        case 'poll':
          throw new Error('Para enquetes, use o endpoint /api/whatsapp/features/poll')

        case 'image':
        case 'audio':
        case 'document':
        case 'video':
          if (!mediaUrl && !mediaBase64) {
            throw new Error('URL ou base64 do arquivo e obrigatorio')
          }
          {
            let mediaPayload = await this.prepareMediaPayload(
              mediaUrl,
              mediaBase64,
            )
            let targetFilename =
              filename ||
              (type === 'image'
                ? 'image.jpg'
                : type === 'audio'
                  ? 'audio.ogg'
                  : 'file')

            // Converte audio (webm/mp4/etc) para ogg/opus antes de injetar no browser
            // WPP.chat.sendFileMessage nao faz conversao — WhatsApp rejeita formatos nao-ogg
            let audioCleanup: (() => Promise<void>) | null = null
            if (type === 'audio') {
              try {
                const converted = await prepareLocalMediaPayload(mediaPayload, targetFilename)
                const fs = await import('fs/promises')
                const oggBuffer = await fs.readFile(converted.path)
                mediaPayload = `data:audio/ogg;base64,${oggBuffer.toString('base64')}`
                targetFilename = targetFilename.replace(/\.(webm|mp4|m4a|mp3|wav|aac)$/i, '.ogg')
                if (!targetFilename.endsWith('.ogg')) {
                  targetFilename = targetFilename.replace(/\.[^.]+$/, '.ogg')
                }
                audioCleanup = converted.cleanup
                console.log(`🎵 [Media] Audio convertido para OGG/Opus (${(mediaPayload.length / 1024).toFixed(1)}KB)`)
              } catch (convErr: any) {
                console.error(`⚠️ [Media] Falha na conversao de audio, enviando formato original:`, convErr?.message || convErr)
              }
            }

            console.log(
              `📎 [Media] Enviando ${type} (${targetFilename}, ${(mediaPayload.length / 1024).toFixed(1)}KB) para ${formattedNumber}...`,
            )

            // Bypass client.sendFile para evitar:
            // 1. Base64 gigante via CDP Runtime.callFunctionOn (gargalo de serializacao)
            // 2. await result.sendMsgResult que trava indefinidamente (ACK hang)
            // Injeta base64 em chunks e chama WPP.chat.sendFileMessage direto
            const page = client.page
            if (!page) {
              if (audioCleanup) await audioCleanup()
              throw new Error('Sessao WhatsApp sem pagina ativa')
            }

            // Step 1: Injeta base64 no contexto do browser em chunks
            const CHUNK_SIZE = 500_000 // 500KB por chunk
            await page.evaluate('window.__wppMedia = ""')
            const totalChunks = Math.ceil(
              mediaPayload.length / CHUNK_SIZE,
            )
            for (let i = 0; i < totalChunks; i++) {
              const chunk = mediaPayload.substring(
                i * CHUNK_SIZE,
                (i + 1) * CHUNK_SIZE,
              )
              await page.evaluate(
                (c: string) => {
                  ;(window as any).__wppMedia += c
                },
                chunk,
              )
            }
            console.log(
              `📎 [Media] Base64 injetado no browser (${totalChunks} chunks)`,
            )

            // Step 2: Monta opcoes para WPP.chat.sendFileMessage
            const wppOpts: Record<string, any> = {
              filename: targetFilename,
              caption: caption || message || '',
              createChat: true,
            }
            if (type === 'audio') {
              wppOpts.type = 'audio'
              wppOpts.isPtt = true
            } else if (type === 'image') {
              wppOpts.type = 'image'
            } else if (type === 'document') {
              wppOpts.type = 'document'
            } else if (type === 'video') {
              wppOpts.type = 'video'
            }

            // Step 3: Chama WPP.chat.sendFileMessage direto — SEM await sendMsgResult
            // Usa string para page.evaluate evitando que esbuild/tsup corrompa referencia ao WPP global
            const sendScript = `(async () => {
              try {
                const base64 = window.__wppMedia;
                delete window.__wppMedia;
                const to = ${JSON.stringify(formattedNumber)};
                const opts = ${JSON.stringify(wppOpts)};
                const result = await WPP.chat.sendFileMessage(to, base64, opts);
                return {
                  success: true,
                  id: (result && result.id && result.id._serialized) || String(result && result.id || '')
                };
              } catch (err) {
                delete window.__wppMedia;
                return {
                  success: false,
                  error: (err && err.message) || String(err)
                };
              }
            })()`

            const sendPromise = page
              .evaluate(sendScript)
              .catch((err: any) => {
                console.error(
                  `❌ [Media] page.evaluate erro: ${err?.message || err}`,
                )
                return {
                  success: false,
                  error: err?.message || String(err),
                }
              })

            const timeoutPromise = new Promise<{
              success: boolean
              id: string
              timeout: true
            }>((resolve) =>
              setTimeout(() => {
                console.warn(
                  `⏱️ [Media] ${type} timeout 60s — provavelmente enviada`,
                )
                resolve({
                  success: true,
                  id: 'timeout-assumed-sent',
                  timeout: true,
                })
              }, 60000),
            )

            const sendResult = (await Promise.race([
              sendPromise,
              timeoutPromise,
            ])) as any

            if (!sendResult.success) {
              if (audioCleanup) await audioCleanup()
              throw new Error(
                sendResult.error || 'Erro ao enviar midia',
              )
            }

            if (audioCleanup) await audioCleanup()

            console.log(
              `📎 [Media] ${type} resultado: id=${sendResult.id}, timeout=${sendResult.timeout || false}`,
            )
            result = { id: sendResult.id }
          }
          break

        default:
          throw new Error(`Tipo ${type} não suportado para WPPConnect`)
      }

      return {
        success: true,
        messageId: result?.id || result?.key?.id,
        provider: 'whatsapp',
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Erro WPPConnect: ${this.formatErrorMessage(error)}`,
        provider: 'whatsapp',
      }
    }
  }

  private async ensureWhatsAppConnection(): Promise<{
    ok: boolean
    error?: string
  }> {
    if (WhatsAppManager.isConnected()) {
      return { ok: true }
    }

    if (this.isReconnecting) {
      return {
        ok: false,
        error:
          'WhatsApp está em processo de reconexão. Aguarde e tente novamente.',
      }
    }

    this.isReconnecting = true
    try {
      console.warn(
        '⚠️  WhatsApp não está conectado. Tentando reconectar automaticamente...',
      )
      await WhatsAppManager.connect()
    } catch (reconnectError: any) {
      const errorMessage = reconnectError.message || 'Erro desconhecido'

      if (errorMessage.includes('The browser is already running')) {
        return {
          ok: false,
          error:
            'WhatsApp está em processo de inicialização. Por favor, aguarde alguns segundos e tente novamente.',
        }
      }

      return {
        ok: false,
        error: `WhatsApp não está conectado e a tentativa de reconexão falhou: ${errorMessage}`,
      }
    } finally {
      this.isReconnecting = false
    }

    if (!WhatsAppManager.isConnected()) {
      return {
        ok: false,
        error:
          'WhatsApp não está conectado. A reconexão automática não foi concluída.',
      }
    }

    return { ok: true }
  }

  private async resetWhatsAppClient(): Promise<void> {
    try {
      await WhatsAppManager.disconnect()
    } catch (error) {
      console.warn('Falha ao desconectar WhatsApp antes de resetar:', error)
    }

    const connectionStatus = await this.ensureWhatsAppConnection()
    if (!connectionStatus.ok) {
      throw new Error(
        connectionStatus.error || 'Falha ao reconectar o WhatsApp após reset.',
      )
    }
  }

  private shouldRetryAfterDetachedFrame(error: any): boolean {
    const message = this.formatErrorMessage(error).toLowerCase()
    return (
      message.includes('detached frame') ||
      message.includes('target closed') ||
      message.includes('browser has disconnected')
    )
  }

  private async prepareMediaPayload(
    mediaUrl?: string,
    mediaBase64?: string,
  ): Promise<string> {
    if (mediaBase64) {
      return mediaBase64
    }

    if (!mediaUrl) {
      throw new Error('URL ou base64 da mídia é obrigatório')
    }

    if (this.isDataUrl(mediaUrl) || !this.isHttpUrl(mediaUrl)) {
      return mediaUrl
    }

    return await this.fetchRemoteMediaAsBase64(mediaUrl)
  }

  private isDataUrl(value: string): boolean {
    return value.startsWith('data:')
  }

  private isHttpUrl(value: string): boolean {
    return /^https?:\/\//i.test(value)
  }

  private async fetchRemoteMediaAsBase64(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 120000,
        maxContentLength: 200 * 1024 * 1024, // 200 MB ceiling
        maxBodyLength: 200 * 1024 * 1024,
      })
      const contentType =
        response.headers['content-type'] || 'application/octet-stream'
      const base64 = Buffer.from(response.data).toString('base64')
      return `data:${contentType};base64,${base64}`
    } catch (error: any) {
      console.error('❌ Erro ao baixar mídia remota antes do envio:', error)
      throw new Error('Não foi possível baixar a mídia antes de enviar')
    }
  }

  private formatErrorMessage(error: any): string {
    if (!error) {
      return 'Erro desconhecido'
    }

    if (typeof error === 'string' && error.trim()) {
      return error
    }

    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message
    }

    if (typeof error.toString === 'function') {
      const fallbackMessage = error.toString()
      if (fallbackMessage && fallbackMessage !== '[object Object]') {
        return fallbackMessage
      }
    }

    try {
      return JSON.stringify(error)
    } catch {
      return 'Erro desconhecido'
    }
  }

  private formatRecipient(to: string): string {
    const cleaned = to.replace(/\D/g, '')
    if (cleaned.startsWith('55') && cleaned.length === 12) {
      return `55${cleaned.charAt(2)}9${cleaned.substring(3)}@c.us`
    }
    return `${cleaned}@c.us`
  }

  /**
   * Envia via Meta WhatsApp Business API
   */
  private async sendViaMeta(
    params: SendMessageParams,
  ): Promise<SendMessageResult> {
    const {
      to,
      message,
      type = 'text',
      mediaUrl,
      mediaBase64,
      caption,
      filename,
      quotedMessageId,
      listTitle,
      listDescription,
      listButtonText,
      listSections,
      buttonsTitle,
      buttonsDescription,
      buttons,
      buttonsFooter,
      latitude,
      longitude,
      locationTitle,
      locationAddress,
      contactId,
      metaAccessToken,
      metaPhoneNumberId,
      metaApiVersion,
      metaBaseUrl,
      sessionName,
    } = params

    // Monta configuração customizada se credenciais foram fornecidas
    let instanceMetaConfig:
      | {
          accessToken?: string
          phoneNumberId?: string
          apiVersion?: string
          baseUrl?: string
        }
      | undefined

    if (sessionName) {
      const instance = await whatsappInstanceRepository.findBySessionName(
        sessionName,
      )
      if (
        instance?.connectionType === 'meta_official' &&
        instance.metaConfig?.enabled
      ) {
        instanceMetaConfig = {
          accessToken: instance.metaConfig.accessToken,
          phoneNumberId: instance.metaConfig.phoneNumberId,
          apiVersion: instance.metaConfig.apiVersion,
          baseUrl: instance.metaConfig.baseUrl,
        }
      }
    }

    const customConfig =
      metaAccessToken ||
      metaPhoneNumberId ||
      instanceMetaConfig?.accessToken ||
      instanceMetaConfig?.phoneNumberId
        ? {
            accessToken: metaAccessToken || instanceMetaConfig?.accessToken,
            phoneNumberId: metaPhoneNumberId || instanceMetaConfig?.phoneNumberId,
            apiVersion:
              metaApiVersion ||
              instanceMetaConfig?.apiVersion ||
              process.env.META_API_VERSION,
            baseUrl:
              metaBaseUrl ||
              instanceMetaConfig?.baseUrl ||
              process.env.URL_META,
          }
        : undefined

    // Valida se tem credenciais (via params ou ENV)
    if (!customConfig && !MetaManager.getIsEnabled()) {
      return {
        success: false,
        error:
          'Meta WhatsApp Business API não está configurado. Forneça metaAccessToken e metaPhoneNumberId.',
        provider: 'meta_whatsapp',
      }
    }

    try {
      let result: any

      switch (type) {
        case 'text':
          if (!message) {
            throw new Error('Mensagem de texto é obrigatória')
          }
          result = await MetaManager.sendText(
            to,
            message,
            quotedMessageId,
            customConfig,
          )
          break

        case 'list':
          if (
            !listTitle ||
            !listDescription ||
            !listButtonText ||
            !listSections
          ) {
            throw new Error(
              'Título, descrição, texto do botão e seções são obrigatórios para listas',
            )
          }
          result = await MetaManager.sendList(
            to,
            listTitle,
            listDescription,
            listButtonText,
            listSections,
            customConfig,
          )
          break

        case 'buttons':
          if (!buttonsTitle || !buttonsDescription || !buttons) {
            throw new Error('Título, descrição e botões são obrigatórios')
          }
          result = await MetaManager.sendButtons(
            to,
            buttonsTitle,
            buttonsDescription,
            buttons,
            buttonsFooter,
            customConfig,
          )
          break

        case 'location':
          if (latitude === undefined || longitude === undefined) {
            throw new Error('Latitude e longitude são obrigatórias')
          }
          result = await MetaManager.sendLocation(
            to,
            latitude,
            longitude,
            locationTitle,
            locationAddress,
            customConfig,
          )
          break

        case 'contact':
          if (!contactId) {
            throw new Error('ID do contato é obrigatório')
          }
          result = await MetaManager.sendContact(to, contactId, customConfig)
          break

        case 'image':
        case 'document':
        case 'audio':
        case 'video':
          if (!mediaUrl && !mediaBase64) {
            throw new Error('URL ou base64 da mídia é obrigatório')
          }

          const mediaContent = await this.prepareMediaPayload(
            mediaUrl,
            mediaBase64,
          )

          result = await MetaManager.sendMedia(
            to,
            type,
            mediaContent,
            filename,
            caption || message,
            quotedMessageId,
            customConfig,
          )
          break

        default:
          throw new Error(`Tipo ${type} não suportado para Meta`)
      }

      return {
        success: true,
        messageId: result.idMessage,
        mediaId: result.mediaId,
        provider: 'meta_whatsapp',
      }
    } catch (error: any) {
      throw new Error(`Erro Meta API: ${error.message}`)
    }
  }

  /**
   * Envia via Instagram Direct (Meta)
   */
  private async sendViaInstagram(
    params: SendMessageParams,
  ): Promise<SendMessageResult> {
    const {
      to,
      message,
      type = 'text',
      mediaUrl,
      mediaBase64,
      instagramAccessToken,
      instagramAccountId,
      instagramApiVersion,
      instagramBaseUrl,
      sessionName,
    } = params

    let instanceInstagramConfig:
      | {
          accessToken?: string
          instagramAccountId?: string
          apiVersion?: string
          baseUrl?: string
        }
      | undefined

    if (sessionName) {
      const instance = await whatsappInstanceRepository.findBySessionName(
        sessionName,
      )
      if (
        instance?.connectionType === 'meta_official' &&
        instance.metaConfig?.enabled
      ) {
        instanceInstagramConfig = {
          accessToken: instance.metaConfig.accessToken,
          instagramAccountId: instance.metaConfig.instagramAccountId,
          apiVersion: instance.metaConfig.apiVersion,
          baseUrl: instance.metaConfig.baseUrl,
        }
      }
    }

    const customConfig =
      instagramAccessToken ||
      instagramAccountId ||
      instanceInstagramConfig?.accessToken ||
      instanceInstagramConfig?.instagramAccountId
        ? {
            accessToken:
              instagramAccessToken || instanceInstagramConfig?.accessToken,
            instagramAccountId:
              instagramAccountId ||
              instanceInstagramConfig?.instagramAccountId,
            apiVersion:
              instagramApiVersion ||
              instanceInstagramConfig?.apiVersion ||
              process.env.INSTAGRAM_API_VERSION,
            baseUrl:
              instagramBaseUrl ||
              instanceInstagramConfig?.baseUrl ||
              process.env.INSTAGRAM_BASE_URL,
          }
        : undefined

    if (!customConfig && !InstagramManager.getIsEnabled()) {
      return {
        success: false,
        error:
          'Instagram Direct nao esta configurado. Forneca instagramAccessToken e instagramAccountId.',
        provider: 'instagram',
      }
    }

    try {
      let result: { idMessage: string }

      switch (type) {
        case 'text':
          if (!message) {
            throw new Error('Mensagem de texto e obrigatoria')
          }
          result = await InstagramManager.sendText(to, message, customConfig)
          break

        case 'image':
        case 'video':
          if (!mediaUrl && !mediaBase64) {
            throw new Error('URL da midia e obrigatoria para Instagram Direct')
          }
          if (mediaBase64) {
            throw new Error(
              'Instagram Direct nao suporta envio por base64 neste endpoint; use mediaUrl publico',
            )
          }
          result = await InstagramManager.sendMedia(
            to,
            type,
            mediaUrl!,
            customConfig,
          )
          break

        default:
          if (!message) {
            throw new Error(`Tipo ${type} nao suportado para Instagram Direct`)
          }
          result = await InstagramManager.sendText(to, message, customConfig)
          break
      }

      return {
        success: true,
        messageId: result.idMessage,
        provider: 'instagram',
      }
    } catch (error: any) {
      throw new Error(`Erro Instagram API: ${error.message}`)
    }
  }

  /**
   * Envia via Telegram (placeholder)
   */
  private async sendViaTelegram(
    params: SendMessageParams,
  ): Promise<SendMessageResult> {
    // TODO: Implementar quando tiver TelegramManager
    return {
      success: false,
      error: 'Telegram ainda não implementado',
      provider: 'telegram',
    }
  }

  /**
   * Detecta provider automaticamente baseado no identificador
   */
  public detectProvider(
    identifier: string,
  ): 'whatsapp' | 'meta_whatsapp' | 'instagram' | 'telegram' {
    // Se começa com número de telefone, é WhatsApp
    if (/^55\d{10,11}$/.test(identifier)) {
      // Por padrão, usa WPPConnect
      // Você pode adicionar lógica aqui para decidir entre WPP e Meta
      return 'whatsapp'
    }

    // Se for ID de chat do Telegram
    if (/^-?\d+$/.test(identifier)) {
      return 'telegram'
    }

    if (identifier.startsWith('ig:')) {
      return 'instagram'
    }

    // Padrão
    return 'whatsapp'
  }

  /**
   * Envia mensagem detectando provider automaticamente
   */
  public async sendMessageAuto(
    params: Omit<SendMessageParams, 'provider'>,
  ): Promise<SendMessageResult> {
    const provider = this.detectProvider(params.to)

    return await this.sendMessage({
      ...params,
      provider,
    })
  }
}

export default MessagingService.getInstance()
