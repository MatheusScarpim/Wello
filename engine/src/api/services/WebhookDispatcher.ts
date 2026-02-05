import axios, { AxiosError } from 'axios'
import crypto from 'crypto'

import {
  WebhookDocument,
  WebhookRepository,
} from '../repositories/WebhookRepository'

/**
 * Payload do webhook
 */
export interface WebhookPayload {
  event: string
  data: any
  timestamp: string
  id: string
}

/**
 * Resultado do disparo de webhook
 */
export interface WebhookDispatchResult {
  webhookId: string
  success: boolean
  statusCode?: number
  error?: string
  attempt: number
  duration: number
}

/**
 * Serviço responsável por disparar webhooks
 */
export class WebhookDispatcher {
  private repository: WebhookRepository

  constructor() {
    this.repository = new WebhookRepository()
  }

  /**
   * Gera assinatura HMAC para o payload
   */
  private generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex')
  }

  /**
   * Dispara um único webhook
   */
  private async dispatchSingle(
    webhook: WebhookDocument,
    payload: WebhookPayload,
    attempt: number = 1,
  ): Promise<WebhookDispatchResult> {
    const startTime = Date.now()

    try {
      const payloadString = JSON.stringify(payload)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': payload.event,
        'X-Webhook-ID': payload.id,
        'X-Webhook-Timestamp': payload.timestamp,
        'User-Agent': 'NxZap-Webhook/1.0',
        ...webhook.headers,
      }

      // Adiciona assinatura se houver secret configurado
      if (webhook.secret) {
        const signature = this.generateSignature(payloadString, webhook.secret)
        headers['X-Webhook-Signature'] = `sha256=${signature}`
      }

      const response = await axios.post(webhook.url, payloadString, {
        headers,
        timeout: 5000, // 5 segundos - timeout curto para não travar
        validateStatus: (status) => status >= 200 && status < 300,
      })

      const duration = Date.now() - startTime

      // Atualiza estatísticas de sucesso
      await this.repository.updateSendStats(webhook._id.toString(), true)

      return {
        webhookId: webhook._id.toString(),
        success: true,
        statusCode: response.status,
        attempt,
        duration,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const axiosError = error as AxiosError

      let statusCode: number | undefined
      let errorMessage: string

      if (axiosError.response) {
        // Servidor respondeu com erro
        statusCode = axiosError.response.status
        errorMessage = `HTTP ${statusCode}: ${axiosError.response.statusText}`
      } else if (axiosError.request) {
        // Requisição foi feita mas não houve resposta
        errorMessage = 'Sem resposta do servidor'
      } else {
        // Erro ao configurar requisição
        errorMessage = axiosError.message || 'Erro desconhecido'
      }

      // Se ainda há tentativas restantes, tenta novamente
      if (attempt < webhook.retryAttempts) {
        console.log(
          `⚠️  Webhook ${webhook._id} falhou (tentativa ${attempt}/${webhook.retryAttempts}). Tentando novamente em ${webhook.retryDelay}ms...`,
        )

        // Aguarda o delay configurado
        await new Promise((resolve) => setTimeout(resolve, webhook.retryDelay))

        // Tenta novamente
        return this.dispatchSingle(webhook, payload, attempt + 1)
      }

      // Atualiza estatísticas de falha
      await this.repository.updateSendStats(webhook._id.toString(), false)

      return {
        webhookId: webhook._id.toString(),
        success: false,
        statusCode,
        error: errorMessage,
        attempt,
        duration,
      }
    }
  }

  /**
   * Dispara webhooks para um evento específico
   */
  async dispatch(event: string, data: any): Promise<WebhookDispatchResult[]> {
    try {
      // Busca webhooks ativos que escutam este evento
      const webhooks = await this.repository.findByEvent(event)

      if (webhooks.length === 0) {
        console.log(
          `ℹ️  Nenhum webhook ativo encontrado para o evento: ${event}`,
        )
        return []
      }

      console.log(
        `📤 Disparando ${webhooks.length} webhook(s) para o evento: ${event}`,
      )

      // Cria o payload
      const payload: WebhookPayload = {
        event,
        data,
        timestamp: new Date().toISOString(),
        id: crypto.randomUUID(),
      }

      // Dispara todos os webhooks em paralelo
      const results = await Promise.all(
        webhooks.map((webhook) => this.dispatchSingle(webhook, payload)),
      )

      // Log dos resultados
      const successCount = results.filter((r) => r.success).length
      const failCount = results.filter((r) => !r.success).length

      console.log(
        `✅ Webhooks disparados: ${successCount} sucesso(s), ${failCount} falha(s)`,
      )

      return results
    } catch (error) {
      console.error('❌ Erro ao disparar webhooks:', error)
      return []
    }
  }

  /**
   * Testa um webhook específico
   */
  async testWebhook(webhookId: string): Promise<WebhookDispatchResult> {
    const webhook = await this.repository.findById(webhookId)

    if (!webhook) {
      throw new Error('Webhook não encontrado')
    }

    if (!webhook.enabled) {
      throw new Error('Webhook está desativado')
    }

    const payload: WebhookPayload = {
      event: 'webhook.test',
      data: {
        message: 'Este é um teste de webhook',
        webhookId: webhook._id.toString(),
        webhookName: webhook.name,
      },
      timestamp: new Date().toISOString(),
      id: crypto.randomUUID(),
    }

    return this.dispatchSingle(webhook, payload)
  }

  /**
   * Dispara múltiplos eventos em lote (útil para processamento bulk)
   */
  async dispatchBatch(
    events: Array<{ event: string; data: any }>,
  ): Promise<Map<string, WebhookDispatchResult[]>> {
    const results = new Map<string, WebhookDispatchResult[]>()

    for (const { event, data } of events) {
      const eventResults = await this.dispatch(event, data)
      results.set(event, eventResults)
    }

    return results
  }
}

/**
 * Instância singleton do dispatcher
 */
export const webhookDispatcher = new WebhookDispatcher()
