import { Document } from 'mongodb'

import { BaseRepository } from '@/core/repositories/BaseRepository'

/**
 * Documento representando um contato
 */
export interface ContactDocument extends Document {
  identifier: string
  provider: string
  name?: string
  photo?: string
  contactId?: string
  lastMessage?: string
  lastMessageAt?: Date
  createdAt: Date
  updatedAt: Date
  // Campos para personalização do contato
  tags?: string[]
  customName?: string
}

/**
 * Repositório para contatos
 */
export class ContactRepository extends BaseRepository<ContactDocument> {
  constructor() {
    super('contacts')
  }

  async findByIdentifier(identifier: string, provider: string) {
    return this.findOne({ identifier, provider } as any)
  }
}

export default new ContactRepository()
