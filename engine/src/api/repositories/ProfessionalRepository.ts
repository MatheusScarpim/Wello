import { Document } from 'mongodb'

import { BaseRepository } from '@/core/repositories/BaseRepository'

export interface ProfessionalDocument extends Document {
  name: string
  color: string
  serviceIds: string[]
  phone?: string
  email?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export class ProfessionalRepository extends BaseRepository<ProfessionalDocument> {
  constructor() {
    super('professionals')
  }

  async findAllSorted(): Promise<ProfessionalDocument[]> {
    return await this.find({} as any, { sort: { name: 1 } } as any)
  }

  async findActive(): Promise<ProfessionalDocument[]> {
    return await this.find({ isActive: true } as any, { sort: { name: 1 } } as any)
  }

  async findByName(name: string): Promise<ProfessionalDocument | null> {
    return await this.findOne({ name } as any)
  }
}

export default new ProfessionalRepository()
