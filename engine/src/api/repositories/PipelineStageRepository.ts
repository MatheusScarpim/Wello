import { Document } from 'mongodb'

import { BaseRepository } from '@/core/repositories/BaseRepository'

export interface PipelineStageDocument extends Document {
  name: string
  color: string
  order: number
  createdAt: Date
  updatedAt: Date
}

export class PipelineStageRepository extends BaseRepository<PipelineStageDocument> {
  constructor() {
    super('pipeline_stages')
  }

  async findAllSorted(): Promise<PipelineStageDocument[]> {
    return await this.find({} as any, { sort: { order: 1 } } as any)
  }

  async findByName(name: string): Promise<PipelineStageDocument | null> {
    return await this.findOne({ name } as any)
  }

  async getNextOrder(): Promise<number> {
    const stages = await this.find({} as any, { sort: { order: -1 }, limit: 1 } as any)
    return stages.length > 0 ? (stages[0].order || 0) + 1 : 0
  }
}

export default new PipelineStageRepository()
