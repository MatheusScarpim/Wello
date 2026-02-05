import { Document } from 'mongodb'

import DatabaseManager from '@/core/database/DatabaseManager'
import { BaseRepository } from '@/core/repositories/BaseRepository'

export type TireShopPriceTable = Record<string, Record<string, number> | number>

export interface TireShopConfig extends Document {
  botId: string
  targetNumber: string
  prices: TireShopPriceTable
  createdAt: Date
  updatedAt: Date
}

export class TireShopRepository extends BaseRepository<TireShopConfig> {
  constructor() {
    super('bot_tire_shop_config')
  }

  async initialize(): Promise<void> {
    await DatabaseManager.createDynamicCollection(this.collectionName)
  }

  async getConfig(botId: string): Promise<TireShopConfig> {
    const existing = await this.findOne({ botId } as any)
    if (existing) {
      return existing
    }

    const now = new Date()
    return await this.create({
      botId,
      targetNumber: '',
      prices: {},
      createdAt: now,
      updatedAt: now,
    } as TireShopConfig)
  }

  async updateConfig(
    botId: string,
    update: Partial<TireShopConfig>,
  ): Promise<TireShopConfig> {
    const now = new Date()
    const result = await this.upsert(
      { botId } as any,
      {
        $set: {
          ...update,
          updatedAt: now,
        },
        $setOnInsert: {
          botId,
          createdAt: now,
        },
      } as any,
    )
    return result as TireShopConfig
  }
}
