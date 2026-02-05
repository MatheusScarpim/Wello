import { ObjectId } from 'mongodb'

import {
  ContactDocument,
  ContactRepository,
} from '../repositories/ContactRepository'

export interface RegisterContactParams {
  identifier: string
  provider: string
  name?: string
  photo?: string | null
  contactId?: string
  lastMessage?: string
  lastMessageAt?: Date
}

export interface ContactListFilters {
  page?: number
  limit?: number
  search?: string
  provider?: string
}

export interface UpdateContactParams {
  customName?: string
  tags?: string[]
}

export interface CreateContactParams {
  identifier: string
  provider: string
  name?: string
  customName?: string
  tags?: string[]
}

export interface ContactListResult {
  items: ContactDocument[]
  pagination: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

export class ContactService {
  private repository: ContactRepository

  constructor() {
    this.repository = new ContactRepository()
  }

  async createContact(
    params: CreateContactParams,
  ): Promise<ContactDocument | null> {
    const { identifier, provider, name, customName, tags } = params

    // Verificar se ja existe um contato com este identifier e provider
    const existing = await this.repository.findByIdentifier(
      identifier,
      provider,
    )

    if (existing) {
      throw new Error('Ja existe um contato com este identificador e provedor')
    }

    const now = new Date()
    const contactData: Record<string, unknown> = {
      identifier,
      provider,
      name: name || identifier,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
    }

    if (customName) {
      contactData.customName = customName
    }

    if (tags && tags.length > 0) {
      contactData.tags = tags
    }

    const result = await this.repository.create(contactData as any)
    return result
  }

  async registerContact(params: RegisterContactParams) {
    const {
      identifier,
      provider,
      name,
      photo,
      contactId,
      lastMessage,
      lastMessageAt,
    } = params
    const now = new Date()
    const update: Record<string, unknown> = {
      updatedAt: now,
      lastMessageAt: lastMessageAt || now,
    }

    if (name) {
      update.name = name
    }

    if (photo) {
      update.photo = photo
    }

    if (contactId) {
      update.contactId = contactId
    }

    if (lastMessage) {
      update.lastMessage = lastMessage
    }

    const setOnInsert: Record<string, unknown> = {
      identifier,
      provider,
      createdAt: now,
    }

    if (!name) {
      setOnInsert.name = identifier
    }

    await this.repository.upsert({ identifier, provider } as any, {
      $set: update,
      $setOnInsert: setOnInsert,
    })
  }

  async listContacts(filters: ContactListFilters): Promise<ContactListResult> {
    const { page = 1, limit = 20, search, provider } = filters
    const query: Record<string, unknown> = {}

    if (provider) {
      query.provider = provider
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { identifier: { $regex: search, $options: 'i' } },
      ]
    }

    const result = await this.repository.paginate(query as any, page, limit, {
      sort: { lastMessageAt: -1 },
    })

    return {
      items: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
    }
  }

  async getContactById(id: string): Promise<ContactDocument | null> {
    return this.repository.findById(id)
  }

  async getContactByIdentifier(
    identifier: string,
    provider: string,
  ): Promise<ContactDocument | null> {
    return this.repository.findByIdentifier(identifier, provider)
  }

  async updateContact(
    id: string,
    params: UpdateContactParams,
  ): Promise<boolean> {
    const { customName, tags } = params
    const update: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (customName !== undefined) {
      update.customName = customName
    }

    if (tags !== undefined) {
      update.tags = tags
    }

    const result = await this.repository.updateOne(
      { _id: new ObjectId(id) } as any,
      { $set: update },
    )

    return !!result
  }

  async deleteContact(id: string): Promise<boolean> {
    const result = await this.repository.deleteOne({
      _id: new ObjectId(id),
    } as any)

    return !!result
  }
}

export default new ContactService()
