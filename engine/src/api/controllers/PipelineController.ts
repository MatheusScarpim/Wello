import { Request, Response } from 'express'

import pipelineService from '../services/PipelineService'
import socketServer from '../socket/SocketServer'
import BaseController from './BaseController'

class PipelineController extends BaseController {
  async getBoard(req: Request, res: Response) {
    try {
      const board = await pipelineService.getBoard()
      this.sendSuccess(res, board)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async move(req: Request, res: Response) {
    try {
      const { conversationId, stageId } = req.body
      if (!conversationId) {
        return this.sendError(res, 'ID da conversa e obrigatorio')
      }

      await pipelineService.moveConversation(conversationId, stageId || null)

      socketServer.emitPipelineUpdate({
        type: 'move',
        conversationId,
        toStageId: stageId || null,
      })

      this.sendSuccess(res, null, 'Conversa movida com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async bulkMove(req: Request, res: Response) {
    try {
      const { conversationIds, stageId } = req.body
      if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
        return this.sendError(res, 'Lista de conversas e obrigatoria')
      }

      await pipelineService.bulkMoveConversations(conversationIds, stageId || null)

      socketServer.emitPipelineUpdate({
        type: 'bulk_move',
        conversationIds,
        toStageId: stageId || null,
      })

      this.sendSuccess(res, null, `${conversationIds.length} conversas movidas com sucesso`)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async getMetrics(req: Request, res: Response) {
    try {
      const metrics = await pipelineService.getMetrics()
      this.sendSuccess(res, metrics)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }
}

export default new PipelineController()
