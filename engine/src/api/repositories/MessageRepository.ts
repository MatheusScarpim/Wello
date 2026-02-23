import { Document } from 'mongodb'

import { BaseRepository } from '@/core/repositories/BaseRepository' // Assuming you create this file

/**
 * Interface para documento de mensagem
 */
export interface MessageReactionDoc {
  emoji: string
  sender: string
  timestamp: number
}

export interface MessageDocument extends Document {
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
  metadata?: Record<string, any>
  reactions?: MessageReactionDoc[]
  isRead: boolean
  readAt?: Date
  createdAt: Date
  updatedAt: Date
  operatorId?: string
  operatorName?: string
}

/**
 * Repositório para mensagens
 */
export class MessageRepository extends BaseRepository<MessageDocument> {
  constructor() {
    super('messages')
  }

  /**
   * Busca mensagens por conversa com paginação e ordenação
   */
  async findMessagesByConversation(
    conversationId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    return await this.paginate({ conversationId } as any, page, limit, {
      sort: { createdAt: -1 },
    })
  }

  /**
   * Busca mensagens não lidas de uma conversa
   */
  async findUnreadMessages(conversationId: string) {
    return await this.find({
      conversationId,
      isRead: false,
      direction: 'incoming',
    } as any)
  }

  /**
   * Busca mensagens por tipo
   */
  async findByType(conversationId: string, type: string, limit?: number) {
    return await this.find(
      {
        conversationId,
        type,
      } as any,
      limit,
    )
  }

  /**
   * Busca mensagens por status
   */
  async findByStatus(conversationId: string, status: string, limit?: number) {
    return await this.find(
      {
        conversationId,
        status,
      } as any,
      limit,
    )
  }

  /**
   * Adiciona ou atualiza reação em uma mensagem (pelo messageId do WPP)
   */
  async addReaction(messageId: string, reaction: MessageReactionDoc) {
    const collection = await this.getCollection()
    // Remove reação anterior do mesmo sender, depois adiciona a nova
    await collection.updateOne(
      { messageId } as any,
      {
        $pull: { reactions: { sender: reaction.sender } } as any,
      },
    )
    // Se emoji vazio/false, só remove (unreact)
    if (reaction.emoji && reaction.emoji !== '') {
      await collection.updateOne(
        { messageId } as any,
        {
          $push: { reactions: reaction } as any,
        },
      )
    }
  }

  /**
   * Busca mensagem pelo messageId do WPP
   */
  async findByMessageId(messageId: string) {
    return await this.findOne({ messageId } as any)
  }
}

const messageRepository = new MessageRepository()

export default messageRepository
