import DatabaseManager from '@/core/database/DatabaseManager'



import { ConversationDocument } from '../repositories/ConversationRepository'



export interface PeriodFilter {

  startDate: Date

  endDate: Date

}



export interface OperatorFinalizationSummary {

  operatorId: string

  operatorName: string

  total: number

  gains: number

  losses: number

}



export interface FinalizationTypeSummary {

  finalizationId: string

  finalizationName: string

  finalizationType: 'gain' | 'loss'

  count: number

}



export interface FinalizationDetail {
  conversationId: string
  identifier: string
  name?: string
  operatorId?: string
  operatorName?: string
  finalizationId?: string
  finalizationName?: string
  finalizationType?: 'gain' | 'loss'
  finalizationNotes?: string
  finalizationAt?: Date
  finalizations?: Array<{
    finalizationId?: string
    finalizationName?: string
    finalizationType?: 'gain' | 'loss'
  }>
}
export interface FinalizationDayMetric {

  date: string

  gains: number

  losses: number

  total: number

}



export interface FinalizationCharts {

  byDay: FinalizationDayMetric[]

  byOperator: Array<{

    name: string

    total: number

    gains: number

    losses: number

  }>

  byType: Array<{ name: string; type: 'gain' | 'loss'; count: number }>

}



export interface FinalizationMetrics {

  total: number

  gains: number

  losses: number

  byOperator: OperatorFinalizationSummary[]

  byFinalizationType: FinalizationTypeSummary[]

  recentFinalizations: FinalizationDetail[]

  charts: FinalizationCharts

}



export class FinalizationMetricsService {

  private get collection() {

    return DatabaseManager.getCollection<ConversationDocument>('conversations')

  }



  private applyFinalizationIdFilter(

    target: Record<string, any>,

    finalizationId?: string,

  ) {

    if (!finalizationId) return



    const clause = {

      $or: [

        { 'finalizations.finalizationId': finalizationId },

        { finalizationId },

      ],

    }



    if (target.$and) {

      target.$and.push(clause)

      return

    }



    const existingA = target.$and ?? undefined

    const existingO = target.$or ?? undefined



    const carry = { ...target }

    delete carry.$and

    delete carry.$or



    Object.keys(target).forEach((key) => delete target[key])



    const clauses = []

    if (existingA) {

      clauses.push({ $and: existingA })

    }

    if (existingO) {

      clauses.push({ $or: existingO })

    }

    if (Object.keys(carry).length > 0) {

      clauses.push(carry)

    }

    clauses.push(clause)



    target.$and = clauses

  }



  private get finalizationEntriesExpression() {

    return {

      $cond: [

        { $gt: [{ $size: { $ifNull: ['$finalizations', []] } }, 0] },

        '$finalizations',

        {

          $cond: [

            {

              $and: [

                { $ifNull: ['$finalizationId', false] },

                { $ifNull: ['$finalizationType', false] },

              ],

            },

            [

              {

                finalizationId: '$finalizationId',

                finalizationName: '$finalizationName',

                finalizationType: '$finalizationType',

              },

            ],

            [],

          ],

        },

      ],

    }

  }



  async getMetrics(
    period: PeriodFilter,
    options?: {
      finalizationId?: string
      operatorId?: string
      finalizationType?: 'gain' | 'loss'
    },
  ): Promise<FinalizationMetrics> {
    const baseMatch: Record<string, any> = {
      archived: true,
      finalizationAt: {
        $gte: period.startDate,
        $lte: period.endDate,
      },
    }
    this.applyFinalizationIdFilter(baseMatch, options?.finalizationId)
    if (options?.operatorId) {
      baseMatch.operatorId = options.operatorId
    }
    if (options?.finalizationType) {
      baseMatch.finalizationType = options.finalizationType
    }


    // Agregação para totais

    const totals = await this.collection

      .aggregate([

        { $match: baseMatch },

        {

          $group: {

            _id: null,

            total: { $sum: 1 },

            gains: {

              $sum: { $cond: [{ $eq: ['$finalizationType', 'gain'] }, 1, 0] },

            },

            losses: {

              $sum: { $cond: [{ $eq: ['$finalizationType', 'loss'] }, 1, 0] },

            },

          },

        },

      ])

      .toArray()



    // Agregação por operador

    const byOperatorRaw = await this.collection

      .aggregate([

        { $match: baseMatch },

        {

          $group: {

            _id: { operatorId: '$operatorId', operatorName: '$operatorName' },

            total: { $sum: 1 },

            gains: {

              $sum: { $cond: [{ $eq: ['$finalizationType', 'gain'] }, 1, 0] },

            },

            losses: {

              $sum: { $cond: [{ $eq: ['$finalizationType', 'loss'] }, 1, 0] },

            },

          },

        },

        { $sort: { total: -1 } },

        { $limit: 20 },

      ])

      .toArray()



    // Agregação por tipo de finalização

    const byFinalizationTypeRaw = await this.collection

      .aggregate([

        {

          $match: baseMatch,

        },

        {

          $project: {

            finalizationEntries: this.finalizationEntriesExpression,

          },

        },

        {

          $unwind: {

            path: '$finalizationEntries',

            preserveNullAndEmptyArrays: false,

          },

        },

        {

          $group: {

            _id: {

              finalizationId: '$finalizationEntries.finalizationId',

              finalizationName: '$finalizationEntries.finalizationName',

              finalizationType: '$finalizationEntries.finalizationType',

            },

            count: { $sum: 1 },

          },

        },

        { $sort: { count: -1 } },

      ])

      .toArray()



    // Detalhes recentes

    const recentFinalizationsRaw = await this.collection

      .find(baseMatch, {

        projection: {

          _id: 1,

          identifier: 1,

          name: 1,

          operatorId: 1,

          operatorName: 1,

          finalizationId: 1,

          finalizationName: 1,

          finalizationType: 1,

          finalizationNotes: 1,

          finalizationAt: 1,

          finalizations: this.finalizationEntriesExpression,

        },

        sort: { finalizationAt: -1 },

        limit: 50,

      })

      .toArray()



    // Agregação por dia para gráficos

    const byDayRaw = await this.collection

      .aggregate([

        { $match: baseMatch },

        {

          $group: {

            _id: {

              $dateToString: { format: '%Y-%m-%d', date: '$finalizationAt' },

            },

            gains: {

              $sum: { $cond: [{ $eq: ['$finalizationType', 'gain'] }, 1, 0] },

            },

            losses: {

              $sum: { $cond: [{ $eq: ['$finalizationType', 'loss'] }, 1, 0] },

            },

            total: { $sum: 1 },

          },

        },

        { $sort: { _id: 1 } },

      ])

      .toArray()



    return {

      total: totals[0]?.total || 0,

      gains: totals[0]?.gains || 0,

      losses: totals[0]?.losses || 0,

      byOperator: byOperatorRaw.map((item) => ({

        operatorId: item._id?.operatorId || '',

        operatorName: item._id?.operatorName || 'Desconhecido',

        total: item.total,

        gains: item.gains,

        losses: item.losses,

      })),

      byFinalizationType: byFinalizationTypeRaw.map((item) => ({

        finalizationId: item._id?.finalizationId || '',

        finalizationName: item._id?.finalizationName || 'Sem nome',

        finalizationType: item._id?.finalizationType || 'gain',

        count: item.count,

      })),

      recentFinalizations: recentFinalizationsRaw.map((item) => ({

        conversationId: item._id?.toString() || '',

        identifier: item.identifier,

        name: item.name,

        operatorId: item.operatorId,

        operatorName: item.operatorName,

      finalizationId: item.finalizationId,

      finalizationName: item.finalizationName,

      finalizationType: item.finalizationType,

      finalizationNotes: item.finalizationNotes,

      finalizationAt: item.finalizationAt,

      finalizations: item.finalizations,

      })),

      charts: {

        byDay: byDayRaw.map((item) => ({

          date: item._id,

          gains: item.gains,

          losses: item.losses,

          total: item.total,

        })),

        byOperator: byOperatorRaw.map((item) => ({

          name: item._id?.operatorName || 'Desconhecido',

          total: item.total,

          gains: item.gains,

          losses: item.losses,

        })),

        byType: byFinalizationTypeRaw.map((item) => ({

          name: item._id?.finalizationName || 'Sem nome',

          type: item._id?.finalizationType || 'gain',

          count: item.count,

        })),

      },

    }

  }



  async getDetailedList(

    period: PeriodFilter,

    page: number = 1,

    limit: number = 20,

    operatorId?: string,

    finalizationType?: 'gain' | 'loss',

    finalizationId?: string,

  ) {

    const filter: any = {

      archived: true,

      finalizationAt: {

        $gte: period.startDate,

        $lte: period.endDate,

      },

    }

    this.applyFinalizationIdFilter(filter, finalizationId)



    if (operatorId) {

      filter.operatorId = operatorId

    }



    if (finalizationType) {

      filter.finalizationType = finalizationType

    }



    const safePage = Math.max(1, page)

    const pageSize = Math.max(1, limit)

    const skip = (safePage - 1) * pageSize



    const [data, total] = await Promise.all([

      this.collection

      .find(filter, {

        projection: {

          _id: 1,

          identifier: 1,

          name: 1,

          operatorId: 1,

          operatorName: 1,

          finalizationId: 1,

          finalizationName: 1,

          finalizationType: 1,

          finalizationNotes: 1,

          finalizationAt: 1,

          finalizations: this.finalizationEntriesExpression,

        },

        sort: { finalizationAt: -1 },

        skip,

        limit: pageSize,

      })

      .toArray(),

      this.collection.countDocuments(filter),

    ])



    return {

      items: data.map((item) => ({
        conversationId: item._id?.toString() || '',
        identifier: item.identifier,
        name: item.name,
        operatorId: item.operatorId,
        operatorName: item.operatorName,
        finalizationId: item.finalizationId,
        finalizationName: item.finalizationName,
        finalizationType: item.finalizationType,
        finalizationNotes: item.finalizationNotes,
        finalizationAt: item.finalizationAt,
        finalizations: item.finalizations,
      })),
      pagination: {

        total,

        page: safePage,

        pageSize,

        totalPages: Math.max(1, Math.ceil(total / pageSize)),

      },

    }

  }

}

