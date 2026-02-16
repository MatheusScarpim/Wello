import { ObjectId } from 'mongodb'

import { BaseRepository } from '../../core/repositories/BaseRepository'

export interface ThemeSettings {
  primaryColor: string
  primaryColorDark: string
  primaryColorLight: string
  accentColor: string
  sidebarBg: string
  sidebarText: string
  headerBg: string
  headerText: string
  fontFamily: string
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full'
}

export interface CompanyMetadata {
  address?: string
  phone?: string
  email?: string
  website?: string
  supportEmail?: string
  socialLinks?: {
    facebook?: string
    instagram?: string
    twitter?: string
    linkedin?: string
  }
}

export interface FeatureFlags {
  enableBots: boolean
  enableWebhooks: boolean
  enableExpenses: boolean
  enableStorage: boolean
  enableReports: boolean
  enableCannedResponses: boolean
  enableTags: boolean
  enableNotes: boolean
  maxDepartments: number
  maxOperators: number
  showOperatorNameInMessages: boolean
  defaultTtsVoice: string
  ttsModel: string
  ttsProvider: string
  elevenLabsVoiceId: string
}

export interface AutomaticMessageConfig {
  enabled: boolean
  message: string
}

export interface AutomaticMessages {
  welcome: AutomaticMessageConfig
  assign: AutomaticMessageConfig
  finalization: AutomaticMessageConfig
}

export interface IWhitelabelSettings {
  _id?: ObjectId
  companyName: string
  logo?: string
  logoSmall?: string
  favicon?: string
  loginBackground?: string
  protocolIdentifier?: string
  theme: ThemeSettings
  customCss?: string
  metadata: CompanyMetadata
  features: FeatureFlags
  automaticMessages?: AutomaticMessages
  createdAt: Date
  updatedAt: Date
}

export const defaultTheme: ThemeSettings = {
  primaryColor: '#cd2649',
  primaryColorDark: '#a31d3a',
  primaryColorLight: '#e85a7a',
  accentColor: '#2563eb',
  sidebarBg: '#1f2937',
  sidebarText: '#f9fafb',
  headerBg: '#ffffff',
  headerText: '#111827',
  fontFamily: 'Inter, system-ui, sans-serif',
  borderRadius: 'lg',
}

export const defaultFeatures: FeatureFlags = {
  enableBots: true,
  enableWebhooks: true,
  enableExpenses: true,
  enableStorage: true,
  enableReports: true,
  enableCannedResponses: true,
  enableTags: true,
  enableNotes: true,
  maxDepartments: 10,
  maxOperators: 50,
  showOperatorNameInMessages: false,
  defaultTtsVoice: 'nova',
  ttsModel: 'tts-1',
  ttsProvider: 'openai',
  elevenLabsVoiceId: '',
}

export const defaultAutomaticMessages: AutomaticMessages = {
  welcome: {
    enabled: false,
    message: 'Olá! Seja bem-vindo. Em breve um atendente irá atendê-lo.',
  },
  assign: {
    enabled: false,
    message: 'Olá! Meu nome é {operatorName} e vou atendê-lo.',
  },
  finalization: {
    enabled: false,
    message: 'Atendimento finalizado. Obrigado pelo contato!',
  },
}

export const defaultWhitelabelSettings: Omit<
  IWhitelabelSettings,
  '_id' | 'createdAt' | 'updatedAt'
> = {
  companyName: 'ScarlatChat',
  protocolIdentifier: '',
  theme: defaultTheme,
  metadata: {},
  features: defaultFeatures,
  automaticMessages: defaultAutomaticMessages,
}

export class WhitelabelRepository extends BaseRepository<IWhitelabelSettings> {
  constructor() {
    super('whitelabel_settings')
  }

  async getSettings(): Promise<IWhitelabelSettings> {
    let settings = await this.findOne({})

    if (!settings) {
      // Create default settings if none exist
      settings = await this.create({
        ...defaultWhitelabelSettings,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as IWhitelabelSettings)
    }

    return settings
  }

  async updateSettings(
    updates: Partial<IWhitelabelSettings>,
  ): Promise<IWhitelabelSettings | null> {
    const current = await this.getSettings()

    const updated = await this.upsert(
      { _id: current._id },
      {
        $set: {
          ...updates,
          updatedAt: new Date(),
        },
      },
    )

    return updated
  }

  async resetToDefault(): Promise<IWhitelabelSettings | null> {
    const current = await this.getSettings()

    return this.upsert(
      { _id: current._id },
      {
        $set: {
          ...defaultWhitelabelSettings,
          updatedAt: new Date(),
        },
      },
    )
  }
}

export default new WhitelabelRepository()
