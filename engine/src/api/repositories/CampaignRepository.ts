import { Document, Filter, ObjectId } from 'mongodb'

import { BaseRepository } from '@/core/repositories/BaseRepository'

export interface CampaignDocument extends Document {
  name: string
  description?: string
  type: 'official' | 'unofficial'
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed'
  templateId?: string
  instanceId: string
  instanceName?: string
  message?: string
  mediaUrl?: string
  mediaType?: string
  scheduledAt?: Date
  startedAt?: Date
  completedAt?: Date
  totalContacts: number
  sent: number
  delivered: number
  read: number
  failed: number
  tags?: string[]
  contactListType: 'all' | 'tags' | 'manual' | 'import'
  contactIds?: string[]
  delayMs: number
  createdBy?: string
  createdAt: Date
  updatedAt: Date
}

export class CampaignRepository extends BaseRepository<CampaignDocument> {
  constructor() {
    super('campaigns')
  }

  async findByStatus(status: string) {
    return this.find(
      { status } as Filter<CampaignDocument>,
      { sort: { createdAt: -1 } } as any,
    )
  }

  async findScheduled() {
    return this.find({
      status: 'scheduled',
      scheduledAt: { $lte: new Date() },
    } as Filter<CampaignDocument>)
  }

  async updateMetrics(id: string, metrics: { sent?: number; delivered?: number; read?: number; failed?: number }) {
    const objectId = new ObjectId(id)
    return this.updateOne(
      { _id: objectId } as Filter<CampaignDocument>,
      { $set: { ...metrics, updatedAt: new Date() } },
    )
  }

  async incrementMetric(id: string, field: 'sent' | 'delivered' | 'read' | 'failed', amount: number = 1) {
    const objectId = new ObjectId(id)
    return this.updateOne(
      { _id: objectId } as Filter<CampaignDocument>,
      { $inc: { [field]: amount }, $set: { updatedAt: new Date() } } as any,
    )
  }
}

export default new CampaignRepository()
