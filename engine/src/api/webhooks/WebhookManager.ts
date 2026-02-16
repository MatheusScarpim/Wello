import axios from 'axios'

/**
 * Payload do webhook
 */
export interface WebhookPayload {
  event: string
  data: any
  timestamp: Date
}

/**
 * Configuração de webhook
 */
export interface WebhookConfig {
  url: string
  events: string[]
  enabled: boolean
  retries?: number
  timeout?: number
}

/**
 * Gerenciador de webhooks
 */
export class WebhookManager {
  private static instance: WebhookManager
  private webhooks: Map<string, WebhookConfig>

  private constructor() {
    this.webhooks = new Map()
    this.loadWebhooksFromEnv()
  }

  /**
   * Retorna instância única
   */
  public static getInstance(): WebhookManager {
    if (!WebhookManager.instance) {
      WebhookManager.instance = new WebhookManager()
    }
    return WebhookManager.instance
  }

  /**
   * Carrega webhooks das variáveis de ambiente
   */
  private loadWebhooksFromEnv(): void {
    const webhookUrl = process.env.WEBHOOK_URL
    const webhookEvents =
      process.env.WEBHOOK_EVENTS || 'message,status,connection'

    if (webhookUrl) {
      this.registerWebhook('default', {
        url: webhookUrl,
        events: webhookEvents.split(',').map((e) => e.trim()),
        enabled: true,
        retries: 3,
        timeout: 10000,
      })
    }
  }

  /**
   * Registra um webhook
   */
  public registerWebhook(id: string, config: WebhookConfig): void {
    this.webhooks.set(id, config)
    console.log(`🔔 Webhook registrado: ${id} -> ${config.url}`)
  }

  /**
   * Remove um webhook
   */
  public unregisterWebhook(id: string): void {
    this.webhooks.delete(id)
    console.log(`🔕 Webhook removido: ${id}`)
  }

  /**
   * Dispara evento para webhooks
   */
  public async trigger(event: string, data: any): Promise<void> {
    const payload: WebhookPayload = {
      event,
      data,
      timestamp: new Date(),
    }

    const webhooks = Array.from(this.webhooks.entries()).filter(
      ([_, config]) => config.enabled && config.events.includes(event),
    )

    if (webhooks.length === 0) {
      return
    }

    console.log(
      `📤 Disparando webhook: ${event} para ${webhooks.length} destino(s)`,
    )

    // Dispara todos em paralelo
    await Promise.allSettled(
      webhooks.map(([id, config]) => this.sendWebhook(id, config, payload)),
    )
  }

  /**
   * Envia webhook com retry
   */
  private async sendWebhook(
    id: string,
    config: WebhookConfig,
    payload: WebhookPayload,
    attempt: number = 1,
  ): Promise<void> {
    const maxRetries = config.retries || 3

    try {
      await axios.post(config.url, payload, {
        timeout: config.timeout || 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ScarlatChat-Webhook/2.0',
        },
      })

      console.log(`✅ Webhook enviado: ${id} (${payload.event})`)
    } catch (error: any) {
      console.error(`❌ Erro ao enviar webhook ${id}:`, error.message)

      // Retry se não atingiu o máximo
      if (attempt < maxRetries) {
        console.log(`🔄 Tentando novamente (${attempt + 1}/${maxRetries})...`)
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)) // Backoff
        await this.sendWebhook(id, config, payload, attempt + 1)
      }
    }
  }

  /**
   * Lista webhooks registrados
   */
  public listWebhooks(): Array<{ id: string; config: WebhookConfig }> {
    return Array.from(this.webhooks.entries()).map(([id, config]) => ({
      id,
      config,
    }))
  }

  /**
   * Ativa/desativa webhook
   */
  public toggleWebhook(id: string, enabled: boolean): boolean {
    const webhook = this.webhooks.get(id)
    if (!webhook) return false

    webhook.enabled = enabled
    console.log(
      `${enabled ? '✅' : '⏸️ '} Webhook ${id} ${enabled ? 'ativado' : 'desativado'}`,
    )
    return true
  }
}

export default WebhookManager.getInstance()
