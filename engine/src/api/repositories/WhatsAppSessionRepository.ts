import type { tokenStore } from '@wppconnect-team/wppconnect'
import { ObjectId } from 'mongodb'

import { BaseRepository } from '../../core/repositories/BaseRepository'

export interface IWhatsAppSession {
  _id?: ObjectId
  sessionName: string
  phoneNumber?: string
  tokens: tokenStore.SessionToken
  createdAt: Date
  updatedAt: Date
}

export class WhatsAppSessionRepository extends BaseRepository<IWhatsAppSession> {
  constructor() {
    super('whatsapp_sessions')
  }

  async findBySessionName(
    sessionName: string,
  ): Promise<IWhatsAppSession | null> {
    return this.findOne({ sessionName })
  }

  async listSessionNames(): Promise<string[]> {
    const sessions = await this.collection
      .find({}, { projection: { sessionName: 1 } })
      .toArray()

    return sessions.map((session) => session.sessionName)
  }

  async upsertToken(
    sessionName: string,
    tokens: tokenStore.SessionToken,
    phoneNumber?: string,
  ): Promise<boolean> {
    const now = new Date()

    const update: any = {
      $set: {
        tokens,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    }

    if (phoneNumber) {
      update.$set.phoneNumber = phoneNumber
    }

    try {
      const result = await this.collection.updateOne({ sessionName }, update, {
        upsert: true,
      })

      console.log(
        `📦 WhatsAppSessionRepository.upsertToken -> ${sessionName}: acknowledged=${result.acknowledged}, upserted=${result.upsertedCount}, modified=${result.modifiedCount}`,
      )
      return result.acknowledged
    } catch (error) {
      console.error(
        `📦 WhatsAppSessionRepository.upsertToken -> ${sessionName} ERRO:`,
        error,
      )
      throw error
    }
  }

  async removeToken(sessionName: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ sessionName })
    return result.deletedCount > 0
  }

  async updatePhoneNumber(
    sessionName: string,
    phoneNumber: string,
  ): Promise<boolean> {
    return this.updateOne(
      { sessionName },
      {
        $set: {
          phoneNumber,
          updatedAt: new Date(),
        },
      },
    )
  }
}

export default new WhatsAppSessionRepository()
