import axios, { AxiosInstance } from 'axios'
import EventEmitter from 'events'

export interface InstagramConfig {
  accessToken: string
  instagramAccountId: string
  apiVersion?: string
  baseUrl?: string
}

export interface InstagramIncomingMessage {
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
  _sessionName?: string
  _instanceName?: string
}

export interface InstagramValidationResult {
  valid: boolean
  accountId?: string
  username?: string
  error?: string
}

export class InstagramManager extends EventEmitter {
  private static instance: InstagramManager
  private defaultConfig: InstagramConfig
  private defaultAxiosInstance: AxiosInstance
  private isDefaultEnabled: boolean

  private constructor() {
    super()

    this.defaultConfig = {
      accessToken: process.env.INSTAGRAM_ACCESS_TOKEN || '',
      instagramAccountId: process.env.INSTAGRAM_ACCOUNT_ID || '',
      apiVersion: process.env.INSTAGRAM_API_VERSION || 'v22.0',
      baseUrl: process.env.INSTAGRAM_BASE_URL || 'https://graph.instagram.com',
    }

    this.isDefaultEnabled =
      !!this.defaultConfig.accessToken && !!this.defaultConfig.instagramAccountId

    this.defaultAxiosInstance = this.createAxiosInstance(this.defaultConfig)
  }

  public static getInstance(): InstagramManager {
    if (!InstagramManager.instance) {
      InstagramManager.instance = new InstagramManager()
    }
    return InstagramManager.instance
  }

  public getIsEnabled(): boolean {
    return this.isDefaultEnabled
  }

  private createAxiosInstance(config: InstagramConfig): AxiosInstance {
    return axios.create({
      baseURL: `${config.baseUrl}/${config.apiVersion}`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
      },
      timeout: 30000,
    })
  }

  private getConfigAndInstance(customConfig?: Partial<InstagramConfig>): {
    config: InstagramConfig
    axiosInstance: AxiosInstance
  } {
    if (customConfig) {
      const config: InstagramConfig = {
        accessToken: customConfig.accessToken || this.defaultConfig.accessToken,
        instagramAccountId:
          customConfig.instagramAccountId || this.defaultConfig.instagramAccountId,
        apiVersion: customConfig.apiVersion || this.defaultConfig.apiVersion,
        baseUrl: customConfig.baseUrl || this.defaultConfig.baseUrl,
      }

      return {
        config,
        axiosInstance: this.createAxiosInstance(config),
      }
    }

    return {
      config: this.defaultConfig,
      axiosInstance: this.defaultAxiosInstance,
    }
  }

  public async sendText(
    to: string,
    message: string,
    customConfig?: Partial<InstagramConfig>,
  ): Promise<{ idMessage: string }> {
    const { config, axiosInstance } = this.getConfigAndInstance(customConfig)

    const response = await axiosInstance.post(`/${config.instagramAccountId}/messages`, {
      recipient: { id: to },
      message: { text: message },
    })

    return {
      idMessage: response.data?.message_id || response.data?.id || '',
    }
  }

  public async sendMedia(
    to: string,
    mediaType: 'image' | 'video',
    mediaUrl: string,
    customConfig?: Partial<InstagramConfig>,
  ): Promise<{ idMessage: string }> {
    const { config, axiosInstance } = this.getConfigAndInstance(customConfig)

    const response = await axiosInstance.post(`/${config.instagramAccountId}/messages`, {
      recipient: { id: to },
      message: {
        attachment: {
          type: mediaType,
          payload: {
            url: mediaUrl,
            is_reusable: false,
          },
        },
      },
    })

    return {
      idMessage: response.data?.message_id || response.data?.id || '',
    }
  }

  public async processWebhookMessage(
    messagingEntry: any,
    context?: { sessionName?: string; instanceName?: string },
  ): Promise<InstagramIncomingMessage | null> {
    try {
      if (!messagingEntry?.sender?.id || !messagingEntry?.message?.mid) {
        return null
      }

      const senderId = String(messagingEntry.sender.id)
      const recipientId = String(messagingEntry.recipient?.id || '')
      const messageObject = messagingEntry.message || {}

      const text = typeof messageObject.text === 'string' ? messageObject.text : ''
      const attachment = Array.isArray(messageObject.attachments)
        ? messageObject.attachments[0]
        : null

      const attachmentType = attachment?.type
      const attachmentUrl = attachment?.payload?.url

      const normalizedType =
        text
          ? 'text'
          : attachmentType === 'image'
            ? 'image'
            : attachmentType === 'video'
              ? 'video'
              : attachmentType === 'audio'
                ? 'audio'
                : attachmentType === 'file'
                  ? 'document'
                  : 'unknown'

      return {
        identifier: senderId,
        message: text,
        idMessage: messageObject.mid,
        quotedMsg: messageObject.reply_to?.mid,
        name: senderId,
        provider: 'instagram',
        identifierProvider: recipientId || undefined,
        type: normalizedType,
        mediaUrl: attachmentUrl,
        _sessionName: context?.sessionName,
        _instanceName: context?.instanceName,
      }
    } catch (error) {
      console.error('Erro ao processar webhook do Instagram:', error)
      return null
    }
  }

  public async validateCredentials(
    customConfig?: Partial<InstagramConfig>,
  ): Promise<InstagramValidationResult> {
    try {
      const { config, axiosInstance } = this.getConfigAndInstance(customConfig)
      if (!config.accessToken || !config.instagramAccountId) {
        return {
          valid: false,
          error: 'Credenciais incompletas (accessToken e instagramAccountId)',
        }
      }

      const response = await axiosInstance.get(`/${config.instagramAccountId}`, {
        params: {
          fields: 'id,username',
        },
      })

      return {
        valid: true,
        accountId: response.data?.id || config.instagramAccountId,
        username: response.data?.username,
      }
    } catch (error: any) {
      const apiMessage =
        error?.response?.data?.error?.message || error?.message || 'Erro desconhecido'
      return {
        valid: false,
        error: apiMessage,
      }
    }
  }

  public getConfig(): Readonly<InstagramConfig> {
    return { ...this.defaultConfig }
  }
}

export default InstagramManager.getInstance()
