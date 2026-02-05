import axios from 'axios'

import { prepareLocalMediaPayload } from '../helpers/WhatsAppMediaHelper'
import MetaManager from '../providers/MetaManager'
import WhatsAppManager from '../whatsapp/WhatsAppManager'
import WhatsAppMultiManager from '../whatsapp/WhatsAppMultiManager'

/**
 * Interface para envio de mensagem
 */
export interface SendMessageParams {
  to: string
  provider: 'whatsapp' | 'meta_whatsapp' | 'telegram' // Provider determina qual serviço usar
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
    const { provider, type = 'text' } = params

    try {
      switch (provider) {
        case 'whatsapp':
          return await this.sendViaWppConnect(params)

        case 'meta_whatsapp':
          return await this.sendViaMeta(params)

        case 'telegram':
          return await this.sendViaTelegram(params)

        default:
          return {
            success: false,
            error: `Provider ${provider} não suportado`,
            provider,
          }
      }
    } catch (error: any) {
      console.error(`❌ Erro ao enviar mensagem via ${provider}:`, error)
      return {
        success: false,
        error: error.message || 'Erro desconhecido',
        provider,
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
      console.log('[MessagingService] Envio WPP', {
        to,
        type,
        hasMediaUrl: Boolean(mediaUrl),
        hasMediaBase64: Boolean(mediaBase64),
        filename,
        caption: caption || message,
        sessionName: sessionName || 'default',
      })
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

        case 'document':
        case 'audio':
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

        case 'image':
          if (!mediaUrl && !mediaBase64) {
            throw new Error('URL ou base64 da imagem e obrigatorio')
          }
          {
            const imagePayload = await this.prepareMediaPayload(
              mediaUrl,
              mediaBase64,
            )
            const targetFilename = filename || 'image.jpg'
            const mediaFile = await prepareLocalMediaPayload(
              imagePayload,
              targetFilename,
            )
            try {
              result = await client.sendImage(
                formattedNumber,
                mediaFile.path,
                targetFilename,
                caption || message,
              )
            } finally {
              await mediaFile.cleanup()
            }
          }
          break

        case 'document':
        case 'audio':
        case 'video':
          if (!mediaUrl && !mediaBase64) {
            throw new Error('URL ou base64 do arquivo e obrigatorio')
          }
          {
            const filePayload = await this.prepareMediaPayload(
              mediaUrl,
              mediaBase64,
            )
            const targetFilename = filename || 'file'
            const fileMedia = await prepareLocalMediaPayload(
              filePayload,
              targetFilename,
            )
            try {
              result = await client.sendFile(
                formattedNumber,
                fileMedia.path,
                targetFilename,
                caption || message,
              )
            } finally {
              await fileMedia.cleanup()
            }
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
    } = params

    // Monta configuração customizada se credenciais foram fornecidas
    const customConfig =
      metaAccessToken || metaPhoneNumberId
        ? {
            accessToken: metaAccessToken,
            phoneNumberId: metaPhoneNumberId,
            apiVersion: metaApiVersion,
            baseUrl: metaBaseUrl,
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

          const mediaContent = mediaUrl || mediaBase64!

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
  ): 'whatsapp' | 'meta_whatsapp' | 'telegram' {
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
