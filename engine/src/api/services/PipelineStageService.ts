import { ObjectId } from 'mongodb'

import pipelineStageRepository from '../repositories/PipelineStageRepository'
import conversationRepository from '../repositories/ConversationRepository'

export interface PipelineStagePayload {
  name: string
  color: string
  order?: number
}

export class PipelineStageService {
  async list() {
    return await pipelineStageRepository.findAllSorted()
  }

  async findById(id: string) {
    if (!id) return null
    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
    return await pipelineStageRepository.findById(objectId)
  }

  async create(payload: PipelineStagePayload) {
    const name = payload.name?.trim()
    if (!name) {
      throw new Error('Nome da etapa e obrigatorio')
    }

    const order = payload.order ?? await pipelineStageRepository.getNextOrder()
    const now = new Date()

    return await pipelineStageRepository.create({
      name,
      color: payload.color || '#6366f1',
      order,
      createdAt: now,
      updatedAt: now,
    } as any)
  }

  async update(id: string, payload: Partial<PipelineStagePayload>) {
    if (!id) throw new Error('Etapa invalida')

    const updateData: any = { updatedAt: new Date() }
    if (payload.name !== undefined) updateData.name = payload.name.trim()
    if (payload.color !== undefined) updateData.color = payload.color
    if (payload.order !== undefined) updateData.order = payload.order

    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
    return await pipelineStageRepository.updateOne(
      { _id: objectId } as any,
      { $set: updateData },
    )
  }

  async reorder(stages: { id: string; order: number }[]) {
    const promises = stages.map(({ id, order }) => {
      const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
      return pipelineStageRepository.updateOne(
        { _id: objectId } as any,
        { $set: { order, updatedAt: new Date() } },
      )
    })
    await Promise.all(promises)
    return true
  }

  async delete(id: string) {
    if (!id) return false

    // Mover conversas desta etapa para "Sem etapa" antes de deletar
    await conversationRepository.updateMany(
      { pipelineStageId: id } as any,
      { $set: { pipelineStageId: null, updatedAt: new Date() } },
    )

    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
    return await pipelineStageRepository.deleteOne({ _id: objectId } as any)
  }
}

export default new PipelineStageService()
