import { Request, Response } from 'express'

import conversationRepository from '../repositories/ConversationRepository'
import operatorRepository from '../repositories/OperatorRepository'
import { BaseController } from './BaseController'

class DashboardController extends BaseController {
  /**
   * M�tricas do dashboard
   */
  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const [
        operators,
        totalConversations,
        activeConversations,
        waitingConversations,
        inProgressConversations,
        resolvedConversations,
      ] = await Promise.all([
        operatorRepository.findAll(),
        conversationRepository.count({}),
        conversationRepository.count({ status: 'active' }),
        conversationRepository.count({
          archived: false,
          operatorId: { $exists: false },
        }),
        conversationRepository.count({
          archived: false,
          operatorId: { $exists: true, $ne: null },
        }),
        conversationRepository.count({ archived: true }),
      ])

      const onlineOperators = operators.filter(
        (op) => op.status === 'online',
      ).length
      const busyOperators = operators.filter(
        (op) => op.status === 'busy',
      ).length
      const offlineOperators = operators.filter(
        (op) => op.status === 'offline',
      ).length

      const metrics = {
        overview: {
          totalConversations,
          activeConversations,
          waitingConversations,
          resolvedToday: resolvedConversations,
        },
        operators: {
          total: operators.length,
          online: onlineOperators,
          busy: busyOperators,
          offline: offlineOperators,
        },
        performance: {
          avgWaitTime: 0,
          avgResponseTime: 0,
          avgResolutionTime: 0,
          satisfaction: 0,
        },
        charts: {
          conversationsByHour: [],
          conversationsByDepartment: [],
          conversationsByStatus: [
            { status: 'waiting', count: waitingConversations },
            { status: 'in_progress', count: inProgressConversations },
            { status: 'resolved', count: resolvedConversations },
          ],
        },
      }

      this.sendSuccess(res, metrics)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Estat�sticas em tempo real
   */
  async getRealtimeStats(req: Request, res: Response): Promise<void> {
    try {
      const [operators, waitingConversations, activeConversations] =
        await Promise.all([
          operatorRepository.findOnline(),
          conversationRepository.count({
            archived: false,
            operatorId: { $exists: false },
          }),
          conversationRepository.count({
            archived: false,
            operatorId: { $exists: true, $ne: null },
          }),
        ])

      this.sendSuccess(res, {
        onlineOperators: operators.length,
        waitingConversations,
        activeConversations,
      })
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }
}

export default new DashboardController()
