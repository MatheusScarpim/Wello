import { ObjectId } from 'mongodb'

import { BaseRepository } from '../../core/repositories/BaseRepository'

export type IgPrivateStatus =
  | 'disconnected'
  | 'connecting'
  | 'challenge'
  | 'connected'
  | 'error'

export interface IInstagramPrivateInstance {
  _id?: ObjectId
  name: string
  sessionName: string
  username: string
  password: string
  sessionData: string | null
  status: IgPrivateStatus
  challengeType?: 'totp' | 'sms'
  profilePic?: string
  fullName?: string
  igUserId?: string
  botEnabled: boolean
  botId?: string | null
  departmentIds: string[]
  fairDistributionEnabled: boolean
  autoConnect: boolean
  createdAt: Date
  updatedAt: Date
  lastConnectedAt?: Date
}

export class InstagramPrivateInstanceRepository extends BaseRepository<IInstagramPrivateInstance> {
  constructor() {
    super('instagram_private_instances')
  }

  async findBySessionName(sessionName: string): Promise<IInstagramPrivateInstance | null> {
    return this.findOne({ sessionName })
  }

  async findAllActive(): Promise<IInstagramPrivateInstance[]> {
    return this.find({ autoConnect: true })
  }

  async findAll(): Promise<IInstagramPrivateInstance[]> {
    return this.find({}, { sort: { createdAt: -1 } })
  }

  async createInstance(
    data: Omit<IInstagramPrivateInstance, '_id' | 'createdAt' | 'updatedAt'>,
  ): Promise<IInstagramPrivateInstance> {
    const instance: IInstagramPrivateInstance = {
      ...data,
      sessionData: null,
      status: 'disconnected',
      botEnabled: data.botEnabled ?? true,
      botId: data.botId ?? null,
      departmentIds: data.departmentIds ?? [],
      fairDistributionEnabled: data.fairDistributionEnabled ?? false,
      autoConnect: data.autoConnect ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    return this.create(instance)
  }

  async updateStatus(
    sessionName: string,
    status: IgPrivateStatus,
    extra?: Partial<IInstagramPrivateInstance>,
  ): Promise<boolean> {
    const update: any = { status, updatedAt: new Date() }
    if (status === 'connected') update.lastConnectedAt = new Date()
    if (extra) Object.assign(update, extra)
    return this.updateOne({ sessionName }, { $set: update })
  }

  async updateSessionData(sessionName: string, sessionData: string | null): Promise<boolean> {
    return this.updateOne({ sessionName }, { $set: { sessionData, updatedAt: new Date() } })
  }

  async deleteInstance(id: string): Promise<boolean> {
    return this.deleteOne({ _id: new ObjectId(id) })
  }
}

export default new InstagramPrivateInstanceRepository()
