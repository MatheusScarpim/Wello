import axios, { AxiosInstance } from 'axios'
import EventEmitter from 'events'
import FormData from 'form-data'

import MediaProcessor from '../helpers/MediaProcessor'

/**
 * Configuração do Meta WhatsApp Business API
 */
export interface MetaConfig {
  accessToken: string
  phoneNumberId: string
  apiVersion?: string
  baseUrl?: string
}

/**
 * Mensagem recebida do webhook Meta
 */
export interface MetaIncomingMessage {
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
    originalUrl?: string
  }
  _rawMediaId?: string // ID da mídia na Meta (para download posterior se necessário)
}

/**
 * Gerenciador do Meta WhatsApp Business API
 * Singleton + EventEmitter
 * Suporta configuração via ENV (bots) e via parâmetros (requests/API)
 */
export class MetaManager extends EventEmitter {
  private static instance: MetaManager
  private defaultConfig: MetaConfig
  private defaultAxiosInstance: AxiosInstance
  private isDefaultEnabled: boolean

  private constructor() {
    super()

    // Configuração padrão via ENV (para bots)
    this.defaultConfig = {
      accessToken: process.env.TOKEN_META || '',
      phoneNumberId: process.env.CODE_META || '',
      apiVersion: process.env.META_API_VERSION || 'v17.0',
      baseUrl: process.env.URL_META || 'https://graph.facebook.com',
    }

    this.isDefaultEnabled =
      !!this.defaultConfig.accessToken && !!this.defaultConfig.phoneNumberId

    this.defaultAxiosInstance = axios.create({
      baseURL: `${this.defaultConfig.baseUrl}/${this.defaultConfig.apiVersion}`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.defaultConfig.accessToken}`,
      },
      timeout: 30000,
    })

    if (this.isDefaultEnabled) {
      console.log('✅ Meta WhatsApp Business API configurado (ENV)')
    } else {
      console.log(
        '⚠️  Meta WhatsApp Business API: Sem credenciais padrão (ENV) - use parâmetros nas requests',
      )
    }
  }

  /**
   * Retorna instância única
   */
  public static getInstance(): MetaManager {
    if (!MetaManager.instance) {
      MetaManager.instance = new MetaManager()
    }
    return MetaManager.instance
  }

  /**
   * Verifica se está habilitado (configuração padrão via ENV)
   */
  public getIsEnabled(): boolean {
    return this.isDefaultEnabled
  }

  /**
   * Cria axios instance customizado para requisição específica
   */
  private createAxiosInstance(config: MetaConfig): AxiosInstance {
    return axios.create({
      baseURL: `${config.baseUrl}/${config.apiVersion}`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
      },
      timeout: 30000,
    })
  }

  /**
   * Obtém config e axios instance (usa customConfig se fornecido, senão usa padrão)
   */
  private getConfigAndInstance(customConfig?: Partial<MetaConfig>): {
    config: MetaConfig
    axiosInstance: AxiosInstance
  } {
    // Se tem customConfig, cria novo instance
    if (customConfig) {
      const config: MetaConfig = {
        accessToken: customConfig.accessToken || this.defaultConfig.accessToken,
        phoneNumberId:
          customConfig.phoneNumberId || this.defaultConfig.phoneNumberId,
        apiVersion: customConfig.apiVersion || this.defaultConfig.apiVersion,
        baseUrl: customConfig.baseUrl || this.defaultConfig.baseUrl,
      }

      return {
        config,
        axiosInstance: this.createAxiosInstance(config),
      }
    }

    // Usa configuração padrão
    return {
      config: this.defaultConfig,
      axiosInstance: this.defaultAxiosInstance,
    }
  }

  /**
   * Envia mensagem de texto
   * @param customConfig - Configuração customizada (opcional, usa ENV se não fornecido)
   */
  public async sendText(
    to: string,
    message: string,
    quotedMessageId?: string,
    customConfig?: Partial<MetaConfig>,
  ): Promise<{ idMessage: string }> {
    const { config, axiosInstance } = this.getConfigAndInstance(customConfig)

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: message,
      },
    }

    if (quotedMessageId) {
      payload.context = {
        message_id: quotedMessageId,
      }
    }

    const response = await axiosInstance.post(
      `/${config.phoneNumberId}/messages`,
      payload,
    )

    return {
      idMessage: response.data.messages[0].id,
    }
  }

  /**
   * Envia mensagem com lista interativa
   * Compatível com a estrutura do WPPConnect
   * @param customConfig - Configuração customizada (opcional, usa ENV se não fornecido)
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
    customConfig?: Partial<MetaConfig>,
  ): Promise<{ idMessage: string }> {
    const { config, axiosInstance } = this.getConfigAndInstance(customConfig)

    // Converte estrutura do WPPConnect para Meta API
    const metaSections = sections.map((section) => ({
      title: section.title,
      rows: section.rows.map((row) => ({
        id: row.rowId, // Meta usa 'id', WPPConnect usa 'rowId'
        title: row.title,
        description: row.description,
      })),
    }))

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: {
          type: 'text',
          text: title,
        },
        body: {
          text: description,
        },
        action: {
          button: buttonText,
          sections: metaSections,
        },
      },
    }

    const response = await axiosInstance.post(
      `/${config.phoneNumberId}/messages`,
      payload,
    )

    return {
      idMessage: response.data.messages[0].id,
    }
  }

  /**
   * Envia botões interativos
   * Compatível com a estrutura do WPPConnect
   * @param customConfig - Configuração customizada (opcional, usa ENV se não fornecido)
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
    customConfig?: Partial<MetaConfig>,
  ): Promise<{ idMessage: string }> {
    const { config, axiosInstance } = this.getConfigAndInstance(customConfig)

    // Meta API suporta no máximo 3 botões
    if (buttons.length > 3) {
      throw new Error(
        'Meta API suporta no máximo 3 botões. Use lista para mais opções.',
      )
    }

    const metaButtons = buttons.map((btn) => ({
      type: 'reply',
      reply: {
        id: btn.id,
        title: btn.text,
      },
    }))

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        header: {
          type: 'text',
          text: title,
        },
        body: {
          text: description,
        },
        action: {
          buttons: metaButtons,
        },
      },
    }

    if (footer) {
      payload.interactive.footer = {
        text: footer,
      }
    }

    const response = await axiosInstance.post(
      `/${config.phoneNumberId}/messages`,
      payload,
    )

    return {
      idMessage: response.data.messages[0].id,
    }
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
    customConfig?: Partial<MetaConfig>,
  ): Promise<{ idMessage: string }> {
    const { config, axiosInstance } = this.getConfigAndInstance(customConfig)

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'location',
      location: {
        latitude: latitude.toString(),
        longitude: longitude.toString(),
      },
    }

    if (title) {
      payload.location.name = title
    }

    if (address) {
      payload.location.address = address
    }

    const response = await axiosInstance.post(
      `/${config.phoneNumberId}/messages`,
      payload,
    )

    return {
      idMessage: response.data.messages[0].id,
    }
  }

  /**
   * Envia contato
   * Nota: Meta API usa formato vCard diferente
   */
  public async sendContact(
    to: string,
    contactId: string,
    customConfig?: Partial<MetaConfig>,
  ): Promise<{ idMessage: string }> {
    const { config, axiosInstance } = this.getConfigAndInstance(customConfig)

    // Extrai número do contactId (formato: 5511999999999@c.us)
    const phoneNumber = contactId.replace('@c.us', '')

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'contacts',
      contacts: [
        {
          phones: [
            {
              phone: phoneNumber,
              type: 'CELL',
            },
          ],
        },
      ],
    }

    const response = await axiosInstance.post(
      `/${config.phoneNumberId}/messages`,
      payload,
    )

    return {
      idMessage: response.data.messages[0].id,
    }
  }

  /**
   * Envia template
   */
  public async sendTemplate(
    to: string,
    templateName: string,
    components?: Array<any>,
    customConfig?: Partial<MetaConfig>,
  ): Promise<{ idMessage: string }> {
    const { config, axiosInstance } = this.getConfigAndInstance(customConfig)

    const payload: any = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: 'pt_BR',
        },
      },
    }

    if (components && components.length > 0) {
      payload.template.components = components
    }

    const response = await axiosInstance.post(
      `/${config.phoneNumberId}/messages`,
      payload,
    )

    return {
      idMessage: response.data.messages[0].id,
    }
  }

  /**
   * Upload de mídia e envio
   */
  public async sendMedia(
    to: string,
    type: 'image' | 'document' | 'audio' | 'video',
    mediaContent: string | Buffer,
    filename?: string,
    caption?: string,
    quotedMessageId?: string,
    customConfig?: Partial<MetaConfig>,
  ): Promise<{ idMessage: string; mediaId: string }> {
    const { config, axiosInstance } = this.getConfigAndInstance(customConfig)

    // 1. Upload da mídia
    const mediaId = await this.uploadMedia(mediaContent, type, filename, config)

    // 2. Envia mensagem com mídia
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type,
    }

    payload[type] = {
      id: mediaId,
    }

    if (
      caption &&
      (type === 'image' || type === 'document' || type === 'video')
    ) {
      payload[type].caption = caption
    }

    if (quotedMessageId) {
      payload.context = {
        message_id: quotedMessageId,
      }
    }

    const response = await axiosInstance.post(
      `/${config.phoneNumberId}/messages`,
      payload,
    )

    return {
      idMessage: response.data.messages[0].id,
      mediaId,
    }
  }

  /**
   * Upload de mídia
   */
  private async uploadMedia(
    content: string | Buffer,
    type: string,
    filename?: string,
    config?: MetaConfig,
  ): Promise<string> {
    const actualConfig = config || this.defaultConfig

    const form = new FormData()
    form.append('messaging_product', 'whatsapp')

    // Se for base64, converte para buffer
    let buffer: Buffer
    if (typeof content === 'string') {
      // Remove prefixo data:image/png;base64,
      const base64Data = content.replace(/^data:.+;base64,/, '')
      buffer = Buffer.from(base64Data, 'base64')
    } else {
      buffer = content
    }

    form.append('file', buffer, {
      filename: filename || `file.${this.getExtensionFromType(type)}`,
      contentType: this.getMimeTypeFromType(type),
    })

    const response = await axios.post(
      `${actualConfig.baseUrl}/${actualConfig.apiVersion}/${actualConfig.phoneNumberId}/media`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${actualConfig.accessToken}`,
        },
      },
    )

    return response.data.id
  }

  /**
   * Download de mídia
   */
  public async downloadMedia(
    mediaId: string,
    customConfig?: Partial<MetaConfig>,
  ): Promise<string | null> {
    const { config, axiosInstance } = this.getConfigAndInstance(customConfig)

    try {
      // 1. Busca URL da mídia
      const infoResponse = await axiosInstance.get(`/${mediaId}`)
      const mediaUrl = infoResponse.data.url
      const mimeType = infoResponse.data.mime_type

      // 2. Baixa a mídia
      const mediaResponse = await axios.get(mediaUrl, {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
        responseType: 'arraybuffer',
      })

      // 3. Converte para base64
      const base64 = Buffer.from(mediaResponse.data, 'binary').toString(
        'base64',
      )
      return `data:${mimeType};base64,${base64}`
    } catch (error) {
      console.error('❌ Erro ao baixar mídia:', error)
      return null
    }
  }

  /**
   * Marca mensagem como lida
   */
  public async markAsRead(
    messageId: string,
    customConfig?: Partial<MetaConfig>,
  ): Promise<boolean> {
    const { config, axiosInstance } = this.getConfigAndInstance(customConfig)

    try {
      await axiosInstance.post(`/${config.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      })
      return true
    } catch (error) {
      console.error('❌ Erro ao marcar como lida:', error)
      return false
    }
  }

  /**
   * Processa mensagem recebida do webhook
   */
  public async processWebhookMessage(
    webhookBody: any,
  ): Promise<MetaIncomingMessage | null> {
    try {
      if (
        !webhookBody.entry ||
        !webhookBody.entry[0].changes ||
        !webhookBody.entry[0].changes[0].value.messages
      ) {
        return null
      }

      const entry = webhookBody.entry[0].changes[0].value.messages[0]
      const metadata = webhookBody.entry[0].changes[0].value.metadata
      const contact = webhookBody.entry[0].changes[0].value.contacts[0]

      const message = this.extractMessageContent(entry)
      if (entry.type === 'interactive') {
        console.log('[MetaWebhook] Interactive payload recebido', {
          entryId: entry.id,
          from: entry.from,
          interactiveType: entry.interactive?.type,
          listReply: entry.interactive?.list_reply,
          buttonReply: entry.interactive?.button_reply,
          extractedContent: message.content,
        })
      }

      // Processa mídia se necessário
      let mediaData = null
      let rawMediaId = null

      if (MediaProcessor.isMediaType(message.type)) {
        // Extrai o ID da mídia do entry
        const mediaType = message.type
        const mediaObject = entry[mediaType]
        rawMediaId = mediaObject?.id

        if (rawMediaId) {
          // Baixa a URL da mídia da Meta
          try {
            const mediaInfo = await this.getMediaUrl(rawMediaId)
            if (mediaInfo) {
              // Faz upload para o Azure
              mediaData = await MediaProcessor.processMetaMedia(
                mediaInfo.url,
                mediaType,
                this.defaultConfig.accessToken,
                {
                  messageId: entry.id,
                  from: entry.from,
                  mediaId: rawMediaId,
                  mimeType: mediaInfo.mimeType,
                },
              )
            }
          } catch (error) {
            console.error('❌ Erro ao processar mídia da Meta:', error)
          }
        }
      }

      return {
        identifier: this.normalizePhoneNumber(entry.from),
        message: message.content,
        idMessage: entry.id,
        quotedMsg: entry.context?.id,
        name: contact.profile.name,
        provider: 'meta_whatsapp',
        identifierProvider: metadata.display_phone_number,
        type: message.type,
        mediaUrl: mediaData?.mediaUrl,
        mediaStorage: mediaData?.mediaStorage,
        _rawMediaId: rawMediaId || undefined,
      }
    } catch (error) {
      console.error('❌ Erro ao processar webhook:', error)
      return null
    }
  }

  /**
   * Obtém informações da mídia (URL e mime type)
   */
  private async getMediaUrl(
    mediaId: string,
  ): Promise<{ url: string; mimeType: string } | null> {
    try {
      const infoResponse = await this.defaultAxiosInstance.get(`/${mediaId}`)
      return {
        url: infoResponse.data.url,
        mimeType: infoResponse.data.mime_type,
      }
    } catch (error) {
      console.error('❌ Erro ao obter URL da mídia:', error)
      return null
    }
  }

  /**
   * Extrai conteúdo da mensagem
   * Quando usuário clica em lista/botão, retorna o ID (rowId ou button id)
   */
  private extractMessageContent(entry: any): { content: string; type: string } {
    switch (entry.type) {
      case 'text':
        return { content: entry.text.body, type: 'text' }

      case 'image':
        return { content: entry.image.caption || '', type: 'image' }

      case 'document':
        return { content: entry.document.caption || '', type: 'document' }

      case 'audio':
        return { content: '', type: 'audio' }

      case 'video':
        return { content: entry.video.caption || '', type: 'video' }

      case 'interactive':
        // Quando usuário clica em uma opção de lista
        if (entry.interactive.type === 'list_reply') {
          return {
            content: entry.interactive.list_reply.id, // Retorna o ID da opção (ex: '1', '2', '3')
            type: 'interactive',
          }
        }
        // Quando usuário clica em um botão
        else if (entry.interactive.type === 'button_reply') {
          return {
            content: entry.interactive.button_reply.id, // Retorna o ID do botão (ex: 'SIM', 'NAO')
            type: 'interactive',
          }
        }
        console.warn('[MetaWebhook] Interactive sem tipo reconhecido', {
          entryId: entry?.id,
          interactivePayload: entry?.interactive,
        })
        return { content: '', type: 'interactive' }

      default:
        return {
          content: entry.text?.body || '',
          type: entry.type || 'unknown',
        }
    }
  }

  /**
   * Normaliza número de telefone
   */
  private normalizePhoneNumber(phone: string): string {
    const countryCode = '55'
    let formatted = phone

    // Remove código do país se presente
    if (formatted.startsWith(countryCode)) {
      formatted = formatted.substring(countryCode.length)
    }

    // Pega DDD (2 primeiros dígitos)
    const areaCode = formatted.substring(0, 2)
    let number = formatted.substring(2)

    // Adiciona 9 se necessário (celular sem 9)
    if (number.length === 8 && /^[987]/.test(number)) {
      number = '9' + number
    }

    return countryCode + areaCode + number
  }

  /**
   * Helper: extensão por tipo
   */
  private getExtensionFromType(type: string): string {
    const extensions: Record<string, string> = {
      image: 'jpg',
      document: 'pdf',
      audio: 'mp3',
      video: 'mp4',
    }
    return extensions[type] || 'bin'
  }

  /**
   * Helper: mime type por tipo
   */
  private getMimeTypeFromType(type: string): string {
    const mimeTypes: Record<string, string> = {
      image: 'image/jpeg',
      document: 'application/pdf',
      audio: 'audio/mpeg',
      video: 'video/mp4',
    }
    return mimeTypes[type] || 'application/octet-stream'
  }

  /**
   * Retorna configuração atual
   */
  public getConfig(): Readonly<MetaConfig> {
    return { ...this.defaultConfig }
  }
}

export default MetaManager.getInstance()
