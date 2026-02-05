import { Request, Response } from 'express'

import {
  FinalizationMetricsService,
  PeriodFilter,
} from '../services/FinalizationMetricsService'
import { BaseController } from './BaseController'

/**
 * Controller para métricas de finalizações
 */
export class FinalizationMetricsController extends BaseController {
  private service: FinalizationMetricsService

  constructor() {
    super()
    this.service = new FinalizationMetricsService()
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
   * Busca métricas de finalizações
   * GET /api/finalization-metrics?period=today|week|month|custom&startDate=&endDate=
   */
  public getMetrics = this.asyncHandler(async (req: Request, res: Response) => {
    const period = this.getPeriodFromQuery(req)
    const operatorId = req.query.operatorId as string | undefined
    const finalizationType = req.query.finalizationType as
      | 'gain'
      | 'loss'
      | undefined
    const finalizationId = req.query.finalizationId as string | undefined

    const metrics = await this.service.getMetrics(period, {
      operatorId,
      finalizationType,
      finalizationId,
    })
    this.sendSuccess(res, metrics, 'Métricas de finalizações recuperadas')
  })

  /**
   * Busca lista detalhada de finalizações
   * GET /api/finalization-metrics/list?period=...&page=&limit=&operatorId=&finalizationType=
   */
  public getDetailedList = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { page, limit } = this.getPagination(req)
      const period = this.getPeriodFromQuery(req)
      const operatorId = req.query.operatorId as string | undefined
      const finalizationType = req.query.finalizationType as
        | 'gain'
        | 'loss'
        | undefined
      const finalizationId = req.query.finalizationId as string | undefined

      const result = await this.service.getDetailedList(
        period,
        page,
        limit,
        operatorId,
        finalizationType,
        finalizationId,
      )
      this.sendSuccess(res, result)
    },
  )
}
