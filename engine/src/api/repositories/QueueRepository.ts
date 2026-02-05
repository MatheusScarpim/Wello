import { Filter, ObjectId } from 'mongodb'

import { BaseRepository } from '../../core/repositories/BaseRepository'

export type QueueStatus =
  | 'waiting'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'transferred'

export interface IQueueItem {
  _id?: ObjectId
  conversationId: string
  departmentId?: string
  operatorId?: string
  status: QueueStatus
  priority: number
  waitTime: number
  tags: string[]
  notes?: string
  createdAt: Date
  assignedAt?: Date
  resolvedAt?: Date
  updatedAt: Date
}

export interface QueueFilters {
  status?: QueueStatus
  departmentId?: string
  operatorId?: string
}

export class QueueRepository extends BaseRepository<IQueueItem> {
  constructor() {
    super('queue')
  }

  async findByConversation(conversationId: string): Promise<IQueueItem | null> {
    return this.findOne({ conversationId })
  }

  async findWaiting(departmentId?: string): Promise<IQueueItem[]> {
    const filter: Filter<IQueueItem> = { status: 'waiting' }
    if (departmentId) {
      filter.departmentId = departmentId
    }
    return this.find(filter, { sort: { priority: -1, createdAt: 1 } })
  }

  async findByOperator(operatorId: string): Promise<IQueueItem[]> {
    return this.find(
      { operatorId, status: { $in: ['assigned', 'in_progress'] } },
      { sort: { createdAt: -1 } },
    )
  }

  async addToQueue(
    conversationId: string,
    departmentId?: string,
    priority: number = 1,
  ): Promise<IQueueItem> {
    const existing = await this.findByConversation(conversationId)

    if (
      existing &&
      ['waiting', 'assigned', 'in_progress'].includes(existing.status)
    ) {
      return existing
    }

    const item: IQueueItem = {
      conversationId,
      departmentId,
      status: 'waiting',
      priority,
      waitTime: 0,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    return this.create(item)
  }

  async assignToOperator(
    conversationId: string,
    operatorId: string,
  ): Promise<boolean> {
    const item = await this.findByConversation(conversationId)
    if (!item) return false

    const waitTime = Math.floor((Date.now() - item.createdAt.getTime()) / 1000)

    return this.updateOne(
      { conversationId },
      {
        $set: {
          operatorId,
          status: 'in_progress',
          waitTime,
          assignedAt: new Date(),
          updatedAt: new Date(),
        },
      },
    )
  }

  async releaseFromOperator(conversationId: string): Promise<boolean> {
    return this.updateOne(
      { conversationId },
      {
        $set: {
          status: 'waiting',
          updatedAt: new Date(),
        },
        $unset: { operatorId: '', assignedAt: '' },
      },
    )
  }

  async resolve(conversationId: string, notes?: string): Promise<boolean> {
    return this.updateOne(
      { conversationId },
      {
        $set: {
          status: 'resolved',
          notes,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        },
      },
    )
  }

  async transfer(
    conversationId: string,
    targetType: 'department' | 'operator',
    targetId: string,
    notes?: string,
  ): Promise<boolean> {
    const update: any = {
      $set: {
        status: targetType === 'operator' ? 'assigned' : 'waiting',
        notes,
        updatedAt: new Date(),
      },
    }

    if (targetType === 'department') {
      update.$set.departmentId = targetId
      update.$unset = { operatorId: '' }
    } else {
      update.$set.operatorId = targetId
      update.$set.assignedAt = new Date()
    }

    return this.updateOne({ conversationId }, update)
  }

  async addTags(conversationId: string, tags: string[]): Promise<boolean> {
    return this.updateOne(
      { conversationId },
      {
        $addToSet: { tags: { $each: tags } },
        $set: { updatedAt: new Date() },
      },
    )
  }

  async addNote(conversationId: string, note: string): Promise<boolean> {
    return this.updateOne(
      { conversationId },
      {
        $set: { notes: note, updatedAt: new Date() },
      },
    )
  }

  async getStats(): Promise<{
    waiting: number
    inProgress: number
    resolved: number
    avgWaitTime: number
  }> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [waiting, inProgress, resolvedToday, avgWaitTimeResult] =
      await Promise.all([
        this.count({ status: 'waiting' }),
        this.count({ status: { $in: ['assigned', 'in_progress'] } }),
        this.count({ status: 'resolved', resolvedAt: { $gte: today } }),
        this.collection
          .aggregate([
            { $match: { status: 'resolved', resolvedAt: { $gte: today } } },
            { $group: { _id: null, avgWaitTime: { $avg: '$waitTime' } } },
          ])
          .toArray(),
      ])

    return {
      waiting,
      inProgress,
      resolved: resolvedToday,
      avgWaitTime: Math.round(avgWaitTimeResult[0]?.avgWaitTime || 0),
    }
  }

  async updateWaitTimes(): Promise<void> {
    const waitingItems = await this.findWaiting()
    const now = Date.now()

    for (const item of waitingItems) {
      const waitTime = Math.floor((now - item.createdAt.getTime()) / 1000)
      await this.updateOne({ _id: item._id }, { $set: { waitTime } })
    }
  }
}

export default new QueueRepository()
