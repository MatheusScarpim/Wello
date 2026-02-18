import { Request, Response } from 'express'

import appointmentService, { AppointmentPayload } from '../services/AppointmentService'
import BaseController from './BaseController'

class AppointmentController extends BaseController {
  async list(req: Request, res: Response) {
    try {
      const date = this.getQueryParam(req, 'date')
      const operatorId = this.getQueryParam(req, 'operatorId')
      const contactIdentifier = this.getQueryParam(req, 'contactIdentifier')
      const status = this.getQueryParam(req, 'status')
      const { page, limit } = this.getPagination(req)

      const items = await appointmentService.list({ date, operatorId, contactIdentifier, status, page, limit })
      this.sendSuccess(res, items)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async calendar(req: Request, res: Response) {
    try {
      const start = this.getQueryParam(req, 'start')
      const end = this.getQueryParam(req, 'end')

      if (!start || !end) {
        return this.sendError(res, 'Parametros start e end sao obrigatorios')
      }

      const items = await appointmentService.getCalendar(start, end)
      this.sendSuccess(res, items)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async slots(req: Request, res: Response) {
    try {
      const { date } = req.params
      if (!date) {
        return this.sendError(res, 'Data e obrigatoria')
      }

      const slots = await appointmentService.getAvailableSlots(date)
      this.sendSuccess(res, slots)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async create(req: Request, res: Response) {
    try {
      const payload = req.body as AppointmentPayload
      const validation = this.validateRequiredFields(payload, ['title', 'date'])
      if (!validation.valid) {
        return this.sendError(res, `Campos obrigatorios: ${validation.missing?.join(', ')}`)
      }

      const item = await appointmentService.create(payload)
      this.sendSuccess(res, item, 'Agendamento criado com sucesso', 201)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const payload = req.body as Partial<AppointmentPayload>
      await appointmentService.update(id, payload)
      this.sendSuccess(res, null, 'Agendamento atualizado com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async updateStatus(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { status } = req.body
      if (!status) {
        return this.sendError(res, 'Status e obrigatorio')
      }

      await appointmentService.updateStatus(id, status)
      this.sendSuccess(res, null, 'Status atualizado com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params
      await appointmentService.delete(id)
      this.sendSuccess(res, null, 'Agendamento removido com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }
}

export default new AppointmentController()
