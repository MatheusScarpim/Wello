import { Document } from 'mongodb'

import { BaseRepository } from '@/core/repositories/BaseRepository'

export interface ServiceDocument extends Document {
  name: string
  defaultDuration: number // minutos
  color: string
  description?: string
  createdAt: Date
  updatedAt: Date
}

export class ServiceRepository extends BaseRepository<ServiceDocument> {
  constructor() {
    super('services')
  }

  async findAllSorted(): Promise<ServiceDocument[]> {
    return await this.find({} as any, { sort: { name: 1 } } as any)
  }

  async findByName(name: string): Promise<ServiceDocument | null> {
    return await this.findOne({ name } as any)
  }
}

export default new ServiceRepository()
