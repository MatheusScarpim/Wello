import { Document } from 'mongodb'

import { BaseRepository } from '@/core/repositories/BaseRepository'

/**
 * Documento de despesa
 */
export interface ExpenseDocument extends Document {
  obra: string
  cliente: string
  documentoVinculado: string
  dataVencimento: Date
  descricao: string
  tipoDespesa: string
  centroCusto: string
  valor: number
  semNotaEmitida?: boolean
  dependeFechamentoLoja?: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Repositório para despesas
 */
export class ExpenseRepository extends BaseRepository<ExpenseDocument> {
  constructor() {
    super('expenses')
  }

  /**
   * Retorna clientes distintos (opcionalmente filtrando por busca parcial)
   */
  async listDistinctClientes(search?: string): Promise<string[]> {
    const filter: any = {}

    if (search) {
      filter.cliente = { $regex: search, $options: 'i' }
    }

    return this.collection.distinct('cliente', filter)
  }
}
