import { Request, Response } from 'express'

import { ExpenseService } from '../services/ExpenseService'
import { BaseController } from './BaseController'

/**
 * Controller para gerenciamento de despesas
 */
export class ExpenseController extends BaseController {
  private service: ExpenseService

  constructor() {
    super()
    this.service = new ExpenseService()
  }

  /**
   * Lista despesas com filtros
   * GET /api/expenses
   */
  public listExpenses = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { page, limit } = this.getPagination(req)
      const source: any = req.method === 'GET' ? req.query : req.body || {}

      const filters = {
        obra: source.obra as string,
        cliente: source.cliente as string,
        tipoDespesa: source.tipoDespesa as string,
        centroCusto: source.centroCusto as string,
        documentoVinculado: source.documentoVinculado as string,
        vencimentoDe: source.vencimentoDe as string,
        vencimentoAte: source.vencimentoAte as string,
        search: source.search as string,
      }

      try {
        const result = await this.service.listExpenses(filters, page, limit)
        this.sendSuccess(res, result)
      } catch (error: any) {
        this.sendError(res, error.message || 'Erro ao listar despesas', 400)
      }
    },
  )

  /**
   * Lista clientes distintos (para filtros/autocomplete)
   * GET /api/expenses/clients
   */
  public getClientes = this.asyncHandler(
    async (req: Request, res: Response) => {
      const search = this.getQueryParam(req, 'search')

      try {
        const clientes = await this.service.getClientes(search)
        this.sendSuccess(res, clientes)
      } catch (error: any) {
        this.sendError(res, error.message || 'Erro ao listar clientes', 400)
      }
    },
  )

  /**
   * Planilha semanal (sexta -> quinta)
   * GET /api/expenses/weekly-sheet?cliente=ID
   */
  public weeklySheet = this.asyncHandler(
    async (req: Request, res: Response) => {
      const cliente = this.getQueryParam(req, 'cliente')
      const referenceDate =
        this.getQueryParam(req, 'data') ||
        this.getQueryParam(req, 'referenceDate')

      try {
        const result = await this.service.getWeeklySheet({
          cliente,
          referenceDate,
        })
        this.sendSuccess(res, result)
      } catch (error: any) {
        this.sendError(
          res,
          error.message || 'Erro ao gerar planilha semanal',
          400,
        )
      }
    },
  )

  /**
   * Busca despesa por ID
   * GET /api/expenses/:id
   */
  public getExpense = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    if (!id) {
      return this.sendError(res, 'ID é obrigatório', 400)
    }

    const expense = await this.service.getExpenseById(id)

    if (!expense) {
      return this.sendError(res, 'Despesa não encontrada', 404)
    }

    this.sendSuccess(res, expense)
  })

  /**
   * Cria uma nova despesa
   * POST /api/expenses
   */
  public createExpense = this.asyncHandler(
    async (req: Request, res: Response) => {
      const requiredFields = [
        'obra',
        'cliente',
        'documentoVinculado',
        'dataVencimento',
        'descricao',
        'tipoDespesa',
        'centroCusto',
        'valor',
      ]

      const validation = this.validateRequiredFields(req.body, requiredFields)
      if (!validation.valid) {
        return this.sendError(res, 'Campos obrigatórios faltando', 400, {
          missing: validation.missing,
        })
      }

      try {
        const expense = await this.service.createExpense(req.body)
        this.sendSuccess(res, expense, 'Despesa criada com sucesso', 201)
      } catch (error: any) {
        this.sendError(res, error.message || 'Erro ao criar despesa', 400)
      }
    },
  )

  /**
   * Atualiza uma despesa
   * PUT /api/expenses/:id
   */
  public updateExpense = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params
      if (!id) {
        return this.sendError(res, 'ID é obrigatório', 400)
      }

      try {
        const updated = await this.service.updateExpense(id, req.body)

        if (!updated) {
          return this.sendError(
            res,
            'Despesa não encontrada ou não atualizada',
            404,
          )
        }

        this.sendSuccess(res, null, 'Despesa atualizada com sucesso')
      } catch (error: any) {
        this.sendError(res, error.message || 'Erro ao atualizar despesa', 400)
      }
    },
  )
}
