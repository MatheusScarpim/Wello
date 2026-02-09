import { ObjectId } from 'mongodb'

import { BaseRepository } from '../../core/repositories/BaseRepository'

export type InstanceStatus =
  | 'disconnected'
  | 'connecting'
  | 'qrcode'
  | 'connected'
  | 'error'

export type InstanceConnectionType = 'wppconnect' | 'meta_official'

export interface MetaInstanceConfig {
  enabled: boolean
  accessToken?: string
  phoneNumberId?: string
  instagramAccountId?: string
  apiVersion?: string
  baseUrl?: string
}

export interface AutomaticMessageConfig {
  enabled: boolean
  message: string
}

export interface InstanceAutomaticMessages {
  welcome: AutomaticMessageConfig
  assign: AutomaticMessageConfig
  finalization: AutomaticMessageConfig
}

export interface IWhatsAppInstance {
  _id?: ObjectId
  name: string
  sessionName: string
  connectionType?: InstanceConnectionType
  phoneNumber?: string
  profileName?: string
  status: InstanceStatus
  isDefault: boolean
  autoConnect: boolean
  webhookUrl?: string
  departmentIds: string[]
  fairDistributionEnabled: boolean
  botEnabled?: boolean
  botId?: string | null
  automaticMessages?: InstanceAutomaticMessages
  metaConfig?: MetaInstanceConfig
  createdAt: Date
  updatedAt: Date
  lastConnectedAt?: Date
}

export class WhatsAppInstanceRepository extends BaseRepository<IWhatsAppInstance> {
  constructor() {
    super('whatsapp_instances')
  }

  async findBySessionName(
    sessionName: string,
  ): Promise<IWhatsAppInstance | null> {
    return this.findOne({ sessionName })
  }

  async findByMetaPhoneNumberId(
    phoneNumberId: string,
  ): Promise<IWhatsAppInstance | null> {
    return this.findOne({
      connectionType: 'meta_official',
      'metaConfig.enabled': true,
      'metaConfig.phoneNumberId': phoneNumberId,
    } as any)
  }

  async findByInstagramAccountId(
    instagramAccountId: string,
  ): Promise<IWhatsAppInstance | null> {
    return this.findOne({
      connectionType: 'meta_official',
      'metaConfig.enabled': true,
      'metaConfig.instagramAccountId': instagramAccountId,
    } as any)
  }

  async findDefault(): Promise<IWhatsAppInstance | null> {
    return this.findOne({ isDefault: true })
  }

  async findAllActive(): Promise<IWhatsAppInstance[]> {
    return this.find({ autoConnect: true })
  }

  async findAll(): Promise<IWhatsAppInstance[]> {
    return this.find({}, { sort: { createdAt: -1 } })
  }

  async createInstance(
    data: Omit<IWhatsAppInstance, '_id' | 'createdAt' | 'updatedAt'>,
  ): Promise<IWhatsAppInstance> {
    console.log(
      `📦 WhatsAppInstanceRepository.createInstance -> ${data.name} (session=${data.sessionName})`,
    )

    // Se for default, remove o default de outras instâncias
    if (data.isDefault) {
      await this.updateMany({}, { $set: { isDefault: false } })
    }

    const instance: IWhatsAppInstance = {
      ...data,
      connectionType: data.connectionType || 'wppconnect',
      fairDistributionEnabled: data.fairDistributionEnabled ?? false,
      botEnabled: data.botEnabled ?? true,
      botId: data.botId ?? null,
      metaConfig:
        data.metaConfig && data.metaConfig.enabled
          ? {
              enabled: true,
              accessToken: data.metaConfig.accessToken,
              phoneNumberId: data.metaConfig.phoneNumberId,
              instagramAccountId: data.metaConfig.instagramAccountId,
              apiVersion: data.metaConfig.apiVersion || process.env.META_API_VERSION || 'v17.0',
              baseUrl:
                data.metaConfig.baseUrl || process.env.URL_META || 'https://graph.facebook.com',
            }
          : data.metaConfig,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await this.create(instance)
    console.log(
      `📦 WhatsAppInstanceRepository.createInstance -> ${data.name} criada com _id=${result._id}`,
    )
    return result
  }

  async updateStatus(
    sessionName: string,
    status: InstanceStatus,
    extra?: Partial<IWhatsAppInstance>,
  ): Promise<boolean> {
    const update: any = {
      status,
      updatedAt: new Date(),
    }

    if (status === 'connected') {
      update.lastConnectedAt = new Date()
    }

    if (extra) {
      Object.assign(update, extra)
    }

    return this.updateOne({ sessionName }, { $set: update })
  }

  async setDefault(id: string): Promise<boolean> {
    // Remove default de todas
    await this.updateMany({}, { $set: { isDefault: false } })
    // Define a nova default
    return this.updateOne(
      { _id: new ObjectId(id) },
      { $set: { isDefault: true, updatedAt: new Date() } },
    )
  }

  async deleteInstance(id: string): Promise<boolean> {
    return this.deleteOne({ _id: new ObjectId(id) })
  }
}

export default new WhatsAppInstanceRepository()
