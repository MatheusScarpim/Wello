import { Document } from 'mongodb'

import { BaseRepository } from '@/core/repositories/BaseRepository'

export interface DayConfig {
  enabled: boolean
  start: string
  end: string
}

export interface AvailabilityDocument extends Document {
  slotDuration: number
  schedule: {
    monday: DayConfig
    tuesday: DayConfig
    wednesday: DayConfig
    thursday: DayConfig
    friday: DayConfig
    saturday: DayConfig
    sunday: DayConfig
  }
  blockedDates: string[]
  createdAt: Date
  updatedAt: Date
}

const DEFAULT_SETTINGS: Omit<AvailabilityDocument, '_id'> = {
  slotDuration: 30,
  schedule: {
    monday: { enabled: true, start: '08:00', end: '18:00' },
    tuesday: { enabled: true, start: '08:00', end: '18:00' },
    wednesday: { enabled: true, start: '08:00', end: '18:00' },
    thursday: { enabled: true, start: '08:00', end: '18:00' },
    friday: { enabled: true, start: '08:00', end: '17:00' },
    saturday: { enabled: false, start: '08:00', end: '12:00' },
    sunday: { enabled: false, start: '08:00', end: '12:00' },
  },
  blockedDates: [],
  createdAt: new Date(),
  updatedAt: new Date(),
}

export class AvailabilityRepository extends BaseRepository<AvailabilityDocument> {
  constructor() {
    super('availability_settings')
  }

  async getSettings(): Promise<AvailabilityDocument> {
    const settings = await this.findOne({} as any)
    if (settings) return settings

    return await this.create(DEFAULT_SETTINGS as any)
  }

  async updateSettings(data: Partial<AvailabilityDocument>): Promise<boolean> {
    const settings = await this.getSettings()
    return await this.updateOne(
      { _id: settings._id } as any,
      { $set: { ...data, updatedAt: new Date() } },
    )
  }
}

export default new AvailabilityRepository()
