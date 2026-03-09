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

  /**
   * Busca campanhas recentes enviadas para um telefone (últimas 48h)
   * Tenta múltiplas variantes do número (com/sem 9 para BR)
   */
  async findRecentByPhone(phone: string, hoursAgo: number = 48): Promise<CampaignContactDocument[]> {
    const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
    const cleaned = phone.replace(/\D/g, '')

    // Gerar variantes do telefone para cobrir diferenças de formatação
    const phoneVariants = [cleaned]

    // BR: se tem 13 dígitos (55 + DDD + 9 + número), gera versão sem o 9
    if (cleaned.startsWith('55') && cleaned.length === 13) {
      phoneVariants.push(`55${cleaned.charAt(2)}${cleaned.substring(4)}`)
    }
    // BR: se tem 12 dígitos (55 + DDD + número sem 9), gera versão com o 9
    if (cleaned.startsWith('55') && cleaned.length === 12) {
      phoneVariants.push(`55${cleaned.charAt(2)}9${cleaned.substring(3)}`)
    }

    return this.find(
      {
        phone: { $in: phoneVariants },
        status: { $in: ['sent', 'delivered', 'read'] },
        sentAt: { $gte: since },
      } as Filter<CampaignContactDocument>,
      { sort: { sentAt: -1 }, limit: 3 } as any,
    )
  }
}

export default new CampaignContactRepository()
