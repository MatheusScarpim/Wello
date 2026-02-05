import { Request, Response } from 'express'

import { ConversationService } from '../services/ConversationService'
import { BaseController } from './BaseController'

/**
 * Controller para gerenciamento de conversas
 */
export class ConversationController extends BaseController {
  private conversationService: ConversationService

  constructor() {
    super()
    this.conversationService = new ConversationService()
  }

  /**
   * Lista todas as conversas
   * POST /api/conversations/list
   * GET /api/conversations
   */
  public listConversations = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { page, limit } = this.getPagination(req)
      const authUser = (req as any).user as
        | { userId?: string; role?: string }
        | undefined
      const extractString = (value: unknown): string | undefined => {
        if (typeof value === 'string') {
          return value
        }
        if (
          Array.isArray(value) &&
          value.length > 0 &&
          typeof value[0] === 'string'
        ) {
          return value[0]
        }
        return undefined
      }

      const source: any = req.method === 'GET' ? req.query : req.body || {}
      const status = extractString(source?.status)
      const search = extractString(source?.search)
      const parseBooleanParam = (value: unknown): boolean | undefined => {
        if (typeof value === 'boolean') {
          return value
        }
        if (typeof value === 'string') {
          if (value === 'true' || value === '1') return true
          if (value === 'false' || value === '0') return false
        }
        return undefined
      }
      const archived = parseBooleanParam(source?.archived)

      // Admin e Operator veem apenas suas próprias conversas não arquivadas
      if (
        (authUser?.role === 'operator' || authUser?.role === 'admin') &&
        authUser.userId
      ) {
        const result = await this.conversationService.paginateConversations(
          {
            status,
            search,
            operatorId: authUser.userId,
            archived: archived ?? false, // Por padrão, não mostra conversas finalizadas
          },
          page,
          limit,
        )

        this.sendSuccess(res, result, 'Conversas recuperadas com sucesso')
        return
      }

      // Apenas supervisor vê todas as conversas
      const result = await this.conversationService.getConversations({
        page,
        limit,
        status,
        search,
        archived,
      })

      this.sendSuccess(res, result, 'Conversas recuperadas com sucesso')
    },
  )

  /**
   * Busca uma conversa específica
   * GET /api/conversations/:id
   */
  public getConversation = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params
      const authUser = (req as any).user as
        | { userId?: string; role?: string }
        | undefined

      if (!id) {
        return this.sendError(res, 'ID da conversa é obrigatório', 400)
      }

      const conversation =
        await this.conversationService.getConversationById(id)

      if (!conversation) {
        return this.sendError(res, 'Conversa não encontrada', 404)
      }

      if (
        authUser?.role === 'operator' &&
        authUser.userId &&
        conversation.operatorId !== authUser.userId
      ) {
        return this.sendError(res, 'Acesso negado', 403)
      }

      this.sendSuccess(res, conversation, 'Conversa encontrada')
    },
  )

  /**
   * Cria uma nova conversa
   * POST /api/conversations/create
   */
  public createConversation = this.asyncHandler(
    async (req: Request, res: Response) => {
      const validation = this.validateRequiredFields(req.body, [
        'identifier',
        'provider',
      ])

      if (!validation.valid) {
        return this.sendError(res, 'Campos obrigatórios faltando', 400, {
          missing: validation.missing,
        })
      }

      const {
        identifier,
        provider,
        name,
        photo,
        instanceId,
        sessionName,
        instanceName,
        contactId,
        suppressWelcomeMessage,
      } = req.body

      const conversation = await this.conversationService.createConversation({
        identifier,
        provider,
        name,
        photo,
        instanceId,
        sessionName,
        instanceName,
        contactId,
        suppressWelcomeMessage,
      })

      this.sendSuccess(res, conversation, 'Conversa criada com sucesso', 201)
    },
  )

  /**
   * Atualiza uma conversa
   * PUT /api/conversations/:id
   */
  public updateConversation = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params
      const updates = req.body
      const authUser = (req as any).user as
        | { userId?: string; role?: string }
        | undefined

      if (!id) {
        return this.sendError(res, 'ID da conversa é obrigatório', 400)
      }

      if (authUser?.role === 'operator' && authUser.userId) {
        const conversation =
          await this.conversationService.getConversationById(id)
        if (!conversation) {
          return this.sendError(res, 'Conversa não encontrada', 404)
        }
        if (conversation.operatorId !== authUser.userId) {
          return this.sendError(res, 'Acesso negado', 403)
        }
      }

      const updated = await this.conversationService.updateConversation(
        id,
        updates,
      )

      if (!updated) {
        return this.sendError(
          res,
          'Conversa não encontrada ou não atualizada',
          404,
        )
      }

      this.sendSuccess(res, null, 'Conversa atualizada com sucesso')
    },
  )

  /**
   * Busca conversas com paginação
   * POST /api/conversations/paginate
   */
  public paginateConversations = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { page, limit } = this.getPagination(req)
      const filters = req.body
      const authUser = (req as any).user as
        | { userId?: string; role?: string }
        | undefined

      // Admin e Operator veem apenas suas próprias conversas não arquivadas
      if (
        (authUser?.role === 'operator' || authUser?.role === 'admin') &&
        authUser.userId
      ) {
        filters.operatorId = authUser.userId
        // Por padrão, não mostra conversas finalizadas
        if (filters.archived === undefined) {
          filters.archived = false
        }
      }

      const result = await this.conversationService.paginateConversations(
        filters,
        page,
        limit,
      )

      this.sendSuccess(res, result)
    },
  )

  /**
   * Arquiva uma conversa
   * PATCH /api/conversations/:id/archive
   */
  public archiveConversation = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params
      const authUser = (req as any).user as
        | { userId?: string; role?: string }
        | undefined

      if (!id) {
        return this.sendError(res, 'ID da conversa é obrigatório', 400)
      }

      if (authUser?.role === 'operator' && authUser.userId) {
        const conversation =
          await this.conversationService.getConversationById(id)
        if (!conversation) {
          return this.sendError(res, 'Conversa não encontrada', 404)
        }
        if (conversation.operatorId !== authUser.userId) {
          return this.sendError(res, 'Acesso negado', 403)
        }
      }

      const archived = await this.conversationService.archiveConversation(id)

      if (!archived) {
        return this.sendError(res, 'Conversa não encontrada', 404)
      }

      this.sendSuccess(res, null, 'Conversa arquivada com sucesso')
    },
  )

  /**
   * Desarquiva uma conversa
   * PATCH /api/conversations/:id/unarchive
   */
  public unarchiveConversation = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params
      const authUser = (req as any).user as
        | { userId?: string; role?: string }
        | undefined

      if (!id) {
        return this.sendError(res, 'ID da conversa é obrigatório', 400)
      }

      if (authUser?.role === 'operator' && authUser.userId) {
        const conversation =
          await this.conversationService.getConversationById(id)
        if (!conversation) {
          return this.sendError(res, 'Conversa não encontrada', 404)
        }
        if (conversation.operatorId !== authUser.userId) {
          return this.sendError(res, 'Acesso negado', 403)
        }
      }

      const unarchived =
        await this.conversationService.unarchiveConversation(id)

      if (!unarchived.success) {
        if (unarchived.conflict) {
          return this.sendError(
            res,
            'Já existe outra conversa ativa com o mesmo contato',
            409,
          )
        }
        if (unarchived.finalized) {
          return this.sendError(
            res,
            'Conversa finalizada não pode ser desarquivada',
            409,
          )
        }
        return this.sendError(res, 'Conversa não encontrada', 404)
      }

      this.sendSuccess(res, null, 'Conversa desarquivada com sucesso')
    },
  )

  /**
   * Atribui operador a uma conversa
   * PATCH /api/conversations/:id/assign-operator
   */
  public assignOperator = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params
      const { operatorId, operatorName, suppressAutomaticMessage } = req.body
      const authUser = (req as any).user as
        | { userId?: string; role?: string }
        | undefined

      if (authUser?.role === 'operator') {
        return this.sendError(
          res,
          'Apenas supervisores/administradores podem atribuir conversas',
          403,
        )
      }

      const validation = this.validateRequiredFields(req.body, ['operatorId'])

      if (!validation.valid) {
        return this.sendError(res, 'Campo operatorId é obrigatório', 400)
      }

      const assigned = await this.conversationService.assignOperator(
        id,
        operatorId,
        operatorName,
        { suppressAutomaticMessage: Boolean(suppressAutomaticMessage) },
      )

      if (!assigned) {
        return this.sendError(res, 'Conversa não encontrada', 404)
      }

      this.sendSuccess(res, null, 'Operador atribuído com sucesso')
    },
  )
}
