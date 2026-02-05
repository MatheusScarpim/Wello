import { Request, Response } from 'express'
import { ObjectId } from 'mongodb'

import conversationRepository from '../repositories/ConversationRepository'
import departmentRepository from '../repositories/DepartmentRepository'
import messageRepository from '../repositories/MessageRepository'
import operatorRepository from '../repositories/OperatorRepository'
import type { QueueStatus } from '../repositories/QueueRepository'
import { ConversationService } from '../services/ConversationService'
import finalizationService from '../services/FinalizationService'
import { webhookDispatcher } from '../services/WebhookDispatcher'
import { BaseController } from './BaseController'

class QueueController extends BaseController {
  private conversationService = new ConversationService()
  private queueWebhookTimers = new Map<string, NodeJS.Timeout>()
  private readonly queueWebhookDelayMs = 800

  private getQueueStatus(conversation: any): QueueStatus {
    if (conversation.archived || conversation.status === 'finalized')
      return 'resolved'
    if (conversation.operatorId) return 'in_progress'
    return 'waiting'
  }

  private buildQueueItem(
    conversation: any,
    operator: any | null,
    now: number = Date.now(),
  ) {
    const status = this.getQueueStatus(conversation)
    const createdAt = conversation.createdAt
      ? new Date(conversation.createdAt)
      : new Date()
    const waitTime = Math.max(
      0,
      Math.floor((now - createdAt.getTime()) / 1000),
    )
    const offerRemainingSeconds = conversation.offerExpiresAt
      ? Math.max(
          0,
          Math.round(
            (new Date(conversation.offerExpiresAt).getTime() - now) / 1000,
          ),
        )
      : undefined

    return {
      _id: conversation._id?.toString(),
      conversation,
      departmentId: conversation.departmentId,
      operatorId: conversation.operatorId,
      operator: operator ? { ...operator, password: undefined } : null,
      status,
      priority: conversation.priority ?? 1,
      waitTime,
      offerRemainingSeconds,
      tags: conversation.tags ?? [],
      finalizations: (() => {
        if (Array.isArray(conversation.finalizations) && conversation.finalizations.length > 0) {
          return conversation.finalizations.map((entry: any) => ({
            _id: entry.finalizationId,
            name: entry.finalizationName,
            type: entry.finalizationType,
            notes: conversation.finalizationNotes,
            finalizedAt: conversation.finalizationAt,
          }))
        }
        if (conversation.finalizationId) {
          return [
            {
              _id: conversation.finalizationId,
              name: conversation.finalizationName,
              type: conversation.finalizationType,
              notes: conversation.finalizationNotes,
              finalizedAt: conversation.finalizationAt,
            },
          ]
        }
        return []
      })(),
      finalization: (() => {
        const entries =
          Array.isArray(conversation.finalizations) && conversation.finalizations.length > 0
            ? conversation.finalizations
            : conversation.finalizationId
            ? [
                {
                  finalizationId: conversation.finalizationId,
                  finalizationName: conversation.finalizationName,
                  finalizationType: conversation.finalizationType,
                },
              ]
            : []

        if (entries.length === 0) return null

        const primary = entries[0]
        return {
          _id: primary.finalizationId,
          name: primary.finalizationName,
          type: primary.finalizationType,
          notes: conversation.finalizationNotes,
          finalizedAt: conversation.finalizationAt,
        }
      })(),
      notes: conversation.notes,
      offerOperatorId: conversation.offerOperatorId,
      offerOperatorName: conversation.offerOperatorName,
      offerExpiresAt: conversation.offerExpiresAt,
      createdAt: conversation.createdAt,
      assignedAt: conversation.assignedAt,
      resolvedAt: conversation.resolvedAt,
    }
  }

  private buildQueueEventPayload(
    conversation: any,
    operator: any | null,
    reason: string,
  ) {
    return {
      ...this.buildQueueItem(conversation, operator),
      reason,
      timestamp: new Date().toISOString(),
    }
  }

  private async dispatchQueueWebhook(
    conversation: any,
    operator: any | null,
    reason: string,
  ) {
    if (!conversation?._id) {
      return
    }
    const conversationId = conversation._id.toString()
    const existingTimer = this.queueWebhookTimers.get(conversationId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const timer = setTimeout(async () => {
      this.queueWebhookTimers.delete(conversationId)
      try {
        const payload = this.buildQueueEventPayload(conversation, operator, reason)
        await webhookDispatcher.dispatch('queue.updated', payload)
      } catch (error) {
        console.error('Erro ao disparar webhook da fila:', error)
      }
    }, this.queueWebhookDelayMs)

    this.queueWebhookTimers.set(conversationId, timer)
  }

  /**
   * Lista itens da fila (derivado de conversations)
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { status, operatorId } = req.query
      const authUser = (req as any).user as
        | { userId?: string; role?: string }
        | undefined
      const { page, limit } = this.getPagination(req)

      const filter: any = {}
      const role = authUser?.role
      const userId = authUser?.userId

      const activeCondition = {
        archived: false,
        status: { $ne: 'finalized' },
      }

      const waitingFilter = {
        ...activeCondition,
        $or: [
          { operatorId: { $exists: false } },
          { operatorId: null },
          { operatorId: '' },
        ],
      }

      const applyStatusFilter = (queueStatus?: QueueStatus) => {
        if (!queueStatus) return
        if (queueStatus === 'waiting') {
          Object.assign(filter, waitingFilter)
          return
        }
        if (queueStatus === 'resolved') {
          filter.$or = [
            { archived: true },
            { status: 'finalized' },
          ]
          return
        }
        filter.archived = false
        filter.operatorId = { $exists: true, $nin: [null, ''] }
        filter.status = { $ne: 'finalized' }
      }

      if (role === 'operator' && userId) {
        if (status) {
          if (status === 'waiting') {
            applyStatusFilter('waiting')
          } else if (status === 'resolved') {
            applyStatusFilter('resolved')
          } else {
            applyStatusFilter(status as QueueStatus)
            filter.operatorId = userId
          }
        } else {
          filter.$or = [
            waitingFilter,
            {
              archived: false,
              status: { $ne: 'finalized' },
              operatorId: userId,
            },
          ]
        }
      } else {
        applyStatusFilter(status as QueueStatus | undefined)
        if (operatorId) {
          filter.operatorId = operatorId as string
        }
      }

      const result = await conversationRepository.paginate(
        filter,
        page,
        limit,
        {
          sort: { updatedAt: -1 },
        },
      )

      const items = await Promise.all(
        result.data.map(async (conversation: any) => {
          const operator = conversation.operatorId
            ? await operatorRepository.findById(conversation.operatorId)
            : null
          return this.buildQueueItem(conversation, operator)
        }),
      )

      this.sendSuccess(res, {
        items,
        pagination: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
        },
      })
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Busca item por ID (conversationId)
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const authUser = (req as any).user as
        | { userId?: string; role?: string }
        | undefined

      if (!ObjectId.isValid(id)) {
        this.sendError(res, 'ID invalido', 400)
        return
      }

      const conversation = await conversationRepository.findById(id)
      if (!conversation) {
        this.sendError(res, 'Conversa não encontrada', 404)
        return
      }

      if (authUser?.role === 'operator' && authUser.userId) {
        const status = this.getQueueStatus(conversation)
        if (
          status !== 'waiting' &&
          conversation.operatorId !== authUser.userId
        ) {
          this.sendError(res, 'Acesso negado', 403)
          return
        }
      }

      const operator = conversation.operatorId
        ? await operatorRepository.findById(conversation.operatorId)
        : null

      this.sendSuccess(res, this.buildQueueItem(conversation, operator))
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Adiciona conversa a fila (seta como waiting)
   */
  async addToQueue(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId } = req.body

      if (!conversationId) {
        this.sendError(res, 'ID da conversa e obrigatorio', 400)
        return
      }

      const updated = await conversationRepository.updateOne(
        { _id: new ObjectId(conversationId) } as any,
        {
          $unset: { operatorId: '', operatorName: '', assignedAt: '' },
          $set: { archived: false, updatedAt: new Date() },
        },
      )

      if (!updated) {
        this.sendError(res, 'Conversa não encontrada', 404)
        return
      }

      const conversation = await conversationRepository.findById(conversationId)
      const operator = null
      setImmediate(() => {
        if (conversation) {
          this.dispatchQueueWebhook(conversation, null, 'requeued')
        }
      })
      this.sendSuccess(
        res,
        this.buildQueueItem(conversation, operator),
        'Conversa adicionada a fila',
        201,
      )
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Assume conversa
   */
  async assume(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params
      const { operatorId } = req.body
      const authUser = (req as any).user as
        | { userId?: string; role?: string }
        | undefined

      if (!conversationId) {
        this.sendError(res, 'ID da conversa e obrigatorio', 400)
        return
      }

      const operatorFromBody = operatorId || req.body.operatorId
      const actualOperatorId =
        authUser?.role === 'operator' && authUser.userId
          ? authUser.userId
          : operatorFromBody || authUser?.userId

      if (!actualOperatorId) {
        this.sendError(res, 'ID do operador e obrigatorio', 400)
        return
      }

      const conversation = await conversationRepository.findById(conversationId)
      if (!conversation) {
        this.sendError(res, 'Conversa não encontrada', 404)
        return
      }

      if (conversation.archived) {
        this.sendError(res, 'Conversa ja resolvida', 400)
        return
      }

      const now = new Date()
      const offerExpiresAt = conversation.offerExpiresAt
        ? new Date(conversation.offerExpiresAt)
        : null
      const hasActiveOffer =
        conversation.offerOperatorId &&
        (!offerExpiresAt || offerExpiresAt > now)

      if (hasActiveOffer && conversation.offerOperatorId !== actualOperatorId) {
        this.sendError(res, 'Conversa reservada para outro operador', 400)
        return
      }

      const operator = await operatorRepository.findById(actualOperatorId)
      if (!operator) {
        this.sendError(res, 'Operador não encontrado', 404)
        return
      }

      const activeChats = await conversationRepository.count({
        operatorId: actualOperatorId,
        archived: false,
      } as any)
      if (activeChats >= operator.settings.maxConcurrentChats) {
        this.sendError(
          res,
          'Operador atingiu o limite de chats simultaneos',
          400,
        )
        return
      }

      await this.conversationService.assignOperator(
        conversationId,
        actualOperatorId,
        operator.name,
      )

      const updated = await conversationRepository.findById(conversationId)
      const updatedOperator =
        await operatorRepository.findById(actualOperatorId)
      setImmediate(() => {
        if (updated) {
          this.dispatchQueueWebhook(updated, updatedOperator, 'assigned')
        }
      })
      this.sendSuccess(
        res,
        this.buildQueueItem(updated, updatedOperator),
        'Conversa assumida com sucesso',
      )
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Libera conversa
   */
  async release(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params
      const authUser = (req as any).user as
        | { userId?: string; role?: string }
        | undefined

      const conversation = await conversationRepository.findById(conversationId)
      if (!conversation) {
        this.sendError(res, 'Conversa não encontrada', 404)
        return
      }

      if (
        authUser?.role === 'operator' &&
        authUser.userId &&
        conversation.operatorId !== authUser.userId
      ) {
        this.sendError(res, 'Acesso negado', 403)
        return
      }

      if (conversation.operatorId) {
      }

      await this.conversationService.removeOperator(conversationId)
      const updatedConversation = await conversationRepository.findById(
        conversationId,
      )
      setImmediate(() => {
        if (updatedConversation) {
          this.dispatchQueueWebhook(updatedConversation, null, 'released')
        }
      })
      this.sendSuccess(res, null, 'Conversa liberada para a fila')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Transfere conversa
   */
  async transfer(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId, targetType, targetId } = req.body
      const authUser = (req as any).user as
        | { userId?: string; role?: string }
        | undefined

      if (!conversationId || !targetType || !targetId) {
        this.sendError(
          res,
          'Campos obrigatorios: conversationId, targetType, targetId',
          400,
        )
        return
      }

      if (!['department', 'operator'].includes(targetType)) {
        this.sendError(res, 'Tipo de destino invalido', 400)
        return
      }

      const conversation = await conversationRepository.findById(conversationId)
      if (!conversation) {
        this.sendError(res, 'Conversa não encontrada', 404)
        return
      }

      if (
        authUser?.role === 'operator' &&
        authUser.userId &&
        conversation.operatorId !== authUser.userId
      ) {
        this.sendError(res, 'Acesso negado', 403)
        return
      }

      // Validar destino
      if (targetType === 'department') {
        const department = await departmentRepository.findById(targetId)
        if (!department) {
          this.sendError(res, 'Departamento não encontrado', 404)
          return
        }
        if (!department.isActive) {
          this.sendError(res, 'Departamento esta inativo', 400)
          return
        }
      }

      if (targetType === 'operator') {
        const targetOperator = await operatorRepository.findById(targetId)
        if (!targetOperator) {
          this.sendError(res, 'Operador não encontrado', 404)
          return
        }

        // Verificar limite de chats simultâneos
        const activeChats = await conversationRepository.count({
          operatorId: targetId,
          archived: false,
        })
        const maxChats = targetOperator.settings?.maxConcurrentChats ?? 10
        if (activeChats >= maxChats) {
          this.sendError(
            res,
            'Operador atingiu o limite de chats simultaneos',
            400,
          )
          return
        }

        await this.conversationService.assignOperator(
          conversationId,
          targetId,
          targetOperator.name,
        )

        // Criar mensagem de sistema indicando a transferência
        await messageRepository.create({
          conversationId,
          message: `Conversa transferida para ${targetOperator.name}`,
          type: 'system',
          direction: 'outgoing',
          status: 'sent',
          isRead: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)
        const updated = await conversationRepository.findById(conversationId)
        setImmediate(() => {
          if (updated) {
            this.dispatchQueueWebhook(updated, targetOperator, 'transferred')
          }
        })
      } else {
        const department = await departmentRepository.findById(targetId)
        await this.conversationService.removeOperator(conversationId)

        // Criar mensagem de sistema indicando a transferência
        await messageRepository.create({
          conversationId,
          message: `Conversa transferida para ${department?.name || 'outro departamento'}`,
          type: 'system',
          direction: 'outgoing',
          status: 'sent',
          isRead: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)
        const updated = await conversationRepository.findById(conversationId)
        setImmediate(() => {
          if (updated) {
            this.dispatchQueueWebhook(updated, null, 'transferred_department')
          }
        })
      }

      this.sendSuccess(res, null, 'Conversa transferida com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Finaliza conversa
   */
  async resolve(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params
      const { notes, finalizationId, finalizationIds } = req.body || {}
      const authUser = (req as any).user as
        | { userId?: string; role?: string }
        | undefined

      const conversation = await conversationRepository.findById(conversationId)
      if (!conversation) {
        this.sendError(res, 'Conversa não encontrada', 404)
        return
      }

      if (
        authUser?.role === 'operator' &&
        authUser.userId &&
        conversation.operatorId !== authUser.userId
      ) {
        this.sendError(res, 'Acesso negado', 403)
        return
      }

      if (conversation.operatorId) {
      }

      const addId = (value: unknown, set: Set<string>) => {
        if (typeof value === 'string' && value.trim()) {
          set.add(value)
        }
      }

      const normalizedIds = new Set<string>()
      if (Array.isArray(finalizationIds)) {
        finalizationIds.forEach((id) => addId(id, normalizedIds))
      }
      addId(finalizationId, normalizedIds)

      const requestedFinalizationIds = Array.from(normalizedIds)
      let finalizationEntries: Array<{
        finalizationId: string
        finalizationName: string
        finalizationType: 'gain' | 'loss'
      }> = []

      if (requestedFinalizationIds.length > 0) {
        const finalizations = await finalizationService.findByIds(
          requestedFinalizationIds,
        )
        if (finalizations.length !== requestedFinalizationIds.length) {
          this.sendError(res, 'Finalizacao não encontrada', 404)
          return
        }

        const finalizationMap = new Map<string, typeof finalizations[number]>()
        finalizations.forEach((item) => {
          const key = item._id?.toString()
          if (key) {
            finalizationMap.set(key, item)
          }
        })

        finalizationEntries = requestedFinalizationIds
          .map((id) => {
            const item = finalizationMap.get(id)
            if (!item) return null
            return {
              finalizationId: item._id?.toString() || '',
              finalizationName: item.name,
              finalizationType: item.type,
            }
          })
          .filter(
            (entry): entry is {
              finalizationId: string
              finalizationName: string
              finalizationType: 'gain' | 'loss'
            } => Boolean(entry),
          )
      }

      await this.conversationService.finalizeConversation(conversationId, {
        finalizationEntries,
        finalizationNotes: notes,
      })
      const updatedConversation = await conversationRepository.findById(
        conversationId,
      )
      setImmediate(() => {
        if (updatedConversation) {
          this.dispatchQueueWebhook(updatedConversation, null, 'resolved')
        }
      })
      this.sendSuccess(res, null, 'Conversa finalizada com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Estatisticas da fila
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const [waiting, inProgress, resolved] = await Promise.all([
        conversationRepository.count({
          archived: false,
          operatorId: { $exists: false },
          status: { $ne: 'finalized' },
        }),
        conversationRepository.count({
          archived: false,
          operatorId: { $exists: true, $ne: null },
          status: { $ne: 'finalized' },
        }),
        conversationRepository.count({
          $or: [{ archived: true }, { status: 'finalized' }],
        }),
      ])

      this.sendSuccess(res, {
        waiting,
        inProgress,
        resolved,
        avgWaitTime: 0,
      })
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Adiciona tags
   */
  async addTags(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params
      const { tags } = req.body
      const authUser = (req as any).user as
        | { userId?: string; role?: string }
        | undefined

      if (!tags || !Array.isArray(tags)) {
        this.sendError(res, 'Tags devem ser um array', 400)
        return
      }

      const conversation = await conversationRepository.findById(conversationId)
      if (!conversation) {
        this.sendError(res, 'Conversa não encontrada', 404)
        return
      }

      // Operador pode adicionar tags se:
      // - A conversa não tem operador atribuido (esta na fila), OU
      // - A conversa e dele
      if (authUser?.role === 'operator' && authUser.userId) {
        const hasOperator =
          conversation.operatorId && conversation.operatorId.toString() !== ''
        const isOwner = conversation.operatorId?.toString() === authUser.userId
        if (hasOperator && !isOwner) {
          this.sendError(res, 'Acesso negado', 403)
          return
        }
      }

      const updated = await conversationRepository.updateOne(
        { _id: new ObjectId(conversationId) } as any,
        { $set: { tags, updatedAt: new Date() } },
      )

      if (updated) {
        this.sendSuccess(res, { tags }, 'Tags atualizadas com sucesso')
      } else {
        this.sendError(res, 'Falha ao adicionar tags', 500)
      }
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Adiciona nota
   */
  async addNote(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params
      const { note } = req.body
      const authUser = (req as any).user as
        | { userId?: string; role?: string }
        | undefined

      if (!note) {
        this.sendError(res, 'Nota e obrigatoria', 400)
        return
      }

      const conversation = await conversationRepository.findById(conversationId)
      if (!conversation) {
        this.sendError(res, 'Conversa não encontrada', 404)
        return
      }

      if (
        authUser?.role === 'operator' &&
        authUser.userId &&
        conversation.operatorId !== authUser.userId
      ) {
        this.sendError(res, 'Acesso negado', 403)
        return
      }

      const updated = await conversationRepository.updateOne(
        { _id: new ObjectId(conversationId) } as any,
        { $set: { notes: note, updatedAt: new Date() } },
      )

      if (updated) {
        this.sendSuccess(res, null, 'Nota adicionada com sucesso')
      } else {
        this.sendError(res, 'Falha ao adicionar nota', 500)
      }
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }
}

export default new QueueController()
