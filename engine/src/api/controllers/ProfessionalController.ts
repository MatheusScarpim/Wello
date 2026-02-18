import { Request, Response } from 'express'

import professionalService, { ProfessionalPayload } from '../services/ProfessionalService'
import BaseController from './BaseController'

class ProfessionalController extends BaseController {
  async list(req: Request, res: Response) {
    try {
      const items = await professionalService.list()
      this.sendSuccess(res, items)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async listActive(req: Request, res: Response) {
    try {
      const items = await professionalService.listActive()
      this.sendSuccess(res, items)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async create(req: Request, res: Response) {
    try {
      const payload = req.body as ProfessionalPayload
      const validation = this.validateRequiredFields(payload, ['name', 'color'])
      if (!validation.valid) {
        return this.sendError(res, `Campos obrigatorios: ${validation.missing?.join(', ')}`)
      }

      const item = await professionalService.create(payload)
      this.sendSuccess(res, item, 'Profissional criado com sucesso', 201)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const payload = req.body as Partial<ProfessionalPayload>
      await professionalService.update(id, payload)
      this.sendSuccess(res, null, 'Profissional atualizado com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params
      await professionalService.delete(id)
      this.sendSuccess(res, null, 'Profissional removido com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }
}

export default new ProfessionalController()
