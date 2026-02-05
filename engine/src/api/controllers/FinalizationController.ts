import { Request, Response } from 'express'

import finalizationService, {
  FinalizationPayload,
} from '../services/FinalizationService'
import BaseController from './BaseController'

class FinalizationController extends BaseController {
  async list(req: Request, res: Response) {
    try {
      const items = await finalizationService.list()
      this.sendSuccess(res, items)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async create(req: Request, res: Response) {
    try {
      const payload = req.body as FinalizationPayload
      const item = await finalizationService.create(payload)
      this.sendSuccess(res, item, 'Finalizacao criada com sucesso', 201)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const payload = req.body as FinalizationPayload
      await finalizationService.update(id, payload)
      this.sendSuccess(res, null, 'Finalizacao atualizada com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params
      await finalizationService.delete(id)
      this.sendSuccess(res, null, 'Finalizacao removida com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }
}

export default new FinalizationController()
