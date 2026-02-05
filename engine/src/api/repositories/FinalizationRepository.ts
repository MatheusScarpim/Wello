import { Document } from 'mongodb'

import { BaseRepository } from '@/core/repositories/BaseRepository'

export interface FinalizationDocument extends Document {
  name: string
  type: 'gain' | 'loss'
  createdAt: Date
  updatedAt: Date
}

export class FinalizationRepository extends BaseRepository<FinalizationDocument> {
  constructor() {
    super('finalizations')
  }
}

export default new FinalizationRepository()
