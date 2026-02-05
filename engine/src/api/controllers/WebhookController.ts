import { Request, Response } from 'express'

import { WebhookDispatcher } from '../services/WebhookDispatcher'
import { WebhookService } from '../services/WebhookService'
import { BaseController } from './BaseController'

/**
 * Controller para gerenciamento de webhooks
 */
export class WebhookController extends BaseController {
  private service: WebhookService
  private dispatcher: WebhookDispatcher

  constructor() {
    super()
    this.service = new WebhookService()
    this.dispatcher = new WebhookDispatcher()
  }

  /**
   * Lista webhooks com filtros e paginação
   * GET /api/webhooks
   */
  list = this.asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = this.getPagination(req)
    const enabled = this.getQueryParamAsBoolean(req, 'enabled')
    const event = this.getQueryParam(req, 'event')
    const search = this.getQueryParam(req, 'search')

    const result = await this.service.getWebhooks({
      page,
      limit,
      enabled,
      event,
      search,
    })

    this.sendSuccess(res, result)
  })

  /**
   * Busca webhook por ID
   * GET /api/webhooks/:id
   */
  getById = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    if (!id) {
      return this.sendError(res, 'ID é obrigatório', 400)
    }

    const webhook = await this.service.getWebhookById(id)

    if (!webhook) {
      return this.sendError(res, 'Webhook não encontrado', 404)
    }

    this.sendSuccess(res, webhook)
  })

  /**
   * Cria um novo webhook
   * POST /api/webhooks
   */
  create = this.asyncHandler(async (req: Request, res: Response) => {
    const validation = this.validateRequiredFields(req.body, [
      'name',
      'url',
      'events',
    ])

    if (!validation.valid) {
      return this.sendError(res, 'Campos obrigatórios faltando', 400, {
        missing: validation.missing,
      })
    }

    const {
      name,
      url,
      events,
      enabled,
      secret,
      headers,
      retryAttempts,
      retryDelay,
    } = req.body

    const result = await this.service.createWebhook({
      name,
      url,
      events,
      enabled,
      secret,
      headers,
      retryAttempts,
      retryDelay,
    })

    if (!result.success) {
      return this.sendError(res, result.error || 'Erro ao criar webhook', 400)
    }

    this.sendSuccess(res, result.webhook, 'Webhook criado com sucesso', 201)
  })

  /**
   * Atualiza webhook
   * PUT /api/webhooks/:id
   */
  update = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    if (!id) {
      return this.sendError(res, 'ID é obrigatório', 400)
    }

    const {
      name,
      url,
      events,
      enabled,
      secret,
      headers,
      retryAttempts,
      retryDelay,
    } = req.body

    const result = await this.service.updateWebhook(id, {
      name,
      url,
      events,
      enabled,
      secret,
      headers,
      retryAttempts,
      retryDelay,
    })

    if (!result.success) {
      return this.sendError(
        res,
        result.error || 'Erro ao atualizar webhook',
        400,
      )
    }

    this.sendSuccess(res, undefined, 'Webhook atualizado com sucesso')
  })

  /**
   * Deleta webhook
   * DELETE /api/webhooks/:id
   */
  delete = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    if (!id) {
      return this.sendError(res, 'ID é obrigatório', 400)
    }

    const result = await this.service.deleteWebhook(id)

    if (!result.success) {
      return this.sendError(res, result.error || 'Erro ao deletar webhook', 400)
    }

    this.sendSuccess(res, undefined, 'Webhook deletado com sucesso')
  })

  /**
   * Ativa webhook
   * POST /api/webhooks/:id/enable
   */
  enable = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    if (!id) {
      return this.sendError(res, 'ID é obrigatório', 400)
    }

    const result = await this.service.enableWebhook(id)

    if (!result.success) {
      return this.sendError(res, result.error || 'Erro ao ativar webhook', 400)
    }

    this.sendSuccess(res, undefined, 'Webhook ativado com sucesso')
  })

  /**
   * Desativa webhook
   * POST /api/webhooks/:id/disable
   */
  disable = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    if (!id) {
      return this.sendError(res, 'ID é obrigatório', 400)
    }

    const result = await this.service.disableWebhook(id)

    if (!result.success) {
      return this.sendError(
        res,
        result.error || 'Erro ao desativar webhook',
        400,
      )
    }

    this.sendSuccess(res, undefined, 'Webhook desativado com sucesso')
  })

  /**
   * Obtém estatísticas de webhooks
   * GET /api/webhooks/stats
   */
  getStats = this.asyncHandler(async (req: Request, res: Response) => {
    const stats = await this.service.getStats()
    this.sendSuccess(res, stats)
  })

  /**
   * Lista eventos disponíveis
   * GET /api/webhooks/events
   */
  listEvents = this.asyncHandler(async (req: Request, res: Response) => {
    const events = this.service.getAvailableEvents()
    this.sendSuccess(res, { events })
  })

  /**
   * Testa um webhook específico
   * POST /api/webhooks/:id/test
   */
  test = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    if (!id) {
      return this.sendError(res, 'ID é obrigatório', 400)
    }

    try {
      const result = await this.dispatcher.testWebhook(id)

      if (result.success) {
        this.sendSuccess(res, result, 'Webhook testado com sucesso')
      } else {
        this.sendError(
          res,
          `Erro ao testar webhook: ${result.error}`,
          400,
          result,
        )
      }
    } catch (error) {
      const err = error as Error
      this.sendError(res, err.message, 400)
    }
  })
}
