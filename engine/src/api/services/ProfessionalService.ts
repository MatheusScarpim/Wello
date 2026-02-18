import { ObjectId } from 'mongodb'

import professionalRepository from '../repositories/ProfessionalRepository'

export interface ProfessionalPayload {
  name: string
  color: string
  serviceIds?: string[]
  phone?: string
  email?: string
  isActive?: boolean
}

export class ProfessionalService {
  async list() {
    return await professionalRepository.findAllSorted()
  }

  async listActive() {
    return await professionalRepository.findActive()
  }

  async findById(id: string) {
    if (!id) return null
    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
    return await professionalRepository.findById(objectId)
  }

  async create(payload: ProfessionalPayload) {
    const name = payload.name?.trim()
    if (!name) throw new Error('Nome do profissional e obrigatorio')

    const now = new Date()
    return await professionalRepository.create({
      name,
      color: payload.color || '#6366f1',
      serviceIds: payload.serviceIds || [],
      phone: payload.phone || undefined,
      email: payload.email || undefined,
      isActive: payload.isActive !== false,
      createdAt: now,
      updatedAt: now,
    } as any)
  }

  async update(id: string, payload: Partial<ProfessionalPayload>) {
    if (!id) throw new Error('Profissional invalido')

    const updateData: any = { updatedAt: new Date() }
    if (payload.name !== undefined) updateData.name = payload.name.trim()
    if (payload.color !== undefined) updateData.color = payload.color
    if (payload.serviceIds !== undefined) updateData.serviceIds = payload.serviceIds
    if (payload.phone !== undefined) updateData.phone = payload.phone
    if (payload.email !== undefined) updateData.email = payload.email
    if (payload.isActive !== undefined) updateData.isActive = payload.isActive

    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
    return await professionalRepository.updateOne(
      { _id: objectId } as any,
      { $set: updateData },
    )
  }

  async delete(id: string) {
    if (!id) return false
    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
    return await professionalRepository.deleteOne({ _id: objectId } as any)
  }
}

export default new ProfessionalService()
