import { Document } from 'mongodb'

import { BaseRepository } from '@/core/repositories/BaseRepository'

/**
 * Interface para documento de webhook
 */
export interface WebhookDocument extends Document {
  name: string
  url: string
  events: string[]
  enabled: boolean
  secret?: string
  headers?: Record<string, string>
  retryAttempts: number
  retryDelay: number
  createdAt: Date
  updatedAt: Date
  lastTriggeredAt?: Date
  totalSent: number
  totalFailed: number
}

/**
 * Repositório para webhooks
 */
export class WebhookRepository extends BaseRepository<WebhookDocument> {
  constructor() {
    super('webhooks')
  }

  /**
   * Busca webhooks ativos
   */
  async findActiveWebhooks(limit?: number) {
    return await this.find(
      {
        enabled: true,
      } as any,
      { limit },
    )
  }

  /**
   * Busca webhooks por evento específico
   */
  async findByEvent(event: string) {
    return await this.find({
      enabled: true,
      events: { $in: [event] },
    } as any)
  }

  /**
   * Atualiza estatísticas de envio
   */
  async updateSendStats(id: string, success: boolean) {
    const update: any = {
      $set: {
        lastTriggeredAt: new Date(),
        updatedAt: new Date(),
      },
    }

    if (success) {
      update.$inc = { totalSent: 1 }
    } else {
      update.$inc = { totalFailed: 1 }
    }

    return await this.updateOne({ _id: id } as any, update)
  }

  /**
   * Busca webhook por URL
   */
  async findByUrl(url: string) {
    return await this.findOne({ url } as any)
  }
}
