import { Document } from 'mongodb'

import { BaseRepository } from '@/core/repositories/BaseRepository'

export interface AppointmentDocument extends Document {
  contactId?: string
  contactName?: string
  contactIdentifier?: string
  operatorId?: string
  operatorName?: string
  professionalId?: string
  professionalName?: string
  serviceId?: string
  serviceName?: string
  title: string
  description?: string
  date: Date
  duration: number
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed'
  reminderSent: boolean
  googleCalendarEventId?: string
  syncSource?: 'local' | 'google'
  lastSyncedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export class AppointmentRepository extends BaseRepository<AppointmentDocument> {
  constructor() {
    super('appointments')
  }

  async findByDateRange(start: Date, end: Date): Promise<AppointmentDocument[]> {
    return await this.find(
      {
        date: { $gte: start, $lte: end },
        status: { $ne: 'cancelled' },
      } as any,
      { sort: { date: 1 } } as any,
    )
  }

  async findByContact(contactId: string): Promise<AppointmentDocument[]> {
    return await this.find(
      { contactId } as any,
      { sort: { date: -1 } } as any,
    )
  }

  async findByOperator(operatorId: string, start: Date, end: Date): Promise<AppointmentDocument[]> {
    return await this.find(
      {
        operatorId,
        date: { $gte: start, $lte: end },
        status: { $ne: 'cancelled' },
      } as any,
      { sort: { date: 1 } } as any,
    )
  }

  async findByDate(dateStr: string): Promise<AppointmentDocument[]> {
    const start = new Date(dateStr + 'T00:00:00.000Z')
    const end = new Date(dateStr + 'T23:59:59.999Z')
    return await this.findByDateRange(start, end)
  }

  async findTodayPendingReminders(): Promise<AppointmentDocument[]> {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    return await this.find(
      {
        date: { $gte: start, $lte: end },
        reminderSent: { $ne: true },
        status: { $in: ['scheduled', 'confirmed'] },
      } as any,
      { sort: { date: 1 } } as any,
    )
  }

  async findTodayAwaitingConfirmation(contactIdentifier: string): Promise<AppointmentDocument[]> {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    const phoneNumber = contactIdentifier.replace(/@.*$/, '')
    return await this.find(
      {
        date: { $gte: start, $lte: end },
        reminderSent: true,
        status: 'scheduled',
        contactIdentifier: { $regex: phoneNumber, $options: 'i' },
      } as any,
      { sort: { date: 1 } } as any,
    )
  }

  async findByProfessional(professionalId: string, start: Date, end: Date): Promise<AppointmentDocument[]> {
    return await this.find(
      {
        professionalId,
        date: { $gte: start, $lte: end },
        status: { $ne: 'cancelled' },
      } as any,
      { sort: { date: 1 } } as any,
    )
  }

  async findByGoogleEventId(googleCalendarEventId: string): Promise<AppointmentDocument | null> {
    return await this.findOne({ googleCalendarEventId } as any)
  }
}

export default new AppointmentRepository()
