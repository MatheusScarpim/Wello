import { Document } from 'mongodb'

import { BaseRepository } from '@/core/repositories/BaseRepository'

export interface CannedResponseDocument extends Document {
  shortcut: string
  title: string
  content: string
  departmentId?: string
  operatorId?: string
  isGlobal: boolean
  usageCount: number
  createdAt: Date
  updatedAt: Date
}

export class CannedResponseRepository extends BaseRepository<CannedResponseDocument> {
  constructor() {
    super('canned_responses')
  }

  async findByShortcut(shortcut: string): Promise<CannedResponseDocument | null> {
    return await this.findOne({ shortcut } as any)
  }

  async findAllSorted(): Promise<CannedResponseDocument[]> {
    return await this.find({} as any, { sort: { title: 1 } } as any)
  }

  async findGlobal(): Promise<CannedResponseDocument[]> {
    return await this.find({ isGlobal: true } as any, { sort: { title: 1 } } as any)
  }

  async findByDepartment(departmentId: string): Promise<CannedResponseDocument[]> {
    return await this.find({ departmentId } as any, { sort: { title: 1 } } as any)
  }

  async incrementUsageCount(id: string): Promise<void> {
    const { ObjectId } = await import('mongodb')
    await this.updateOne(
      { _id: new ObjectId(id) } as any,
      { $inc: { usageCount: 1 } },
    )
  }
}

export default new CannedResponseRepository()
