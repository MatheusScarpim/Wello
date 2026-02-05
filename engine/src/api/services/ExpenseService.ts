import { ObjectId } from 'mongodb'

import {
  ExpenseDocument,
  ExpenseRepository,
} from '../repositories/ExpenseRepository'

export interface CreateExpenseParams {
  obra: string
  cliente: string
  documentoVinculado: string
  dataVencimento: string | Date
  descricao: string
  tipoDespesa: string
  centroCusto: string
  valor: number | string
  semNotaEmitida?: boolean
  dependeFechamentoLoja?: boolean
}

export interface ExpenseFilters {
  obra?: string
  cliente?: string
  tipoDespesa?: string
  centroCusto?: string
  documentoVinculado?: string
  vencimentoDe?: string
  vencimentoAte?: string
  search?: string
}

export class ExpenseService {
  private repository: ExpenseRepository

  constructor() {
    this.repository = new ExpenseRepository()
  }

  /**
   * Cria uma nova despesa
   */
  async createExpense(params: CreateExpenseParams): Promise<ExpenseDocument> {
    const dataVencimento = this.parseDate(params.dataVencimento)
    if (!dataVencimento) {
      throw new Error('Data de vencimento inválida')
    }

    const valor = this.parseValor(params.valor)

    const now = new Date()
    const expense: ExpenseDocument = {
      obra: params.obra,
      cliente: params.cliente,
      documentoVinculado: params.documentoVinculado,
      dataVencimento,
      descricao: params.descricao,
      tipoDespesa: params.tipoDespesa,
      centroCusto: params.centroCusto,
      valor,
      semNotaEmitida: Boolean(params.semNotaEmitida),
      dependeFechamentoLoja: Boolean(params.dependeFechamentoLoja),
      createdAt: now,
      updatedAt: now,
    } as ExpenseDocument

    return await this.repository.create(expense)
  }

  /**
   * Lista despesas com filtros e paginação
   */
  async listExpenses(filters: ExpenseFilters, page: number, limit: number) {
    const query: any = {}

    if (filters.obra) {
      query.obra = { $regex: filters.obra, $options: 'i' }
    }

    if (filters.cliente) {
      query.cliente = { $regex: filters.cliente, $options: 'i' }
    }

    if (filters.tipoDespesa) {
      query.tipoDespesa = filters.tipoDespesa
    }

    if (filters.centroCusto) {
      query.centroCusto = filters.centroCusto
    }

    if (filters.documentoVinculado) {
      query.documentoVinculado = {
        $regex: filters.documentoVinculado,
        $options: 'i',
      }
    }

    if (filters.search) {
      query.$or = [
        { descricao: { $regex: filters.search, $options: 'i' } },
        { obra: { $regex: filters.search, $options: 'i' } },
        { cliente: { $regex: filters.search, $options: 'i' } },
      ]
    }

    const dateRange: any = {}
    if (filters.vencimentoDe) {
      const inicio = this.parseDate(filters.vencimentoDe)
      if (!inicio) {
        throw new Error('Data inicial de vencimento inválida')
      }
      dateRange.$gte = inicio
    }

    if (filters.vencimentoAte) {
      const fim = this.parseDate(filters.vencimentoAte, true)
      if (!fim) {
        throw new Error('Data final de vencimento inválida')
      }
      dateRange.$lte = fim
    }

    if (Object.keys(dateRange).length > 0) {
      query.dataVencimento = dateRange
    }

    const result = await this.repository.paginate(query, page, limit, {
      sort: { dataVencimento: 1, createdAt: -1 },
    })

    return {
      items: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
    }
  }

  /**
   * Busca despesa por ID
   */
  async getExpenseById(id: string) {
    return await this.repository.findById(id)
  }

  /**
   * Retorna dados consolidados para planilha semanal (sexta -> quinta)
   */
  async getWeeklySheet(params: { cliente?: string; referenceDate?: string }) {
    const { cliente, referenceDate } = params
    const { inicio, fim } = this.getWeekRange(referenceDate)

    const filter: any = {
      dataVencimento: {
        $gte: inicio,
        $lte: fim,
      },
    }

    if (cliente) {
      filter.cliente = cliente
    }

    const expenses = await this.repository.find(filter, {
      sort: { dataVencimento: 1, createdAt: -1 },
    } as any)

    const totalValor = expenses.reduce(
      (sum, item) => sum + (item.valor || 0),
      0,
    )

    return {
      periodo: {
        inicio: inicio.toISOString().slice(0, 10),
        fim: fim.toISOString().slice(0, 10),
      },
      totalItens: expenses.length,
      totalValor,
      itens: expenses.map((item) => ({
        id: item._id?.toString(),
        obra: item.obra,
        cliente: item.cliente,
        descricao: item.descricao,
        tipoDespesa: item.tipoDespesa,
        centroCusto: item.centroCusto,
        dataVencimento: item.dataVencimento.toISOString().slice(0, 10),
        valor: item.valor,
        semNotaEmitida: Boolean(item.semNotaEmitida),
        dependeFechamentoLoja: Boolean(item.dependeFechamentoLoja),
      })),
    }
  }

  /**
   * Lista clientes distintos presentes nas despesas
   */
  async getClientes(search?: string): Promise<string[]> {
    return this.repository.listDistinctClientes(search)
  }

  /**
   * Atualiza uma despesa
   */
  async updateExpense(
    id: string,
    updates: Partial<CreateExpenseParams>,
  ): Promise<boolean> {
    const data: Partial<ExpenseDocument> = {}

    if (updates.obra !== undefined) data.obra = updates.obra
    if (updates.cliente !== undefined) data.cliente = updates.cliente
    if (updates.documentoVinculado !== undefined)
      data.documentoVinculado = updates.documentoVinculado
    if (updates.descricao !== undefined) data.descricao = updates.descricao
    if (updates.tipoDespesa !== undefined)
      data.tipoDespesa = updates.tipoDespesa
    if (updates.centroCusto !== undefined)
      data.centroCusto = updates.centroCusto
    if (updates.semNotaEmitida !== undefined)
      data.semNotaEmitida = Boolean(updates.semNotaEmitida)
    if (updates.dependeFechamentoLoja !== undefined) {
      data.dependeFechamentoLoja = Boolean(updates.dependeFechamentoLoja)
    }

    if (updates.dataVencimento !== undefined) {
      const parsed = this.parseDate(updates.dataVencimento)
      if (!parsed) {
        throw new Error('Data de vencimento inválida')
      }
      data.dataVencimento = parsed
    }

    if (updates.valor !== undefined) {
      data.valor = this.parseValor(updates.valor)
    }

    data.updatedAt = new Date()

    return await this.repository.updateOne(
      { _id: new ObjectId(id) } as any,
      { $set: data } as any,
    )
  }

  private parseDate(
    value: string | Date,
    endOfDay: boolean = false,
  ): Date | null {
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value
    }

    const parsed = new Date(value)
    if (isNaN(parsed.getTime())) {
      return null
    }

    if (endOfDay) {
      parsed.setHours(23, 59, 59, 999)
    }

    return parsed
  }

  private parseValor(value: number | string): number {
    const normalized =
      typeof value === 'string'
        ? Number(value.replace(/\./g, '').replace(',', '.'))
        : Number(value)

    if (isNaN(normalized)) {
      throw new Error('Valor inválido')
    }

    return normalized
  }

  private getWeekRange(referenceDate?: string) {
    const ref = referenceDate ? this.parseDate(referenceDate) : new Date()
    if (!ref) {
      throw new Error('Data de referência inválida')
    }

    const base = new Date(ref)
    base.setHours(0, 0, 0, 0)

    const day = base.getDay() // 0=domingo ... 5=sexta
    const offsetFromFriday = (day + 7 - 5) % 7 // dias para voltar até sexta
    const inicio = new Date(base)
    inicio.setDate(base.getDate() - offsetFromFriday)
    inicio.setHours(0, 0, 0, 0)

    const fim = new Date(inicio)
    fim.setDate(inicio.getDate() + 6)
    fim.setHours(23, 59, 59, 999)

    return { inicio, fim }
  }
}
