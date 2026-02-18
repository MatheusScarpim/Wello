import { ObjectId } from 'mongodb'

import serviceRepository from '../repositories/ServiceRepository'

export interface ServicePayload {
  name: string
  defaultDuration: number
  color: string
  description?: string
}

export class ServiceService {
  async list() {
    return await serviceRepository.findAllSorted()
  }

  async findById(id: string) {
    if (!id) return null
    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
    return await serviceRepository.findById(objectId)
  }

  async create(payload: ServicePayload) {
    const name = payload.name?.trim()
    if (!name) throw new Error('Nome do servico e obrigatorio')

    const now = new Date()
    return await serviceRepository.create({
      name,
      defaultDuration: payload.defaultDuration || 30,
      color: payload.color || '#6366f1',
      description: payload.description || undefined,
      createdAt: now,
      updatedAt: now,
    } as any)
  }

  async update(id: string, payload: Partial<ServicePayload>) {
    if (!id) throw new Error('Servico invalido')

    const updateData: any = { updatedAt: new Date() }
    if (payload.name !== undefined) updateData.name = payload.name.trim()
    if (payload.defaultDuration !== undefined) updateData.defaultDuration = payload.defaultDuration
    if (payload.color !== undefined) updateData.color = payload.color
    if (payload.description !== undefined) updateData.description = payload.description

    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
    return await serviceRepository.updateOne(
      { _id: objectId } as any,
      { $set: updateData },
    )
  }

  async delete(id: string) {
    if (!id) return false
    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
    return await serviceRepository.deleteOne({ _id: objectId } as any)
  }
}

export default new ServiceService()
