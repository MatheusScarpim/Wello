import { Document } from 'mongodb'

import { BaseRepository } from '@/core/repositories/BaseRepository'

/**
 * Interface para documento de tag
 */
export interface TagDocument extends Document {
  name: string
  color: string
  description?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Repositorio para tags
 */
export class TagRepository extends BaseRepository<TagDocument> {
  constructor() {
    super('tags')
  }

  /**
   * Busca tag por nome
   */
  async findByName(name: string): Promise<TagDocument | null> {
    return await this.findOne({ name } as any)
  }

  /**
   * Busca todas as tags ordenadas por nome
   */
  async findAllSorted(): Promise<TagDocument[]> {
    return await this.find({} as any, { sort: { name: 1 } } as any)
  }
}

export default new TagRepository()
