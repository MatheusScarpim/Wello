import crypto from 'crypto'

import SocketServer from '@/api/socket/SocketServer'

import conversationRepository from '../repositories/ConversationRepository'
import { MessageRepository } from '../repositories/MessageRepository'
import { ContactService } from './ContactService'
import { ConversationService } from './ConversationService'
import { webhookDispatcher } from './WebhookDispatcher'

/**
 * Parâmetros para salvar mensagem
 */
export interface SaveMessageParams {
  conversationId: string
  message: string
  type: string
  direction: 'incoming' | 'outgoing'
  status: 'sent' | 'delivered' | 'read' | 'failed'
  messageId?: string
  quotedMessageId?: string
  mediaUrl?: string
  mediaStorage?: {
    provider: 'azure_blob' | 'local'
    blobName?: string
    container?: string
    size?: number
    originalUrl?: string
  }
  from?: string
  to?: string
  operatorId?: string
  operatorName?: string
}

/**
 * Service para lógica de negócios de mensagens
 */
export class MessageService {
  private repository: MessageRepository
  private conversationService: ConversationService
  private contactService: ContactService

  constructor() {
    this.repository = new MessageRepository()
    this.conversationService = new ConversationService()
    this.contactService = new ContactService()
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
   * Busca mensagens por conversa com paginação
   */
  async getMessagesByConversation(
    conversationId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const result = await this.repository.findMessagesByConversation(
      conversationId,
      page,
      limit,
    )

    return this.formatPaginatedResult(result)
  }

  /**
   * Busca mensagem por ID
   */
  async getMessageById(id: string) {
    return await this.repository.findById(id)
  }

  /**
   * Busca ou cria uma conversa pelo identificador (número de telefone)
   */
  async getOrCreateConversation(
    identifier: string,
    provider: string = 'whatsapp',
  ) {
    try {
      // Busca conversa existente
      const existing =
        await this.conversationService.getConversationByIdentifier(
          identifier,
          provider,
        )

      if (existing) {
        return existing
      }

      // Cria nova conversa
      return await this.conversationService.createConversation({
        identifier,
        provider,
        name: identifier, // Usa o número como nome padrão
      })
    } catch (error: any) {
      console.error('❌ Erro ao buscar/criar conversa:', error)
      throw error
    }
  }

  /**
   * Salva uma nova mensagem
   */
  async saveMessage(params: SaveMessageParams) {
    try {
      if (params.messageId) {
        const existing = await this.repository.findOne({
          messageId: params.messageId,
          conversationId: params.conversationId,
        } as any)
        if (existing) {
          console.warn(
            `Mensagem já persistida (id=${params.messageId}) — pulando duplicata`,
          )
          return existing
        }
      }

      console.log('💾 Salvando mensagem no banco:', {
        conversationId: params.conversationId,
        direction: params.direction,
        status: params.status,
        type: params.type,
      })

      const now = new Date()

      const conversation = await conversationRepository.findById(
        params.conversationId,
      )
      const operatorId = conversation?.operatorId || params.operatorId || null
      const operatorName =
        conversation?.operatorName || params.operatorName || null

      const message = await this.repository.create({
        conversationId: params.conversationId,
        message: params.message,
        type: params.type,
        direction: params.direction,
        status: params.status,
        messageId: params.messageId,
        quotedMessageId: params.quotedMessageId,
        mediaUrl: params.mediaUrl,
        mediaStorage: params.mediaStorage,
        isRead: params.direction === 'outgoing',
        createdAt: now,
        updatedAt: now,
        operatorId,
        operatorName,
      } as any)

      console.log('✅ Mensagem salva com sucesso:', {
        id: message._id?.toString(),
        conversationId: params.conversationId,
        direction: params.direction,
      })

      // Dispara webhooks de forma assíncrona (não bloqueante)
      // IMPORTANTE: Não aguarda - usa setImmediate para não bloquear
      setImmediate(() => {
        this.dispatchMessageWebhooks(message, params).catch((error) => {
          console.error('❌ Erro ao disparar webhooks:', error)
        })
      })

      setImmediate(async () => {
        try {
          SocketServer.emitMessage(
            {
              messageId: message._id?.toString(),
              conversationId: params.conversationId,
              content: params.message,
              type: params.type,
              direction: params.direction,
              status: params.status,
              createdAt: message.createdAt,
              mediaUrl: params.mediaUrl,
            },
            params.conversationId,
            operatorId,
          )
        } catch {
          // ignore socket errors
        }
      })

      setImmediate(async () => {
        try {
          if (conversation) {
            await this.contactService.registerContact({
              identifier: conversation.identifier,
              provider: conversation.provider,
              name: conversation.name,
              photo: conversation.photo,
              lastMessage: params.message,
              lastMessageAt: message.createdAt,
            })
          }
        } catch (error) {
          console.error('âŒ Erro ao atualizar contato:', error)
        }
      })

      return message
    } catch (error: any) {
      console.error('❌ Erro ao salvar mensagem no banco:', error)
      throw new Error(`Falha ao salvar mensagem: ${error.message}`)
    }
  }

  /**
   * Salva uma nota interna (visível apenas para operadores, nunca enviada ao cliente)
   */
  async saveNote(params: {
    conversationId: string
    message: string
    operatorId?: string
    operatorName?: string
  }) {
    const now = new Date()

    const conversation = await conversationRepository.findById(
      params.conversationId,
    )
    const operatorId = params.operatorId || conversation?.operatorId || null
    const operatorName =
      params.operatorName || conversation?.operatorName || null

    const note = await this.repository.create({
      conversationId: params.conversationId,
      message: params.message,
      type: 'note',
      direction: 'outgoing',
      status: 'sent',
      messageId: `note_${crypto.randomUUID()}`,
      isRead: true,
      isNote: true,
      createdAt: now,
      updatedAt: now,
      operatorId,
      operatorName,
    } as any)

    // Emite via Socket.IO para que outros operadores vejam a nota em tempo real
    setImmediate(() => {
      try {
        SocketServer.emitMessage(
          {
            messageId: note._id?.toString(),
            conversationId: params.conversationId,
            content: params.message,
            type: 'note',
            direction: 'outgoing',
            status: 'sent',
            isNote: true,
            createdAt: note.createdAt,
            operatorId,
            operatorName,
          },
          params.conversationId,
          operatorId,
        )
      } catch {
        // ignore socket errors
      }
    })

    // Notas internas NÃO disparam webhooks e NÃO atualizam contato

    return note
  }

  /**
   * Dispara webhooks para eventos de mensagem
   */
  private async dispatchMessageWebhooks(
    message: any,
    params: SaveMessageParams,
  ) {
    try {
      const eventData = {
        messageId: message._id?.toString(),
        conversationId: params.conversationId,
        content: params.message,
        type: params.type,
        direction: params.direction,
        status: params.status,
        from: params.from,
        to: params.to,
        mediaUrl: params.mediaUrl,
        timestamp: message.createdAt?.toISOString() || new Date().toISOString(),
      }

      // Dispara evento específico baseado na direção
      if (params.direction === 'incoming') {
        await webhookDispatcher.dispatch('message.received', eventData)
      } else if (params.direction === 'outgoing') {
        if (params.status === 'sent' || params.status === 'delivered') {
          await webhookDispatcher.dispatch('message.sent', eventData)
        } else if (params.status === 'failed') {
          await webhookDispatcher.dispatch('message.failed', eventData)
        }
      }
    } catch (error) {
      // Apenas loga o erro sem interromper o fluxo
      console.error(
        '⚠️  Erro ao disparar webhooks de mensagem (não-crítico):',
        error,
      )
    }
  }

  /**
   * Marca mensagem como lida
   */
  async markAsRead(id: string) {
    return await this.repository.updateOne({ _id: id } as any, {
      $set: {
        isRead: true,
        status: 'read',
        readAt: new Date(),
        updatedAt: new Date(),
      },
    })
  }

  /**
   * Marca todas as mensagens de uma conversa como lidas
   */
  async markAllAsRead(conversationId: string) {
    return await this.repository.updateMany(
      {
        conversationId,
        isRead: false,
        direction: 'incoming',
      } as any,
      {
        $set: {
          isRead: true,
          status: 'read',
          readAt: new Date(),
          updatedAt: new Date(),
        },
      },
    )
  }

  /**
   * Atualiza status da mensagem
   */
  async updateStatus(
    messageId: string,
    status: 'sent' | 'delivered' | 'read' | 'failed',
  ) {
    return await this.repository.updateOne({ messageId } as any, {
      $set: {
        status,
        updatedAt: new Date(),
      },
    })
  }

  /**
   * Busca mídia de uma mensagem
   */
  async getMessageMedia(id: string) {
    const message = await this.repository.findById(id)

    if (!message || !message.mediaUrl) {
      return null
    }

    return {
      url: message.mediaUrl,
      type: message.type,
      messageId: message.messageId,
    }
  }

  /**
   * Deleta mensagem
   */
  async deleteMessage(id: string) {
    return await this.repository.deleteOne({ _id: id } as any)
  }

  /**
   * Deleta todas as mensagens de uma conversa
   */
  async deleteConversationMessages(conversationId: string) {
    return await this.repository.deleteMany({ conversationId } as any)
  }

  /**
   * Conta mensagens não lidas de uma conversa
   */
  async countUnread(conversationId: string) {
    return await this.repository.count({
      conversationId,
      isRead: false,
      direction: 'incoming',
    } as any)
  }

  /**
   * Busca última mensagem de uma conversa
   */
  async getLastMessage(conversationId: string) {
    const messages = await this.repository.findMessagesByConversation(
      conversationId,
      1,
      1,
    )

    return messages.data.length > 0 ? messages.data[0] : null
  }

  /**
   * Busca mensagens por período
   */
  async getMessagesByPeriod(
    conversationId: string,
    startDate: Date,
    endDate: Date,
  ) {
    return await this.repository.find({
      conversationId,
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    } as any)
  }

  /**
   * Estatísticas de mensagens
   */
  async getStats(conversationId?: string) {
    const filter: any = conversationId ? { conversationId } : {}

    const [total, sent, received, unread] = await Promise.all([
      this.repository.count(filter),
      this.repository.count({ ...filter, direction: 'outgoing' }),
      this.repository.count({ ...filter, direction: 'incoming' }),
      this.repository.count({
        ...filter,
        isRead: false,
        direction: 'incoming',
      }),
    ])

    return {
      total,
      sent,
      received,
      unread,
    }
  }
}
