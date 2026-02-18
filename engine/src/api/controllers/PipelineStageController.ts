import { Request, Response } from 'express'

import pipelineStageService, { PipelineStagePayload } from '../services/PipelineStageService'
import socketServer from '../socket/SocketServer'
import BaseController from './BaseController'

class PipelineStageController extends BaseController {
  async list(req: Request, res: Response) {
    try {
      const items = await pipelineStageService.list()
      this.sendSuccess(res, items)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async create(req: Request, res: Response) {
    try {
      const payload = req.body as PipelineStagePayload
      const validation = this.validateRequiredFields(payload, ['name', 'color'])
      if (!validation.valid) {
        return this.sendError(res, `Campos obrigatorios: ${validation.missing?.join(', ')}`)
      }

      const item = await pipelineStageService.create(payload)

      socketServer.emitPipelineUpdate({ type: 'stage_created', stageId: item?.insertedId?.toString() })

      this.sendSuccess(res, item, 'Etapa criada com sucesso', 201)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const payload = req.body as Partial<PipelineStagePayload>
      await pipelineStageService.update(id, payload)

      socketServer.emitPipelineUpdate({ type: 'stage_updated', stageId: id })

      this.sendSuccess(res, null, 'Etapa atualizada com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async reorder(req: Request, res: Response) {
    try {
      const { stages } = req.body
      if (!Array.isArray(stages)) {
        return this.sendError(res, 'Lista de etapas e obrigatoria')
      }

      await pipelineStageService.reorder(stages)

      socketServer.emitPipelineUpdate({ type: 'stage_reordered' })

      this.sendSuccess(res, null, 'Etapas reordenadas com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params
      await pipelineStageService.delete(id)

      socketServer.emitPipelineUpdate({ type: 'stage_deleted', stageId: id })

      this.sendSuccess(res, null, 'Etapa removida com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }
}

export default new PipelineStageController()
