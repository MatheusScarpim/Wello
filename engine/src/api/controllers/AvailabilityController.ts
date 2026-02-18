import { Request, Response } from 'express'

import availabilityService from '../services/AvailabilityService'
import BaseController from './BaseController'

class AvailabilityController extends BaseController {
  async get(req: Request, res: Response) {
    try {
      const settings = await availabilityService.getSettings()
      this.sendSuccess(res, settings)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async update(req: Request, res: Response) {
    try {
      const data = req.body
      await availabilityService.updateSettings(data)
      this.sendSuccess(res, null, 'Disponibilidade atualizada com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }
}

export default new AvailabilityController()
