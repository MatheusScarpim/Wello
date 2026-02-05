import DatabaseManager from '@/core/database/DatabaseManager'

import { ConversationDocument } from '../repositories/ConversationRepository'
import { MessageDocument } from '../repositories/MessageRepository'

export interface PeriodFilter {
  startDate: Date
  endDate: Date
}

export interface MessageDayMetric {
  date: string
  sent: number
  received: number
  total: number
}

export interface MessageOperatorMetric {
  operatorId: string
  operatorName: string
  sent: number
  received: number
  total: number
}

export interface MessageHourMetric {
  hour: number
  count: number
}

export interface MessageMetrics {
  overview: {
    totalMessages: number
    totalSent: number
    totalReceived: number
    avgResponseTimeMs: number
  }
  byDay: MessageDayMetric[]
  byOperator: MessageOperatorMetric[]
  byHour: MessageHourMetric[]
}

export class MessageMetricsService {
  private get messagesCollection() {
    return DatabaseManager.getCollection<MessageDocument>('messages')
  }

  private get conversationsCollection() {
    return DatabaseManager.getCollection<ConversationDocument>('conversations')
  }

  async getMetrics(period: PeriodFilter): Promise<MessageMetrics> {
    const dateMatch = {
      createdAt: {
        $gte: period.startDate,
        $lte: period.endDate,
      },
    }

    const [overview, byDay, byOperator, byHour] = await Promise.all([
      this.getOverview(dateMatch),
      this.getMessagesByDay(dateMatch),
      this.getMessagesByOperator(period),
      this.getMessagesByHour(dateMatch),
    ])

    return {
      overview,
      byDay,
      byOperator,
      byHour,
    }
  }

  private async getOverview(dateMatch: any) {
    const totals = await this.messagesCollection
      .aggregate([
        { $match: dateMatch },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            sent: {
              $sum: { $cond: [{ $eq: ['$direction', 'outgoing'] }, 1, 0] },
            },
            received: {
              $sum: { $cond: [{ $eq: ['$direction', 'incoming'] }, 1, 0] },
            },
          },
        },
      ])
      .toArray()

    const avgResponseTime = await this.calculateAverageResponseTime(dateMatch)

    return {
      totalMessages: totals[0]?.total || 0,
      totalSent: totals[0]?.sent || 0,
      totalReceived: totals[0]?.received || 0,
      avgResponseTimeMs: avgResponseTime,
    }
  }

  private async getMessagesByDay(dateMatch: any): Promise<MessageDayMetric[]> {
    const results = await this.messagesCollection
      .aggregate([
        { $match: dateMatch },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            sent: {
              $sum: { $cond: [{ $eq: ['$direction', 'outgoing'] }, 1, 0] },
            },
            received: {
              $sum: { $cond: [{ $eq: ['$direction', 'incoming'] }, 1, 0] },
            },
            total: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray()

    return results.map((item) => ({
      date: item._id,
      sent: item.sent,
      received: item.received,
      total: item.total,
    }))
  }

  private async getMessagesByOperator(
    period: PeriodFilter,
  ): Promise<MessageOperatorMetric[]> {
    // Primeiro, buscar conversas finalizadas no período com operador
    const conversations = await this.conversationsCollection
      .find(
        {
          operatorId: { $exists: true, $ne: null },
          $or: [
            {
              finalizationAt: {
                $gte: period.startDate,
                $lte: period.endDate,
              },
            },
            {
              updatedAt: {
                $gte: period.startDate,
                $lte: period.endDate,
              },
              archived: false,
            },
          ],
        },
        {
          projection: { _id: 1, operatorId: 1, operatorName: 1 },
        },
      )
      .toArray()

    // Criar map de conversationId -> operador
    const conversationOperatorMap = new Map<
      string,
      { operatorId: string; operatorName: string }
    >()
    conversations.forEach((conv) => {
      if (conv._id && conv.operatorId) {
        conversationOperatorMap.set(conv._id.toString(), {
          operatorId: conv.operatorId,
          operatorName: conv.operatorName || 'Desconhecido',
        })
      }
    })

    const conversationIds = Array.from(conversationOperatorMap.keys())

    if (conversationIds.length === 0) {
      return []
    }

    // Agregar mensagens por conversationId
    const messagesByConversation = await this.messagesCollection
      .aggregate([
        {
          $match: {
            conversationId: { $in: conversationIds },
            createdAt: {
              $gte: period.startDate,
              $lte: period.endDate,
            },
          },
        },
        {
          $group: {
            _id: '$conversationId',
            sent: {
              $sum: { $cond: [{ $eq: ['$direction', 'outgoing'] }, 1, 0] },
            },
            received: {
              $sum: { $cond: [{ $eq: ['$direction', 'incoming'] }, 1, 0] },
            },
            total: { $sum: 1 },
          },
        },
      ])
      .toArray()

    // Agregar por operador
    const operatorMetrics = new Map<string, MessageOperatorMetric>()

    messagesByConversation.forEach((item) => {
      const operator = conversationOperatorMap.get(item._id)
      if (!operator) return

      const existing = operatorMetrics.get(operator.operatorId)
      if (existing) {
        existing.sent += item.sent
        existing.received += item.received
        existing.total += item.total
      } else {
        operatorMetrics.set(operator.operatorId, {
          operatorId: operator.operatorId,
          operatorName: operator.operatorName,
          sent: item.sent,
          received: item.received,
          total: item.total,
        })
      }
    })

    return Array.from(operatorMetrics.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)
  }

  private async getMessagesByHour(
    dateMatch: any,
  ): Promise<MessageHourMetric[]> {
    const results = await this.messagesCollection
      .aggregate([
        { $match: dateMatch },
        {
          $group: {
            _id: { $hour: '$createdAt' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray()

    // Preencher todas as 24 horas
    const hourMap = new Map<number, number>()
    results.forEach((item) => hourMap.set(item._id, item.count))

    const hourMetrics: MessageHourMetric[] = []
    for (let hour = 0; hour < 24; hour++) {
      hourMetrics.push({
        hour,
        count: hourMap.get(hour) || 0,
      })
    }

    return hourMetrics
  }

  private async calculateAverageResponseTime(dateMatch: any): Promise<number> {
    // Buscar pares de mensagens incoming seguidas de outgoing na mesma conversa
    // para calcular tempo médio de resposta
    const conversations = await this.messagesCollection
      .aggregate([
        { $match: dateMatch },
        { $sort: { conversationId: 1, createdAt: 1 } },
        {
          $group: {
            _id: '$conversationId',
            messages: {
              $push: {
                direction: '$direction',
                createdAt: '$createdAt',
              },
            },
          },
        },
        { $limit: 1000 }, // Limitar para performance
      ])
      .toArray()

    let totalResponseTime = 0
    let responseCount = 0

    conversations.forEach((conv) => {
      const messages = conv.messages
      for (let i = 0; i < messages.length - 1; i++) {
        // Se mensagem atual é incoming e próxima é outgoing
        if (
          messages[i].direction === 'incoming' &&
          messages[i + 1].direction === 'outgoing'
        ) {
          const incoming = new Date(messages[i].createdAt).getTime()
          const outgoing = new Date(messages[i + 1].createdAt).getTime()
          const responseTime = outgoing - incoming

          // Ignorar respostas > 24h (provavelmente não são respostas diretas)
          if (responseTime > 0 && responseTime < 86400000) {
            totalResponseTime += responseTime
            responseCount++
          }
        }
      }
    })

    return responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0
  }
}
