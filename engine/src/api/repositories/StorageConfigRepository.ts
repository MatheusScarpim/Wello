import { Document } from 'mongodb'

import { BaseRepository } from '@/core/repositories/BaseRepository'

/**
 * Interface para documento de configuração de storage
 */
export interface StorageConfigDocument extends Document {
  provider: 'azure_blob'
  accountName: string
  accountKey: string
  containerName: string
  connectionString?: string
  endpoint?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Repositório para configurações de storage
 */
export class StorageConfigRepository extends BaseRepository<StorageConfigDocument> {
  constructor() {
    super('storage_configs')
  }

  /**
   * Busca a configuração ativa
   */
  async findActive(): Promise<StorageConfigDocument | null> {
    return await this.findOne({ isActive: true } as any)
  }

  /**
   * Desativa todas as configurações
   */
  async deactivateAll(): Promise<void> {
    await this.updateMany(
      { isActive: true } as any,
      { $set: { isActive: false, updatedAt: new Date() } } as any,
    )
  }

  /**
   * Ativa uma configuração específica e desativa as outras
   */
  async setActive(id: string): Promise<boolean> {
    await this.deactivateAll()
    return await this.updateOne(
      { _id: id } as any,
      { $set: { isActive: true, updatedAt: new Date() } } as any,
    )
  }
}
