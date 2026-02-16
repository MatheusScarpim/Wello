import { Document } from 'mongodb'

import { BaseRepository } from '@/core/repositories/BaseRepository'
import type {
  VisualNode,
  VisualEdge,
} from '@/core/bot/interfaces/IVisualBotDefinition'

export interface VisualBotDefinitionDocument extends Document {
  botId: string
  name: string
  description?: string
  status: 'draft' | 'published' | 'archived'
  nodes: VisualNode[]
  edges: VisualEdge[]
  initialNodeId: string
  sessionTimeout: number
  enableAnalytics: boolean
  createdBy?: string
  updatedBy?: string
  createdAt: Date
  updatedAt: Date
  publishedAt?: Date
  viewport?: {
    x: number
    y: number
    zoom: number
  }
}

export class VisualBotRepository extends BaseRepository<VisualBotDefinitionDocument> {
  constructor() {
    super('visual_bot_definitions')
  }

  async findByBotId(
    botId: string,
  ): Promise<VisualBotDefinitionDocument | null> {
    return await this.findOne({ botId } as any)
  }

  async findPublished(): Promise<VisualBotDefinitionDocument[]> {
    return await this.find(
      { status: 'published' } as any,
      { sort: { name: 1 } } as any,
    )
  }

  async findAllSorted(): Promise<VisualBotDefinitionDocument[]> {
    return await this.find({} as any, { sort: { updatedAt: -1 } } as any)
  }
}

export default new VisualBotRepository()
