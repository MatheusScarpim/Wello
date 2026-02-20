import { Document } from 'mongodb'

import { BaseRepository } from '@/core/repositories/BaseRepository'

export interface GoogleCalendarSettingsDocument extends Document {
  accessToken: string
  refreshToken: string
  tokenExpiry: Date
  calendarId: string
  isConnected: boolean
  lastSyncAt?: Date
  watchChannelId?: string
  watchResourceId?: string
  watchExpiration?: Date
  syncToken?: string
  createdAt: Date
  updatedAt: Date
}

export class GoogleCalendarSettingsRepository extends BaseRepository<GoogleCalendarSettingsDocument> {
  constructor() {
    super('google_calendar_settings')
  }

  async getSettings(): Promise<GoogleCalendarSettingsDocument | null> {
    return await this.findOne({} as any)
  }

  async saveSettings(data: Partial<GoogleCalendarSettingsDocument>): Promise<GoogleCalendarSettingsDocument | null> {
    return await this.upsert(
      {} as any,
      { $set: { ...data, updatedAt: new Date() } },
    )
  }

  async updateTokens(accessToken: string, refreshToken: string, tokenExpiry: Date): Promise<boolean> {
    return await this.updateOne(
      {} as any,
      { $set: { accessToken, refreshToken, tokenExpiry, updatedAt: new Date() } },
    )
  }

  async updateSyncInfo(lastSyncAt: Date, syncToken?: string): Promise<boolean> {
    const update: any = { lastSyncAt, updatedAt: new Date() }
    if (syncToken !== undefined) update.syncToken = syncToken
    return await this.updateOne({} as any, { $set: update })
  }

  async updateWatchInfo(channelId: string, resourceId: string, expiration: Date): Promise<boolean> {
    return await this.updateOne(
      {} as any,
      { $set: { watchChannelId: channelId, watchResourceId: resourceId, watchExpiration: expiration, updatedAt: new Date() } },
    )
  }
}

export default new GoogleCalendarSettingsRepository()
