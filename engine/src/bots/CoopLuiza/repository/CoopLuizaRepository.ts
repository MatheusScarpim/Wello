import { Document } from 'mongodb'

import DatabaseManager from '@/core/database/DatabaseManager'
import { BaseRepository } from '@/core/repositories/BaseRepository'

/**
 * Interface para dados do CoopLuiza
 */
export interface CoopLuizaData extends Document {
  conversationId: string
  protocol?: string
  userName?: string
  document?: string
  serviceId?: string
  serviceName?: string
  menuOption?: string
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  createdAt: Date
  updatedAt: Date
}

/**
 * Repositório específico para o bot CoopLuiza
 */
export class CoopLuizaRepository extends BaseRepository<CoopLuizaData> {
  constructor() {
    super('bot_coopluiza_data')
  }

  /**
   * Inicializa o repositório e cria a coleção se necessário
   */
  async initialize(): Promise<void> {
    await DatabaseManager.createDynamicCollection('bot_coopluiza_data')

    // Cria índices específicos
    await this.collection.createIndex({ conversationId: 1 })
    await this.collection.createIndex(
      { protocol: 1 },
      { unique: true, sparse: true },
    )
    await this.collection.createIndex({ document: 1 })
    await this.collection.createIndex({ status: 1 })
    await this.collection.createIndex({ createdAt: -1 })

    console.log('✅ CoopLuizaRepository inicializado')
  }

  /**
   * Salva ou atualiza dados da conversação
   */
  async saveConversationData(
    conversationId: string,
    data: Partial<CoopLuizaData>,
  ): Promise<CoopLuizaData | null> {
    const now = new Date()

    return await this.upsert(
      { conversationId },
      {
        $set: {
          ...data,
          updatedAt: now,
        },
        $setOnInsert: {
          conversationId,
          createdAt: now,
          status: 'pending',
        },
      },
    )
  }

  /**
   * Busca dados por conversationId
   */
  async getByConversationId(
    conversationId: string,
  ): Promise<CoopLuizaData | null> {
    return await this.findOne({ conversationId })
  }

  /**
   * Busca dados por protocolo
   */
  async getByProtocol(protocol: string): Promise<CoopLuizaData | null> {
    return await this.findOne({ protocol })
  }

  /**
   * Busca dados por documento
   */
  async getByDocument(document: string): Promise<CoopLuizaData[]> {
    return await this.find({ document })
  }

  /**
   * Atualiza status
   */
  async updateStatus(
    conversationId: string,
    status: CoopLuizaData['status'],
  ): Promise<boolean> {
    return await this.updateOne(
      { conversationId },
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      },
    )
  }

  /**
   * Lista solicitações pendentes
   */
  async getPendingRequests(limit: number = 50): Promise<CoopLuizaData[]> {
    return await this.find({ status: 'pending' }, limit)
  }

  /**
   * Busca solicitações por período
   */
  async getRequestsByPeriod(
    startDate: Date,
    endDate: Date,
  ): Promise<CoopLuizaData[]> {
    return await this.find({
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    })
  }

  /**
   * Estatísticas gerais
   */
  async getStats(): Promise<{
    total: number
    pending: number
    inProgress: number
    completed: number
    cancelled: number
  }> {
    const [total, pending, inProgress, completed, cancelled] =
      await Promise.all([
        this.count(),
        this.count({ status: 'pending' }),
        this.count({ status: 'in_progress' }),
        this.count({ status: 'completed' }),
        this.count({ status: 'cancelled' }),
      ])

    return {
      total,
      pending,
      inProgress,
      completed,
      cancelled,
    }
  }

  /**
   * Limpa dados antigos
   */
  async cleanup(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    return await this.deleteMany({
      createdAt: { $lt: cutoffDate },
      status: { $in: ['completed', 'cancelled'] },
    })
  }
}
