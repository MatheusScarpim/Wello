import { Document } from 'mongodb'

import { BaseRepository } from '@/core/repositories/BaseRepository'

/**
 * Interface para documento de conversa
 */
export interface ConversationDocument extends Document {
  identifier: string
  provider: string
  name?: string
  photo?: string
  status: 'active' | 'waiting' | 'inactive' | 'blocked' | 'finalized'
  archived: boolean
  unreadCount: number
  operatorId?: string
  operatorName?: string
  departmentId?: string
  offerOperatorId?: string
  offerOperatorName?: string
  offerExpiresAt?: Date
  offerAttempt?: number
  priority?: number
  waitTime?: number
  tags?: string[]
  notes?: string
  finalizationId?: string
  finalizationName?: string
  finalizationType?: 'gain' | 'loss'
  finalizationNotes?: string
  finalizationAt?: Date
  protocolNumber?: string
  assignedAt?: Date
  resolvedAt?: Date
  lastOperatorId?: string
  lastResolvedAt?: Date
  lastMessageAt?: Date
  lastMessage?: string
  createdAt: Date
  updatedAt: Date
  // Campos para identificar a instância do WhatsApp
  instanceId?: string // ID da instância no MongoDB
  sessionName?: string // Nome da sessão (ex: session_123456_abc)
  instanceName?: string // Nome amigável da instância
}

/**
 * Repositório para conversas
 */
export class ConversationRepository extends BaseRepository<ConversationDocument> {
  constructor() {
    super('conversations')
  }

  /**
   * Busca conversas ativas
   */
  async findActiveConversations(limit?: number) {
    return await this.find(
      {
        status: 'active',
        archived: false,
      } as any,
      limit,
    )
  }

  /**
   * Busca conversas por operador
   */
  async findByOperator(operatorId: string, limit?: number) {
    return await this.find({ operatorId } as any, limit)
  }

  /**
   * Busca conversas arquivadas
   */
  async findArchivedConversations(limit?: number) {
    return await this.find({ archived: true } as any, limit)
  }

  /**
   * Busca conversas com mensagens não lidas
   */
  async findWithUnreadMessages(limit?: number) {
    return await this.find(
      {
        unreadCount: { $gt: 0 },
      } as any,
      limit,
    )
  }
}

export default new ConversationRepository()
