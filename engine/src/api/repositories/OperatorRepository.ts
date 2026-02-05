import { ObjectId } from 'mongodb'

import { BaseRepository } from '../../core/repositories/BaseRepository'

export type OperatorRole = 'admin' | 'supervisor' | 'operator'
export type OperatorStatus = 'online' | 'away' | 'busy' | 'offline'

export interface OperatorSettings {
  maxConcurrentChats: number
  receiveNotifications: boolean
  soundEnabled: boolean
  autoAcceptChats: boolean
}

export interface OperatorMetrics {
  totalChats: number
  activeChats: number
  avgResponseTime: number
  avgResolutionTime: number
  satisfaction: number
  todayChats: number
}

export interface IOperator {
  _id?: ObjectId
  name: string
  email: string
  password?: string
  avatar?: string
  role: OperatorRole
  status: OperatorStatus
  departmentIds: string[]
  settings: OperatorSettings
  metrics?: OperatorMetrics
  lastActivity?: Date
  createdAt: Date
  updatedAt: Date
}

export const defaultOperatorSettings: OperatorSettings = {
  maxConcurrentChats: 5,
  receiveNotifications: true,
  soundEnabled: true,
  autoAcceptChats: false,
}

export class OperatorRepository extends BaseRepository<IOperator> {
  constructor() {
    super('operators')
  }

  async findAll(): Promise<IOperator[]> {
    const operators = await this.find({}, { sort: { name: 1 } })
    return operators.map((op) => ({ ...op, password: undefined }))
  }

  async findByEmail(email: string): Promise<IOperator | null> {
    return this.findOne({ email })
  }

  async findByStatus(status: OperatorStatus): Promise<IOperator[]> {
    const operators = await this.find({ status }, { sort: { name: 1 } })
    return operators.map((op) => ({ ...op, password: undefined }))
  }

  async findByDepartment(departmentId: string): Promise<IOperator[]> {
    const operators = await this.find(
      { departmentIds: departmentId },
      { sort: { name: 1 } },
    )
    return operators.map((op) => ({ ...op, password: undefined }))
  }

  async findOnline(): Promise<IOperator[]> {
    const operators = await this.find(
      { status: { $in: ['online', 'busy'] } },
      { sort: { name: 1 } },
    )
    return operators.map((op) => ({ ...op, password: undefined }))
  }

  async updateStatus(
    operatorId: string,
    status: OperatorStatus,
  ): Promise<boolean> {
    return this.updateOne(
      { _id: new ObjectId(operatorId) },
      {
        $set: {
          status,
          lastActivity: new Date(),
          updatedAt: new Date(),
        },
      },
    )
  }

  async validateCredentials(
    email: string,
    password: string,
  ): Promise<IOperator | null> {
    const operator = await this.findOne({ email, password })
    if (operator) {
      return { ...operator, password: undefined }
    }
    return null
  }

  async touchActivity(userId?: string, email?: string): Promise<boolean> {
    const now = new Date()
    let filter: any = null

    if (userId && ObjectId.isValid(userId)) {
      filter = { _id: new ObjectId(userId) }
    } else if (email) {
      filter = { email }
    }

    if (!filter) return false

    return this.updateOne(filter, {
      $set: {
        status: 'online',
        lastActivity: now,
        updatedAt: now,
      },
    })
  }

  async markInactiveAsAway(inactiveSince: Date): Promise<number> {
    const result = await this.collection.updateMany(
      {
        status: { $in: ['online', 'busy'] },
        lastActivity: { $lte: inactiveSince },
      },
      {
        $set: {
          status: 'away',
          updatedAt: new Date(),
        },
      },
    )

    return result.modifiedCount || 0
  }
}

export default new OperatorRepository()
