import { Document } from 'mongodb'

import { BaseRepository } from './BaseRepository'

export interface BotSession extends Document {
  conversationId: string
  botId: string
  currentStage: number
  sessionData: Record<string, any>
  createdAt: Date
  updatedAt: Date
  expiresAt?: Date
  isActive: boolean
  transferredAt?: Date
}

/**
 * Repositório para gerenciar sessões de bots
 */
export class BotSessionRepository extends BaseRepository<BotSession> {
  constructor() {
    super('bot_sessions')
  }

  /**
   * Cria ou atualiza uma sessão de bot
   */
  async upsertSession(
    conversationId: string,
    botId: string,
    currentStage: number,
    sessionData: Record<string, any> = {},
  ): Promise<BotSession | null> {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 horas

    return await this.upsert(
      { conversationId },
      {
        $set: {
          botId,
          currentStage,
          sessionData,
          updatedAt: now,
          expiresAt,
          isActive: true,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
    )
  }

  /**
   * Busca sessão ativa por conversationId
   */
  async getActiveSession(conversationId: string): Promise<BotSession | null> {
    return await this.findOne({
      conversationId,
      isActive: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } },
      ],
    })
  }

  /**
   * Atualiza o estágio atual
   */
  async updateStage(
    conversationId: string,
    newStage: number,
  ): Promise<boolean> {
    return await this.updateOne(
      { conversationId },
      {
        $set: {
          currentStage: newStage,
          updatedAt: new Date(),
        },
      },
    )
  }

  /**
   * Atualiza dados da sessão
   */
  async updateSessionData(
    conversationId: string,
    data: Record<string, any>,
  ): Promise<boolean> {
    return await this.updateOne(
      { conversationId },
      {
        $set: {
          sessionData: data,
          updatedAt: new Date(),
        },
      },
    )
  }

  /**
   * Mescla dados na sessão existente
   */
  async mergeSessionData(
    conversationId: string,
    newData: Record<string, any>,
  ): Promise<boolean> {
    const session = await this.getActiveSession(conversationId)
    if (!session) return false

    const mergedData = { ...session.sessionData, ...newData }
    return await this.updateSessionData(conversationId, mergedData)
  }

  /**
   * Finaliza uma sessão
   */
  async endSession(conversationId: string): Promise<boolean> {
    return await this.updateOne(
      { conversationId },
      {
        $set: {
          isActive: false,
          updatedAt: new Date(),
        },
      },
    )
  }

  /**
   * Remove sessões expiradas
   */
  async cleanExpiredSessions(): Promise<number> {
    return await this.deleteMany({
      expiresAt: { $lt: new Date() },
      isActive: false,
    })
  }

  /**
   * Marca sessão como transferida para operador humano
   */
  async setTransferredAt(conversationId: string): Promise<boolean> {
    return await this.updateOne(
      { conversationId },
      {
        $set: { transferredAt: new Date() },
      },
    )
  }

  /**
   * Busca sessão transferida recentemente (dentro do período de cooldown)
   */
  async getLastTransferredSession(
    conversationId: string,
    cooldownMinutes: number,
  ): Promise<BotSession | null> {
    const cutoff = new Date(Date.now() - cooldownMinutes * 60 * 1000)
    return await this.findOne({
      conversationId,
      isActive: false,
      transferredAt: { $gte: cutoff },
    })
  }

  /**
   * Busca todas as sessões de um bot específico
   */
  async getSessionsByBotId(
    botId: string,
    activeOnly: boolean = true,
  ): Promise<BotSession[]> {
    const filter: any = { botId }
    if (activeOnly) {
      filter.isActive = true
    }
    return await this.find(filter)
  }
}

export default new BotSessionRepository()
