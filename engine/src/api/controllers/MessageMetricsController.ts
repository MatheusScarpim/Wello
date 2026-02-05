import { Request, Response } from 'express'

import {
  MessageMetricsService,
  PeriodFilter,
} from '../services/MessageMetricsService'
import { BaseController } from './BaseController'

export class MessageMetricsController extends BaseController {
  private service: MessageMetricsService

  constructor() {
    super()
    this.service = new MessageMetricsService()
  }

  private getPeriodFromQuery(req: Request): PeriodFilter {
    const period = (req.query.period as string) || 'today'
    const now = new Date()
    let startDate: Date
    let endDate = new Date(now)
    endDate.setHours(23, 59, 59, 999)

    switch (period) {
      case 'today':
        startDate = new Date()
        startDate.setHours(0, 0, 0, 0)
        break
      case 'week':
        startDate = new Date()
        startDate.setDate(startDate.getDate() - 7)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'month':
        startDate = new Date()
        startDate.setMonth(startDate.getMonth() - 1)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'custom':
        startDate = new Date(req.query.startDate as string)
        endDate = new Date(req.query.endDate as string)
        endDate.setHours(23, 59, 59, 999)
        break
      default:
        startDate = new Date()
        startDate.setHours(0, 0, 0, 0)
    }

    return { startDate, endDate }
  }

  /**
   * Busca métricas de mensagens
   * GET /api/message-metrics?period=today|week|month|custom&startDate=&endDate=
   */
  public getMetrics = this.asyncHandler(async (req: Request, res: Response) => {
    const period = this.getPeriodFromQuery(req)
    const metrics = await this.service.getMetrics(period)
    this.sendSuccess(res, metrics, 'Métricas de mensagens recuperadas')
  })
}
