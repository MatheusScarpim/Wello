import { ObjectId } from 'mongodb'

import { BaseRepository } from '../../core/repositories/BaseRepository'

export interface DaySchedule {
  enabled: boolean
  start: string
  end: string
}

export interface WeekSchedule {
  monday: DaySchedule
  tuesday: DaySchedule
  wednesday: DaySchedule
  thursday: DaySchedule
  friday: DaySchedule
  saturday: DaySchedule
  sunday: DaySchedule
}

export interface BusinessHours {
  enabled: boolean
  timezone: string
  schedule: WeekSchedule
}

export interface DepartmentSettings {
  maxConcurrentChats: number
  autoAssign: boolean
  welcomeMessage?: string
  offlineMessage?: string
  businessHours: BusinessHours
  priority: number
}

export interface IDepartment {
  _id?: ObjectId
  name: string
  description?: string
  color: string
  icon?: string
  isActive: boolean
  settings: DepartmentSettings
  operators: string[]
  createdAt: Date
  updatedAt: Date
}

const defaultSchedule: DaySchedule = {
  enabled: true,
  start: '09:00',
  end: '18:00',
}
const defaultWeekend: DaySchedule = {
  enabled: false,
  start: '09:00',
  end: '13:00',
}

export const defaultDepartmentSettings: DepartmentSettings = {
  maxConcurrentChats: 5,
  autoAssign: true,
  welcomeMessage: '',
  offlineMessage: '',
  priority: 1,
  businessHours: {
    enabled: false,
    timezone: 'America/Sao_Paulo',
    schedule: {
      monday: { ...defaultSchedule },
      tuesday: { ...defaultSchedule },
      wednesday: { ...defaultSchedule },
      thursday: { ...defaultSchedule },
      friday: { ...defaultSchedule },
      saturday: { ...defaultWeekend },
      sunday: { ...defaultWeekend },
    },
  },
}

export class DepartmentRepository extends BaseRepository<IDepartment> {
  constructor() {
    super('departments')
  }

  async findAll(): Promise<IDepartment[]> {
    return this.find({}, { sort: { priority: 1, name: 1 } })
  }

  async findActive(): Promise<IDepartment[]> {
    return this.find({ isActive: true }, { sort: { priority: 1, name: 1 } })
  }

  async findByOperator(operatorId: string): Promise<IDepartment[]> {
    return this.find({ operators: operatorId, isActive: true })
  }

  async addOperator(
    departmentId: string,
    operatorId: string,
  ): Promise<boolean> {
    return this.updateOne(
      { _id: new ObjectId(departmentId) },
      {
        $addToSet: { operators: operatorId },
        $set: { updatedAt: new Date() },
      },
    )
  }

  async removeOperator(
    departmentId: string,
    operatorId: string,
  ): Promise<boolean> {
    return this.updateOne(
      { _id: new ObjectId(departmentId) },
      {
        $pull: { operators: operatorId },
        $set: { updatedAt: new Date() },
      },
    )
  }

  async getStats(
    departmentId: string,
  ): Promise<{ waiting: number; active: number; resolved: number }> {
    // This would need to query the queue collection
    // For now return mock data
    return { waiting: 0, active: 0, resolved: 0 }
  }
}

export default new DepartmentRepository()
