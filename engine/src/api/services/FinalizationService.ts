import { ObjectId } from 'mongodb'

import finalizationRepository from '../repositories/FinalizationRepository'

export interface FinalizationPayload {
  name: string
  type: 'gain' | 'loss'
}

export class FinalizationService {
  async list() {
    return await finalizationRepository.find({}, { sort: { createdAt: -1 } })
  }

  async findById(id: string) {
    if (!id) return null
    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
    return await finalizationRepository.findById(objectId)
  }

  async findByIds(ids: string[]) {
    if (!ids || ids.length === 0) {
      return []
    }

    const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
    if (uniqueIds.length === 0) {
      return []
    }

    const objectIds = uniqueIds.map(id =>
      ObjectId.isValid(id) ? new ObjectId(id) : id,
    )

    const items = await finalizationRepository.find(
      { _id: { $in: objectIds } } as any,
    )

    const map = new Map<string, typeof items[number]>()
    items.forEach(item => {
      const key = item._id?.toString()
      if (key) {
        map.set(key, item)
      }
    })

    return uniqueIds
      .map(id => map.get(id))
      .filter((item): item is typeof items[number] => Boolean(item))
  }

  async create(payload: FinalizationPayload) {
    const name = payload.name?.trim()
    if (!name) {
      throw new Error('Nome da finalizacao e obrigatorio')
    }

    const now = new Date()
    return await finalizationRepository.create({
      name,
      type: payload.type,
      createdAt: now,
      updatedAt: now,
    } as any)
  }

  async update(id: string, payload: FinalizationPayload) {
    if (!id) throw new Error('Finalizacao invalida')

    const name = payload.name?.trim()
    if (!name) {
      throw new Error('Nome da finalizacao e obrigatorio')
    }

    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
    return await finalizationRepository.updateOne({ _id: objectId } as any, {
      $set: {
        name,
        type: payload.type,
        updatedAt: new Date(),
      },
    })
  }

  async delete(id: string) {
    if (!id) return false
    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
    return await finalizationRepository.deleteOne({ _id: objectId } as any)
  }
}

export default new FinalizationService()
