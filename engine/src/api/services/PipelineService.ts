import { ObjectId } from 'mongodb'

import pipelineStageRepository from '../repositories/PipelineStageRepository'
import conversationRepository from '../repositories/ConversationRepository'

export class PipelineService {
  async getBoard() {
    const stages = await pipelineStageRepository.findAllSorted()
    const stageIds = new Set(stages.map((s) => s._id!.toString()))

    const columns = await Promise.all(
      stages.map(async (stage) => {
        const stageId = stage._id!.toString()
        const conversations = await conversationRepository.findByPipelineStage(stageId)
        return {
          stage,
          conversations,
          total: conversations.length,
        }
      }),
    )

    // Conversas sem etapa (null/undefined)
    const noStageConversations = await conversationRepository.findWithoutPipelineStage()

    // Conversas órfãs (pipelineStageId aponta para etapa que não existe mais)
    const allWithStage = await conversationRepository.find(
      {
        archived: false,
        pipelineStageId: { $nin: [null, ...Array.from(stageIds)], $exists: true },
      } as any,
      { sort: { updatedAt: -1 } } as any,
    )

    const orphanConversations = Array.isArray(allWithStage) ? allWithStage : []

    const noStageColumn = {
      stage: {
        _id: '__no_stage__',
        name: 'Sem etapa',
        color: '#6B7280',
        order: -1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      conversations: [...noStageConversations, ...orphanConversations],
      total: noStageConversations.length + orphanConversations.length,
    }

    return [noStageColumn, ...columns]
  }

  async moveConversation(conversationId: string, stageId: string | null) {
    if (!conversationId) {
      throw new Error('ID da conversa e obrigatorio')
    }

    // Mapear sentinel para null
    const effectiveStageId = stageId === '__no_stage__' || !stageId ? null : stageId

    if (effectiveStageId) {
      const stage = await pipelineStageRepository.findById(effectiveStageId)
      if (!stage) {
        throw new Error('Etapa nao encontrada')
      }
    }

    return await conversationRepository.updatePipelineStage(conversationId, effectiveStageId)
  }

  async bulkMoveConversations(conversationIds: string[], stageId: string | null) {
    const effectiveStageId = stageId === '__no_stage__' || !stageId ? null : stageId

    if (effectiveStageId) {
      const stage = await pipelineStageRepository.findById(effectiveStageId)
      if (!stage) {
        throw new Error('Etapa nao encontrada')
      }
    }

    const objectIds = conversationIds.map((id) =>
      ObjectId.isValid(id) ? new ObjectId(id) : id,
    )

    await conversationRepository.updateMany(
      { _id: { $in: objectIds } } as any,
      { $set: { pipelineStageId: effectiveStageId, updatedAt: new Date() } },
    )
  }

  async getMetrics() {
    const stages = await pipelineStageRepository.findAllSorted()

    const metrics = await Promise.all(
      stages.map(async (stage) => {
        const stageId = stage._id!.toString()
        const count = await conversationRepository.count({
          pipelineStageId: stageId,
          archived: false,
        } as any)
        return {
          stageId,
          stageName: stage.name,
          stageColor: stage.color,
          count,
        }
      }),
    )

    const totalInPipeline = metrics.reduce((sum, m) => sum + m.count, 0)

    const totalWithoutStage = await conversationRepository.count({
      archived: false,
      $or: [
        { pipelineStageId: { $exists: false } },
        { pipelineStageId: null },
      ],
    } as any)

    return {
      stages: metrics,
      totalInPipeline,
      totalWithoutStage,
    }
  }
}

export default new PipelineService()
