import { Request, Response } from 'express'

import serviceService, { ServicePayload } from '../services/ServiceService'
import BaseController from './BaseController'

class ServiceController extends BaseController {
  async list(req: Request, res: Response) {
    try {
      const items = await serviceService.list()
      this.sendSuccess(res, items)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async create(req: Request, res: Response) {
    try {
      const payload = req.body as ServicePayload
      const validation = this.validateRequiredFields(payload, ['name'])
      if (!validation.valid) {
        return this.sendError(res, `Campos obrigatorios: ${validation.missing?.join(', ')}`)
      }

      const item = await serviceService.create(payload)
      this.sendSuccess(res, item, 'Servico criado com sucesso', 201)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const payload = req.body as Partial<ServicePayload>
      await serviceService.update(id, payload)
      this.sendSuccess(res, null, 'Servico atualizado com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params
      await serviceService.delete(id)
      this.sendSuccess(res, null, 'Servico removido com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }
}

export default new ServiceController()
