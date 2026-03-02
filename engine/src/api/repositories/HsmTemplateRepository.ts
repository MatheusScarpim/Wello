import { Document, Filter, ObjectId } from 'mongodb'

import { BaseRepository } from '@/core/repositories/BaseRepository'

export interface HsmComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  text?: string
  buttons?: HsmButton[]
  example?: Record<string, any>
}

export interface HsmButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'
  text: string
  url?: string
  phoneNumber?: string
}

export interface HsmVariable {
  key: string
  example: string
  position: number
}

export interface HsmTemplateDocument extends Document {
  name: string
  category: 'marketing' | 'utility' | 'authentication'
  language: string
  components: HsmComponent[]
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  rejectionReason?: string
  metaTemplateId?: string
  metaTemplateName?: string
  instanceId?: string
  wabaId?: string
  variables: HsmVariable[]
  createdAt: Date
  updatedAt: Date
}

export class HsmTemplateRepository extends BaseRepository<HsmTemplateDocument> {
  constructor() {
    super('hsm_templates')
  }

  async findByInstance(instanceId: string) {
    return this.find({ instanceId } as Filter<HsmTemplateDocument>)
  }

  async findByStatus(status: string) {
    return this.find({ status } as Filter<HsmTemplateDocument>)
  }

  async findApproved(instanceId?: string) {
    const filter: any = { status: 'approved' }
    if (instanceId) filter.instanceId = instanceId
    return this.find(filter)
  }

  async findByMetaTemplateId(metaTemplateId: string) {
    return this.findOne({ metaTemplateId } as Filter<HsmTemplateDocument>)
  }

  async upsertByMetaId(metaTemplateId: string, doc: Partial<HsmTemplateDocument>) {
    return this.upsert(
      { metaTemplateId } as Filter<HsmTemplateDocument>,
      { $set: { ...doc, updatedAt: new Date() } },
    )
  }
}

export default new HsmTemplateRepository()
