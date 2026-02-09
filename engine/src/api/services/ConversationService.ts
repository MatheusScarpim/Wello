import { ObjectId } from 'mongodb'

import SocketServer from '@/api/socket/SocketServer'
import MessagingService from '@/core/messaging/MessagingService'
import MediaProcessor from '@/core/helpers/MediaProcessor'

import { ConversationRepository } from '../repositories/ConversationRepository'
import { MessageRepository } from '../repositories/MessageRepository'
import departmentRepository from '../repositories/DepartmentRepository'
import {
  WhatsAppInstanceRepository,
  IWhatsAppInstance,
} from '../repositories/WhatsAppInstanceRepository'
import { WhitelabelRepository } from '../repositories/WhitelabelRepository'
import { ContactService } from './ContactService'
import finalizationService from './FinalizationService'
import { webhookDispatcher } from './WebhookDispatcher'
import fairDistributionService from '@/core/fairDistribution/FairDistributionService'

export interface CreateConversationParams {
  identifier: string
  provider: string
  name?: string
  photo?: { img: string } | null
  contactId?: string
  suppressWelcomeMessage?: boolean
  // Campos para identificar a instância do WhatsApp
  instanceId?: string
  sessionName?: string
  instanceName?: string
}

export interface ConversationFilters {
  status?: string
  search?: string
  provider?: string
  operatorId?: string
  archived?: boolean
}

export interface FinalizationSelection {
  finalizationId: string
  finalizationName: string
  finalizationType: 'gain' | 'loss'
}

export interface FinalizationContext {
  finalizationId?: string
  finalizationName?: string
  finalizationType?: 'gain' | 'loss'
  finalizationNotes?: string
  finalizationIds?: string[]
  finalizationEntries?: FinalizationSelection[]
}

export interface UnarchiveConversationResult {
  success: boolean
  conflict?: boolean
  finalized?: boolean
}

interface ExistingConversationOptions {
  sessionName?: string
  instanceId?: string
  instanceName?: string
  defaultDepartmentId?: string
}

export class ConversationService {
  private repository: ConversationRepository
  private messageRepository: MessageRepository
  private whitelabelRepository: WhitelabelRepository
  private whatsappInstanceRepository: WhatsAppInstanceRepository
  private contactService: ContactService

  constructor() {
    this.repository = new ConversationRepository()
    this.messageRepository = new MessageRepository()
    this.whitelabelRepository = new WhitelabelRepository()
    this.whatsappInstanceRepository = new WhatsAppInstanceRepository()
    this.contactService = new ContactService()
  }

  private async resolveFinalizationSelections(
    options?: FinalizationContext,
  ): Promise<FinalizationSelection[]> {
    if (options?.finalizationEntries?.length) {
      return options.finalizationEntries
    }

    const candidateIds: string[] = []

    if (options?.finalizationIds?.length) {
      candidateIds.push(...options.finalizationIds.filter(Boolean))
    }

    if (options?.finalizationId) {
      candidateIds.push(options.finalizationId)
    }

    const uniqueIds = Array.from(new Set(candidateIds))
    if (uniqueIds.length === 0) {
      return []
    }

    const finalizations = await finalizationService.findByIds(uniqueIds)
    const finalizationMap = new Map<string, typeof finalizations[number]>()
    finalizations.forEach((item) => {
      const key = item._id?.toString()
      if (key) {
        finalizationMap.set(key, item)
      }
    })

    return uniqueIds
      .map((id) => {
        const item = finalizationMap.get(id)
        if (!item) return null
        return {
          finalizationId: item._id?.toString() || '',
          finalizationName: item.name,
          finalizationType: item.type,
        }
      })
      .filter((entry): entry is FinalizationSelection => Boolean(entry))
  }

  /**
   * Envia mensagem automática configurada (boas-vindas, assumir, finalização)
   * As configurações são buscadas da instância do WhatsApp associada à conversa
   */
  private async sendAutomaticMessage(
    conversation: any,
    messageType: 'welcome' | 'assign' | 'finalization',
    context?: { operatorName?: string },
  ): Promise<void> {
    try {
      // Buscar configurações da instância do WhatsApp
      if (!conversation.sessionName) {
        console.log(
          `⚠️ Conversa sem sessionName, não é possível enviar mensagem automática`,
        )
        return
      }

      const instance = await this.whatsappInstanceRepository.findBySessionName(
        conversation.sessionName,
      )

      if (!instance) {
        console.log(
          `⚠️ Instância não encontrada para sessionName: ${conversation.sessionName}`,
        )
        return
      }

      const config = instance.automaticMessages?.[messageType]

      if (!config?.enabled || !config?.message) return

      let message = config.message
      // Substituir variáveis
      message = message.replace(/{operatorName}/g, context?.operatorName || '')
      message = message.replace(/{customerName}/g, conversation.name || '')
      message = message.replace(
        /{protocolNumber}/g,
        conversation.protocolNumber || '',
      )

      const recipient = conversation.identifier || conversation.phoneNumber

      if (!recipient) {
        console.warn(
          `⚠️ Conversa ${conversation._id} não tem identificador para mensagem automática (${messageType})`,
        )
        return
      }

      // Enviar via MessagingService
      await MessagingService.sendMessage({
        to: recipient,
        provider: conversation.provider,
        message,
        type: 'text',
        sessionName: conversation.sessionName,
      })

      // Salvar no banco
      await this.messageRepository.create({
        conversationId: conversation._id.toString(),
        message,
        type: 'text',
        direction: 'outgoing',
        status: 'sent',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      // Emitir via socket para atualizar o chat em tempo real
      setImmediate(() => {
        SocketServer.emitMessage(
          {
            conversationId: conversation._id.toString(),
            message,
            type: 'text',
            direction: 'outgoing',
            status: 'sent',
            createdAt: new Date(),
          },
          conversation._id.toString(),
        )
      })

      console.log(
        `✅ Mensagem automática (${messageType}) enviada para: ${conversation.identifier} [instância: ${instance.name}]`,
      )
    } catch (error) {
      console.error(
        `Erro ao enviar mensagem automática (${messageType}):`,
        error,
      )
    }
  }

  private async resolveProfilePhoto(
    photo?: { img: string } | null,
    identifier?: string,
  ): Promise<string | undefined> {
    if (!photo?.img || !photo.img.startsWith('http')) {
      return undefined
    }

    try {
      const uploadedPhoto = await MediaProcessor.processProfilePhoto(
        photo.img,
        identifier,
      )
      return uploadedPhoto || undefined
    } catch {
      console.warn('Failed to upload profile photo, using original URL')
      return undefined
    }
  }

  private async resolveDepartmentId(
    instance?: IWhatsAppInstance | null,
  ): Promise<string | undefined> {
    if (!instance?.departmentIds?.length) {
      return undefined
    }

    for (const departmentId of instance.departmentIds) {
      const department = await departmentRepository.findById(departmentId)
      if (department && department.isActive) {
        return departmentId
      }
    }

    return undefined
  }

  async getConversations(params: {
    page: number
    limit: number
    status?: string
    search?: string
    archived?: boolean
  }) {
    const { page, limit, status, search, archived } = params
    const filter: any = {
      archived: typeof archived === 'boolean' ? archived : false,
    }

    if (status) {
      filter.status = status
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { identifier: { $regex: search, $options: 'i' } },
      ]
    }

    const result = await this.repository.paginate(filter, page, limit, {
      sort: { updatedAt: -1 },
    })

    const conversationsWithLastMessage = await Promise.all(
      result.data.map(async (conversation: any) => {
        const lastMessage = await this.getLastMessage(
          conversation._id.toString(),
        )
        return {
          ...conversation,
          lastMessage,
        }
      }),
    )

    return {
      items: conversationsWithLastMessage,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
    }
  }

  private async getLastMessage(conversationId: string) {
    try {
      const messages = await this.messageRepository.findMessagesByConversation(
        conversationId,
        1,
        1,
      )

      if (messages.data.length > 0) {
        const msg = messages.data[0]
        return {
          _id: msg._id,
          message: msg.message,
          type: msg.type,
          direction: msg.direction,
          status: msg.status,
          createdAt: msg.createdAt,
          mediaUrl: msg.mediaUrl,
        }
      }

      return null
    } catch (error) {
      console.error('Error fetching last message:', error)
      return null
    }
  }

  async getConversationById(id: string) {
    return await this.repository.findById(id)
  }

  async getConversationByIdentifier(
    identifier: string,
    provider: string,
    sessionName?: string,
  ) {
    return await this.repository.findOne({
      identifier,
      provider,
      archived: false,
      ...(sessionName && { sessionName }),
    } as any)
  }

  async getConversationActive(
    identifier: string,
    provider: string,
    sessionName?: string,
  ) {
    return await this.repository.findOne({
      identifier,
      provider,
      status: 'active',
      ...(sessionName && { sessionName }),
    } as any)
  }

  async getConversationOpen(
    identifier: string,
    provider: string,
    sessionName?: string,
  ) {
    return await this.repository.findOne({
      identifier,
      provider,
      status: { $ne: 'finalized' },
      ...(sessionName && { sessionName }),
    } as any)
  }

  private async ensureConversationReady(
    conversation: any,
    options: ExistingConversationOptions,
  ) {
    if (!conversation) {
      return conversation
    }

    const conversationId = conversation._id?.toString()
    let refreshedConversation = conversation

    if (conversation.archived && conversationId) {
      const unarchiveResult = await this.unarchiveConversation(conversationId)
      if (unarchiveResult.success) {
        refreshedConversation =
          (await this.repository.findById(conversationId)) ||
          refreshedConversation
      }
    }

    const updates: Record<string, any> = {}

    if (options.sessionName && !refreshedConversation.sessionName) {
      updates.sessionName = options.sessionName
      if (options.instanceId) {
        updates.instanceId = options.instanceId
      }
      if (options.instanceName) {
        updates.instanceName = options.instanceName
      }
    }

    if (
      options.defaultDepartmentId &&
      !refreshedConversation.departmentId
    ) {
      updates.departmentId = options.defaultDepartmentId
    }

    if (Object.keys(updates).length > 0 && conversationId) {
      await this.updateConversation(conversationId, updates)
      Object.assign(refreshedConversation, updates)
    }

    return refreshedConversation
  }

  async createConversation(params: CreateConversationParams) {
    const {
      identifier,
      provider,
      name,
      photo,
      instanceId,
      sessionName,
      instanceName,
      suppressWelcomeMessage,
    } = params

    const instance =
      sessionName &&
      (await this.whatsappInstanceRepository.findBySessionName(sessionName))
    const defaultDepartmentId = await this.resolveDepartmentId(instance)

    const existing = await this.getConversationOpen(
      identifier,
      provider,
      sessionName,
    )
    if (existing) {
      return await this.ensureConversationReady(existing, {
        sessionName,
        instanceId,
        instanceName,
        defaultDepartmentId,
      })
    }

    const azurePhotoUrl = await this.resolveProfilePhoto(photo, identifier)

    const now = new Date()

    const protocolNumber = await this.buildProtocolNumber()

    const existingContact = await this.contactService.getContactByIdentifier(
      identifier,
      provider,
    )

    const conversationName = existingContact?.customName || name
    const conversationTags = existingContact?.tags || []

    const payload = {
      identifier,
      provider,
      name: conversationName,
      photo: azurePhotoUrl,
      status: 'active',
      archived: false,
      unreadCount: 0,
      priority: 1,
      waitTime: 0,
      tags: conversationTags,
      protocolNumber,
      departmentId: defaultDepartmentId,
      instanceId,
      sessionName,
      instanceName,
      lastOperatorId: undefined,
      lastResolvedAt: undefined,
      createdAt: now,
      updatedAt: now,
    } as any

    let conversation: any
    let attempt = 0

    while (!conversation && attempt < 3) {
      attempt += 1
      try {
        await this.repository.updateMany(
          {
            identifier,
            provider,
            status: 'finalized',
            archived: { $ne: true },
          } as any,
          {
            $set: {
              archived: true,
              updatedAt: new Date(),
            },
          },
        )
        conversation = await this.repository.create(payload)
      } catch (error: any) {
        if (error?.code === 11000) {
          const conflict = await this.repository.findOne({
            identifier,
            provider,
            ...(sessionName && { sessionName }),
          } as any)

          if (conflict) {
            if (conflict.status === 'finalized') {
              if (!payload.lastOperatorId && conflict.operatorId) {
                payload.lastOperatorId = conflict.operatorId
              }
              if (!payload.lastResolvedAt) {
                payload.lastResolvedAt =
                  conflict.resolvedAt ||
                  conflict.finalizationAt ||
                  conflict.updatedAt ||
                  now
              }
              await this.repository.updateMany(
                {
                  identifier,
                  provider,
                  archived: { $ne: true },
                  status: 'finalized',
                } as any,
                {
                  $set: {
                    archived: true,
                    updatedAt: new Date(),
                  },
                },
              )
              continue
            }

            return await this.ensureConversationReady(conflict, {
              sessionName,
              instanceId,
              instanceName,
              defaultDepartmentId,
            })
          }
        }
        throw error
      }
    }

    if (!conversation) {
      throw new Error(
        `Falha ao criar conversa para ${identifier}/${provider} após múltiplas tentativas`,
      )
    }

    await this.contactService.registerContact({
      identifier,
      provider,
      name: name || identifier,
      photo: azurePhotoUrl || photo?.img || undefined,
      contactId: params.contactId,
      lastMessageAt: now,
    })

    setImmediate(() => {
      this.dispatchConversationCreatedWebhook(conversation).catch((error) => {
        console.error('Error dispatching conversation.created webhook:', error)
      })
    })

    // Enviar mensagem de boas-vindas (apenas para conversas NOVAS)
    if (!suppressWelcomeMessage) {
      setImmediate(() => {
        this.sendAutomaticMessage(conversation, 'welcome').catch((error) => {
          console.error('Erro ao enviar mensagem de boas-vindas:', error)
        })
      })
    }

    setImmediate(() => {
      fairDistributionService.offerConversationNow(conversation).catch(
        (error) => {
          console.error('Erro ao ofertar conversa imediatamente:', error)
        },
      )
    })

    return conversation
  }

  private async dispatchConversationCreatedWebhook(conversation: any) {
    try {
      await webhookDispatcher.dispatch('conversation.created', {
        conversationId: conversation._id?.toString(),
        identifier: conversation.identifier,
        provider: conversation.provider,
        name: conversation.name,
        photo: conversation.photo,
        status: conversation.status,
        createdAt:
          conversation.createdAt?.toISOString() || new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error dispatching conversation.created webhook:', error)
    }
  }

  async updateConversation(id: string, updates: Record<string, any>) {
    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
    const result = await this.repository.updateOne({ _id: objectId } as any, {
      $set: {
        ...updates,
        updatedAt: new Date(),
      },
    })

    setImmediate(() => {
      this.dispatchConversationUpdatedWebhook(id, updates).catch((error) => {
        console.error('Error dispatching conversation.updated webhook:', error)
      })
    })

    setImmediate(() => {
      SocketServer.emitConversationUpdate(
        { conversationId: id, updates },
        id,
        updates.operatorId ?? undefined,
      )
    })

    return result
  }

  private async dispatchConversationUpdatedWebhook(
    id: string,
    updates: Record<string, any>,
  ) {
    try {
      await webhookDispatcher.dispatch('conversation.updated', {
        conversationId: id,
        updates,
        updatedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error dispatching conversation.updated webhook:', error)
    }
  }

  async paginateConversations(
    filters: ConversationFilters,
    page: number,
    limit: number,
  ) {
    const query: any = {}

    if (filters.status) {
      query.status = filters.status
    }

    if (filters.provider) {
      query.provider = filters.provider
    }

    if (filters.operatorId) {
      query.operatorId = filters.operatorId
    }

    if (filters.archived !== undefined) {
      query.archived = filters.archived
    }

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { identifier: { $regex: filters.search, $options: 'i' } },
      ]
    }

    const result = await this.repository.paginate(query, page, limit, {
      sort: { updatedAt: -1 },
    })

    const conversationsWithLastMessage = await Promise.all(
      result.data.map(async (conversation: any) => {
        const lastMessage = await this.getLastMessage(
          conversation._id.toString(),
        )
        return {
          ...conversation,
          lastMessage,
        }
      }),
    )

    return {
      items: conversationsWithLastMessage,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
    }
  }

  async archiveConversation(id: string, options?: FinalizationContext) {
    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
    const now = new Date()
    const updateSet: Record<string, any> = {
      archived: true,
      resolvedAt: now,
      updatedAt: now,
    }

    const finalizations = await this.resolveFinalizationSelections(options)
    let includeFinalization = finalizations.length > 0

    if (finalizations.length > 0) {
      const primary = finalizations[0]
      updateSet.finalizations = finalizations
      updateSet.finalizationId = primary.finalizationId
      updateSet.finalizationName = primary.finalizationName
      updateSet.finalizationType = primary.finalizationType
    }

    if (options?.finalizationNotes) {
      updateSet.finalizationNotes = options.finalizationNotes
      includeFinalization = true
    }

    if (includeFinalization) {
      updateSet.finalizationAt = now
    }

    const result = await this.repository.updateOne({ _id: objectId } as any, {
      $set: updateSet,
      $unset: {
        offerOperatorId: '',
        offerOperatorName: '',
        offerExpiresAt: '',
        offerAttempt: '',
      },
    })

    setImmediate(() => {
      webhookDispatcher
        .dispatch('conversation.archived', {
          conversationId: id,
          archivedAt: new Date().toISOString(),
        })
        .catch((error) => {
          console.error(
            'Error dispatching conversation.archived webhook:',
            error,
          )
        })
    })

    const eventPayload: Record<string, any> = {
      conversationId: id,
      archived: true,
    }
    if (finalizations.length > 0) {
      const primary = finalizations[0]
      eventPayload.finalizations = finalizations
      eventPayload.finalizationId = primary.finalizationId
      eventPayload.finalizationName = primary.finalizationName
      eventPayload.finalizationType = primary.finalizationType
    }
    if (updateSet.finalizationNotes)
      eventPayload.finalizationNotes = updateSet.finalizationNotes
    if (updateSet.finalizationAt)
      eventPayload.finalizationAt = updateSet.finalizationAt

    setImmediate(() => {
      SocketServer.emitConversationUpdate(eventPayload, id)
    })

    return result
  }

  async finalizeConversation(id: string, options?: FinalizationContext) {
    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
    const beforeUpdate = await this.repository.findById(objectId)
    const now = new Date()
    const updateSet: Record<string, any> = {
      status: 'finalized',
      resolvedAt: now,
      updatedAt: now,
    }
    if (beforeUpdate?.operatorId) {
      updateSet.lastOperatorId = beforeUpdate.operatorId
    }
    updateSet.lastResolvedAt = now

    const finalizations = await this.resolveFinalizationSelections(options)

    if (finalizations.length > 0) {
      const primary = finalizations[0]
      updateSet.finalizations = finalizations
      updateSet.finalizationId = primary.finalizationId
      updateSet.finalizationName = primary.finalizationName
      updateSet.finalizationType = primary.finalizationType
    }

    if (options?.finalizationNotes) {
      updateSet.finalizationNotes = options.finalizationNotes
    }

    updateSet.finalizationAt = now

    // Preserva operatorId e operatorName para métricas de finalizações
    // Apenas limpa o assignedAt para indicar que não está mais em atendimento ativo
    const result = await this.repository.updateOne({ _id: objectId } as any, {
      $set: updateSet,
      $unset: {
        assignedAt: '',
        offerOperatorId: '',
        offerOperatorName: '',
        offerExpiresAt: '',
        offerAttempt: '',
      },
    })

    if (result) {
      const conversation = await this.repository.findById(objectId)
      const payload: Record<string, any> = {
        conversationId: id,
        status: 'finalized',
        assignedAt: null,
        resolvedAt: updateSet.resolvedAt,
        finalizationAt: updateSet.finalizationAt,
      }
      if (conversation) {
        payload.archived = conversation.archived
      }
      if (finalizations.length > 0) {
        payload.finalizations = finalizations
      }
      if (updateSet.finalizationId)
        payload.finalizationId = updateSet.finalizationId
      if (updateSet.finalizationName)
        payload.finalizationName = updateSet.finalizationName
      if (updateSet.finalizationType)
        payload.finalizationType = updateSet.finalizationType
      if (updateSet.finalizationNotes)
        payload.finalizationNotes = updateSet.finalizationNotes

      setImmediate(() => {
        SocketServer.emitConversationUpdate(payload, id)
      })

      // Enviar mensagem de finalização
      if (conversation) {
        setImmediate(() => {
          this.sendAutomaticMessage(conversation, 'finalization').catch(
            (error) => {
              console.error('Erro ao enviar mensagem de finalização:', error)
            },
          )
        })
      }
    }

    return result
  }

  async unarchiveConversation(
    id: string,
  ): Promise<UnarchiveConversationResult> {
    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
    const conversation = await this.repository.findById(objectId)
    if (!conversation) {
      return { success: false }
    }

    if (conversation.status === 'finalized') {
      return { success: false, finalized: true }
    }

    if (!conversation.archived) {
      return { success: true }
    }

    const duplicate = await this.repository.findOne({
      identifier: conversation.identifier,
      provider: conversation.provider,
      archived: false,
      _id: { $ne: conversation._id },
    } as any)

    if (duplicate) {
      return { success: false, conflict: true }
    }

    const now = new Date()
    const updated = await this.repository.updateOne({ _id: objectId } as any, {
      $set: {
        status: 'active',
        archived: false,
        updatedAt: now,
      },
      $unset: {
        finalizationId: '',
        finalizationName: '',
        finalizationType: '',
        finalizationNotes: '',
        finalizationAt: '',
      },
    })

    if (updated) {
      setImmediate(() => {
        SocketServer.emitConversationUpdate(
          { conversationId: id, status: 'active', archived: false },
          id,
        )
      })
    }

    return { success: updated }
  }

  async assignOperator(
    id: string,
    operatorId: string,
    operatorName?: string,
    options?: { suppressAutomaticMessage?: boolean },
  ) {
    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
    const result = await this.repository.updateOne({ _id: objectId } as any, {
      $set: {
        operatorId,
        operatorName,
        assignedAt: new Date(),
        updatedAt: new Date(),
      },
      $unset: {
        offerOperatorId: '',
        offerOperatorName: '',
        offerExpiresAt: '',
        offerAttempt: '',
      },
    })

    setImmediate(() => {
      webhookDispatcher
        .dispatch('operator.assigned', {
          conversationId: id,
          operatorId,
          operatorName,
          assignedAt: new Date().toISOString(),
        })
        .catch((error) => {
          console.error('Error dispatching operator.assigned webhook:', error)
        })
    })

    setImmediate(() => {
      SocketServer.emitConversationUpdate(
        { conversationId: id, operatorId, operatorName },
        id,
        operatorId,
      )
    })

    // Enviar mensagem de assumir
    const conversation = await this.repository.findById(objectId)
    if (conversation && !options?.suppressAutomaticMessage) {
      setImmediate(() => {
        this.sendAutomaticMessage(conversation, 'assign', {
          operatorName,
        }).catch((error) => {
          console.error('Erro ao enviar mensagem de assumir:', error)
        })
      })
    }

    return result
  }

  async removeOperator(id: string) {
    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
    const result = await this.repository.updateOne({ _id: objectId } as any, {
      $unset: {
        operatorId: '',
        operatorName: '',
        assignedAt: '',
        offerOperatorId: '',
        offerOperatorName: '',
        offerExpiresAt: '',
        offerAttempt: '',
      },
      $set: {
        updatedAt: new Date(),
      },
    })

    setImmediate(() => {
      webhookDispatcher
        .dispatch('operator.removed', {
          conversationId: id,
          removedAt: new Date().toISOString(),
        })
        .catch((error) => {
          console.error('Error dispatching operator.removed webhook:', error)
        })
    })

    setImmediate(() => {
      SocketServer.emitConversationUpdate(
        { conversationId: id, operatorId: null },
        id,
      )
    })

    return result
  }

  async incrementUnreadCount(id: string) {
    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
    return await this.repository.updateOne({ _id: objectId } as any, {
      $inc: { unreadCount: 1 },
      $set: { updatedAt: new Date() },
    })
  }

  async resetUnreadCount(id: string) {
    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
    return await this.repository.updateOne({ _id: objectId } as any, {
      $set: {
        unreadCount: 0,
        updatedAt: new Date(),
      },
    })
  }

  async deleteConversation(id: string) {
    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
    const result = await this.repository.deleteOne({ _id: objectId } as any)

    if (result) {
      setImmediate(() => {
        webhookDispatcher
          .dispatch('conversation.deleted', {
            conversationId: id,
            deletedAt: new Date().toISOString(),
          })
          .catch((error) => {
            console.error(
              'Error dispatching conversation.deleted webhook:',
              error,
            )
          })
      })
    }

    return result
  }

  async getStats() {
    const [total, active, archived, withOperator] = await Promise.all([
      this.repository.count(),
      this.repository.count({ status: 'active' }),
      this.repository.count({ archived: true }),
      this.repository.count({ operatorId: { $exists: true } }),
    ])

    return {
      total,
      active,
      archived,
      withOperator,
      withoutOperator: total - withOperator,
    }
  }

  private async buildProtocolNumber(): Promise<string> {
    const settings = await this.whitelabelRepository.getSettings()
    const prefix = (
      settings.protocolIdentifier?.trim() || 'PROTO'
    ).toUpperCase()
    const timestamp = Date.now().toString(36).toUpperCase()
    const randomSegment = Math.floor(1000 + Math.random() * 9000)
    return `${prefix}-${timestamp}-${randomSegment}`
  }
}
