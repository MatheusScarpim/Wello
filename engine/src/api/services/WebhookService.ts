import { ObjectId } from 'mongodb'

import {
  WebhookDocument,
  WebhookRepository,
} from '../repositories/WebhookRepository'

/**
 * Parâmetros para criação de webhook
 */
export interface CreateWebhookParams {
  name: string
  url: string
  events: string[]
  enabled?: boolean
  secret?: string
  headers?: Record<string, string>
  retryAttempts?: number
  retryDelay?: number
}

/**
 * Parâmetros para atualização de webhook
 */
export interface UpdateWebhookParams {
  name?: string
  url?: string
  events?: string[]
  enabled?: boolean
  secret?: string
  headers?: Record<string, string>
  retryAttempts?: number
  retryDelay?: number
}

/**
 * Filtros para busca de webhooks
 */
export interface WebhookFilters {
  enabled?: boolean
  event?: string
  search?: string
}

/**
 * Service para lógica de negócios de webhooks
 */
export class WebhookService {
  private repository: WebhookRepository

  constructor() {
    this.repository = new WebhookRepository()
  }

  private formatPaginatedResult<T>(result: {
    data: T[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }) {
    return {
      items: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
    }
  }

  /**
   * Valida URL do webhook
   */
  private validateUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }

  /**
   * Valida eventos
   */
  private validateEvents(events: string[]): boolean {
    const validEvents = [
      'message.received',
      'message.sent',
      'message.failed',
      'conversation.created',
      'conversation.updated',
      'conversation.archived',
      'conversation.deleted',
      'operator.assigned',
      'operator.removed',
      'bot.started',
      'bot.stopped',
      'queue.updated',
    ]

    return events.every((event) => validEvents.includes(event))
  }

  /**
   * Lista webhooks com filtros e paginação
   */
  async getWebhooks(params: {
    page: number
    limit: number
    enabled?: boolean
    event?: string
    search?: string
  }) {
    const { page, limit, enabled, event, search } = params
    const filter: any = {}

    if (enabled !== undefined) {
      filter.enabled = enabled
    }

    if (event) {
      filter.events = { $in: [event] }
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { url: { $regex: search, $options: 'i' } },
      ]
    }

    const result = await this.repository.paginate(filter, page, limit)
    return this.formatPaginatedResult(result)
  }

  /**
   * Busca webhook por ID
   */
  async getWebhookById(id: string): Promise<WebhookDocument | null> {
    return await this.repository.findById(id)
  }

  /**
   * Cria um novo webhook
   */
  async createWebhook(params: CreateWebhookParams): Promise<{
    success: boolean
    webhook?: WebhookDocument
    error?: string
  }> {
    const {
      name,
      url,
      events,
      enabled = true,
      secret,
      headers,
      retryAttempts = 1,
      retryDelay = 500,
    } = params

    // Validações
    if (!name || name.trim().length === 0) {
      return { success: false, error: 'Nome é obrigatório' }
    }

    if (!url || !this.validateUrl(url)) {
      return { success: false, error: 'URL inválida' }
    }

    if (!events || events.length === 0) {
      return { success: false, error: 'Pelo menos um evento é obrigatório' }
    }

    if (!this.validateEvents(events)) {
      return { success: false, error: 'Um ou mais eventos são inválidos' }
    }

    // Verifica se já existe webhook com a mesma URL
    const existing = await this.repository.findByUrl(url)
    if (existing) {
      return {
        success: false,
        error: 'Já existe um webhook cadastrado com esta URL',
      }
    }

    const now = new Date()

    const webhook = await this.repository.create({
      name: name.trim(),
      url,
      events,
      enabled,
      secret,
      headers,
      retryAttempts,
      retryDelay,
      createdAt: now,
      updatedAt: now,
      totalSent: 0,
      totalFailed: 0,
    } as any)

    return { success: true, webhook }
  }

  /**
   * Atualiza webhook
   */
  async updateWebhook(
    id: string,
    params: UpdateWebhookParams,
  ): Promise<{ success: boolean; error?: string }> {
    const webhook = await this.repository.findById(id)
    if (!webhook) {
      return { success: false, error: 'Webhook não encontrado' }
    }

    const updates: any = {}

    if (params.name !== undefined) {
      if (params.name.trim().length === 0) {
        return { success: false, error: 'Nome não pode ser vazio' }
      }
      updates.name = params.name.trim()
    }

    if (params.url !== undefined) {
      if (!this.validateUrl(params.url)) {
        return { success: false, error: 'URL inválida' }
      }

      // Verifica se já existe outro webhook com a mesma URL
      if (params.url !== webhook.url) {
        const existing = await this.repository.findByUrl(params.url)
        if (existing && existing._id.toString() !== id) {
          return {
            success: false,
            error: 'Já existe um webhook cadastrado com esta URL',
          }
        }
      }

      updates.url = params.url
    }

    if (params.events !== undefined) {
      if (params.events.length === 0) {
        return { success: false, error: 'Pelo menos um evento é obrigatório' }
      }
      if (!this.validateEvents(params.events)) {
        return { success: false, error: 'Um ou mais eventos são inválidos' }
      }
      updates.events = params.events
    }

    if (params.enabled !== undefined) {
      updates.enabled = params.enabled
    }

    if (params.secret !== undefined) {
      updates.secret = params.secret
    }

    if (params.headers !== undefined) {
      updates.headers = params.headers
    }

    if (params.retryAttempts !== undefined) {
      updates.retryAttempts = params.retryAttempts
    }

    if (params.retryDelay !== undefined) {
      updates.retryDelay = params.retryDelay
    }

    updates.updatedAt = new Date()

    await this.repository.updateOne({ _id: new ObjectId(id) } as any, {
      $set: updates,
    })

    return { success: true }
  }

  /**
   * Deleta webhook
   */
  async deleteWebhook(
    id: string,
  ): Promise<{ success: boolean; error?: string }> {
    const webhook = await this.repository.findById(id)
    if (!webhook) {
      return { success: false, error: 'Webhook não encontrado' }
    }

    await this.repository.deleteOne({ _id: new ObjectId(id) } as any)
    return { success: true }
  }

  /**
   * Ativa webhook
   */
  async enableWebhook(
    id: string,
  ): Promise<{ success: boolean; error?: string }> {
    const webhook = await this.repository.findById(id)
    if (!webhook) {
      return { success: false, error: 'Webhook não encontrado' }
    }

    await this.repository.updateOne({ _id: new ObjectId(id) } as any, {
      $set: { enabled: true, updatedAt: new Date() },
    })

    return { success: true }
  }

  /**
   * Desativa webhook
   */
  async disableWebhook(
    id: string,
  ): Promise<{ success: boolean; error?: string }> {
    const webhook = await this.repository.findById(id)
    if (!webhook) {
      return { success: false, error: 'Webhook não encontrado' }
    }

    await this.repository.updateOne({ _id: new ObjectId(id) } as any, {
      $set: { enabled: false, updatedAt: new Date() },
    })

    return { success: true }
  }

  /**
   * Busca webhooks ativos por evento
   */
  async getActiveWebhooksByEvent(event: string): Promise<WebhookDocument[]> {
    return await this.repository.findByEvent(event)
  }

  /**
   * Estatísticas de webhooks
   */
  async getStats() {
    const [total, enabled, disabled] = await Promise.all([
      this.repository.count(),
      this.repository.count({ enabled: true }),
      this.repository.count({ enabled: false }),
    ])

    return {
      total,
      enabled,
      disabled,
    }
  }

  /**
   * Lista eventos disponíveis
   */
  getAvailableEvents(): string[] {
    return [
      'message.received',
      'message.sent',
      'message.failed',
      'conversation.created',
      'conversation.updated',
      'conversation.archived',
      'conversation.deleted',
      'operator.assigned',
      'operator.removed',
      'bot.started',
      'bot.stopped',
      'queue.updated',
    ]
  }
}
