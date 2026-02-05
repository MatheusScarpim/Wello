import { Document, ObjectId } from 'mongodb'

import DatabaseManager from '../../core/database/DatabaseManager'
import { BaseRepository } from '../../core/repositories/BaseRepository'

export interface IaConfigDocument extends Document {
  _id?: ObjectId
  companyDescription?: string
  suggestionInstructions?: string
  aiModel?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  createdAt: Date
  updatedAt: Date
}

export interface IaSuggestionLogDocument extends Document {
  _id?: ObjectId
  conversationId: string
  operatorId?: string
  suggestion: string
  confidence: number
  context?: {
    lastMessages?: number
    conversationStatus?: string
  }
  used: boolean
  createdAt: Date
}

export class IaRepository extends BaseRepository<IaConfigDocument> {
  private suggestionLogCollection = 'ia_suggestion_logs'

  constructor() {
    super('ia_config')
  }

  async getConfig(): Promise<IaConfigDocument | null> {
    const configs = await this.find({} as any, { limit: 1 })
    return configs[0] || null
  }

  async saveConfig(
    config: Partial<IaConfigDocument>,
  ): Promise<IaConfigDocument> {
    const existingConfig = await this.getConfig()

    if (existingConfig && existingConfig._id) {
      await this.updateOne({ _id: existingConfig._id } as any, {
        $set: {
          ...config,
          updatedAt: new Date(),
        },
      })
      return {
        ...existingConfig,
        ...config,
        updatedAt: new Date(),
      } as IaConfigDocument
    }

    const newConfig: IaConfigDocument = {
      companyDescription: config.companyDescription || '',
      suggestionInstructions: config.suggestionInstructions || '',
      aiModel: config.aiModel || 'gpt-4o-mini',
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 500,
      systemPrompt: config.systemPrompt || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    return await this.create(newConfig)
  }

  async getCompanyDescription(): Promise<string> {
    const config = await this.getConfig()
    return config?.companyDescription || ''
  }

  async saveCompanyDescription(description: string): Promise<void> {
    await this.saveConfig({ companyDescription: description })
  }

  async getSuggestionInstructions(): Promise<string> {
    const config = await this.getConfig()
    return config?.suggestionInstructions || ''
  }

  async saveSuggestionInstructions(instructions: string): Promise<void> {
    await this.saveConfig({ suggestionInstructions: instructions })
  }

  async logSuggestion(
    log: Omit<IaSuggestionLogDocument, '_id' | 'createdAt'>,
  ): Promise<void> {
    const logCollection = this.getCollectionByName<IaSuggestionLogDocument>(
      this.suggestionLogCollection,
    )
    await logCollection.insertOne({
      ...log,
      createdAt: new Date(),
    } as IaSuggestionLogDocument)
  }

  async getSuggestionLogs(
    conversationId: string,
    limit: number = 10,
  ): Promise<IaSuggestionLogDocument[]> {
    const logCollection = this.getCollectionByName<IaSuggestionLogDocument>(
      this.suggestionLogCollection,
    )
    return await logCollection
      .find({ conversationId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()
  }

  private getCollectionByName<T extends Document>(name: string) {
    return DatabaseManager.getCollection<T>(name)
  }
}
