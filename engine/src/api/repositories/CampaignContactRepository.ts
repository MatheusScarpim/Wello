import { Document, Filter, ObjectId } from 'mongodb'

import { BaseRepository } from '@/core/repositories/BaseRepository'

export interface CampaignContactDocument extends Document {
  campaignId: string
  contactId?: string
  phone: string
  name?: string
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  errorMessage?: string
  variables?: Record<string, string>
  sentAt?: Date
  deliveredAt?: Date
  readAt?: Date
  createdAt: Date
}

export class CampaignContactRepository extends BaseRepository<CampaignContactDocument> {
  constructor() {
    super('campaign_contacts')
  }

  async findByCampaign(campaignId: string, status?: string, page: number = 1, pageSize: number = 50) {
    const filter: any = { campaignId }
    if (status) filter.status = status
    return this.paginate(filter, page, pageSize, { sort: { createdAt: 1 } } as any)
  }

  async getPendingByCampaign(campaignId: string, limit: number = 50) {
    return this.find(
      { campaignId, status: 'pending' } as Filter<CampaignContactDocument>,
      { limit, sort: { createdAt: 1 } } as any,
    )
  }

  async updateStatus(
    id: string,
    status: 'sent' | 'delivered' | 'read' | 'failed',
    extra?: { errorMessage?: string; sentAt?: Date; deliveredAt?: Date; readAt?: Date },
  ) {
    const objectId = new ObjectId(id)
    return this.updateOne(
      { _id: objectId } as Filter<CampaignContactDocument>,
      { $set: { status, ...extra } },
    )
  }

  async getMetricsByCampaign(campaignId: string) {
    const [total, sent, delivered, read, failed, pending] = await Promise.all([
      this.count({ campaignId } as Filter<CampaignContactDocument>),
      this.count({ campaignId, status: 'sent' } as Filter<CampaignContactDocument>),
      this.count({ campaignId, status: 'delivered' } as Filter<CampaignContactDocument>),
      this.count({ campaignId, status: 'read' } as Filter<CampaignContactDocument>),
      this.count({ campaignId, status: 'failed' } as Filter<CampaignContactDocument>),
      this.count({ campaignId, status: 'pending' } as Filter<CampaignContactDocument>),
    ])
    return { total, sent, delivered, read, failed, pending }
  }

  async bulkInsert(contacts: CampaignContactDocument[]) {
    if (contacts.length === 0) return
    await this.collection.insertMany(contacts as any[])
  }

  async deleteByCampaign(campaignId: string) {
    return this.deleteMany({ campaignId } as Filter<CampaignContactDocument>)
  }
}

export default new CampaignContactRepository()
