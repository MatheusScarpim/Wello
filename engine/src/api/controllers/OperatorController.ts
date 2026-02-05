import { Request, Response } from 'express'
import { ObjectId } from 'mongodb'

import conversationRepository from '../repositories/ConversationRepository'
import operatorRepository, {
  defaultOperatorSettings,
  IOperator,
  OperatorStatus,
} from '../repositories/OperatorRepository'
import { BaseController } from './BaseController'

class OperatorController extends BaseController {
  private async buildMetrics(operatorId: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [activeChats, totalChats, todayChats] = await Promise.all([
      conversationRepository.count({ operatorId, archived: false } as any),
      conversationRepository.count({ operatorId } as any),
      conversationRepository.count({
        operatorId,
        createdAt: { $gte: today },
      } as any),
    ])

    return {
      totalChats,
      activeChats,
      avgResponseTime: 0,
      avgResolutionTime: 0,
      satisfaction: 0,
      todayChats,
    }
  }

  /**
   * Lista todos os operadores
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { departmentId, status } = req.query

      let operators: IOperator[]

      if (departmentId) {
        operators = await operatorRepository.findByDepartment(
          departmentId as string,
        )
      } else if (status) {
        operators = await operatorRepository.findByStatus(
          status as OperatorStatus,
        )
      } else {
        operators = await operatorRepository.findAll()
      }

      const enriched = await Promise.all(
        operators.map(async (op) => {
          if (!op._id) return op
          const metrics = await this.buildMetrics(op._id.toString())
          return { ...op, metrics }
        }),
      )

      this.sendSuccess(res, enriched, 'Operadores listados com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Busca operador por ID
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      if (!ObjectId.isValid(id)) {
        this.sendError(res, 'ID invalido', 400)
        return
      }

      const operator = await operatorRepository.findById(id)

      if (!operator) {
        this.sendError(res, 'Operador não encontrado', 404)
        return
      }

      const { password, ...operatorWithoutPassword } = operator
      const metrics = operator._id
        ? await this.buildMetrics(operator._id.toString())
        : undefined
      this.sendSuccess(res, { ...operatorWithoutPassword, metrics })
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Retorna o operador atual (autenticado)
   */
  async getCurrentOperator(req: Request, res: Response): Promise<void> {
    try {
      const authUser = (req as any).user as
        | { userId?: string; email?: string }
        | undefined

      if (authUser?.userId && ObjectId.isValid(authUser.userId)) {
        const operator = await operatorRepository.findById(authUser.userId)
        if (operator) {
          const { password, ...operatorWithoutPassword } = operator
          const metrics = operator._id
            ? await this.buildMetrics(operator._id.toString())
            : undefined
          this.sendSuccess(res, { ...operatorWithoutPassword, metrics })
          return
        }
      }

      if (authUser?.email) {
        const operator = await operatorRepository.findByEmail(authUser.email)
        if (operator) {
          const { password, ...operatorWithoutPassword } = operator
          const metrics = operator._id
            ? await this.buildMetrics(operator._id.toString())
            : undefined
          this.sendSuccess(res, { ...operatorWithoutPassword, metrics })
          return
        }
      }

      const operators = await operatorRepository.findAll()
      if (operators.length === 0) {
        this.sendError(res, 'Nenhum operador encontrado', 404)
        return
      }

      const first = operators[0]
      const metrics = first._id
        ? await this.buildMetrics(first._id.toString())
        : undefined
      this.sendSuccess(res, { ...first, metrics })
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Cria novo operador
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const {
        name,
        email,
        password,
        avatar,
        role,
        status,
        departmentIds,
        settings,
      } = req.body

      const validation = this.validateRequiredFields(req.body, [
        'name',
        'email',
        'password',
      ])
      if (!validation.valid) {
        this.sendError(
          res,
          `Campos obrigatorios: ${validation.missing?.join(', ')}`,
          400,
        )
        return
      }

      const existing = await operatorRepository.findByEmail(email)
      if (existing) {
        this.sendError(res, 'Email ja esta em uso', 400)
        return
      }

      const operator: IOperator = {
        name,
        email,
        password,
        avatar,
        role: role || 'operator',
        status: status || 'offline',
        departmentIds: departmentIds || [],
        settings: {
          ...defaultOperatorSettings,
          ...settings,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const created = await operatorRepository.create(operator)
      const { password: _, ...operatorWithoutPassword } = created

      this.sendSuccess(
        res,
        operatorWithoutPassword,
        'Operador criado com sucesso',
        201,
      )
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Atualiza operador
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const updates = req.body

      if (!ObjectId.isValid(id)) {
        this.sendError(res, 'ID invalido', 400)
        return
      }

      const existing = await operatorRepository.findById(id)
      if (!existing) {
        this.sendError(res, 'Operador não encontrado', 404)
        return
      }

      if (updates.email && updates.email !== existing.email) {
        const emailExists = await operatorRepository.findByEmail(updates.email)
        if (emailExists) {
          this.sendError(res, 'Email ja esta em uso', 400)
          return
        }
      }

      if (updates.password === '') {
        delete updates.password
      }

      const updated = await operatorRepository.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            ...updates,
            updatedAt: new Date(),
          },
        },
      )

      if (updated) {
        const operator = await operatorRepository.findById(id)
        if (operator) {
          const { password, ...operatorWithoutPassword } = operator
          const metrics = operator._id
            ? await this.buildMetrics(operator._id.toString())
            : undefined
          this.sendSuccess(
            res,
            { ...operatorWithoutPassword, metrics },
            'Operador atualizado com sucesso',
          )
        }
      } else {
        this.sendError(res, 'Falha ao atualizar operador', 500)
      }
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Remove operador
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      if (!ObjectId.isValid(id)) {
        this.sendError(res, 'ID invalido', 400)
        return
      }

      const deleted = await operatorRepository.deleteOne({
        _id: new ObjectId(id),
      })

      if (deleted) {
        this.sendSuccess(res, null, 'Operador excluido com sucesso')
      } else {
        this.sendError(res, 'Operador não encontrado', 404)
      }
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Atualiza status do operador
   */
  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { status } = req.body

      if (!ObjectId.isValid(id)) {
        this.sendError(res, 'ID invalido', 400)
        return
      }

      if (!status || !['online', 'away', 'busy', 'offline'].includes(status)) {
        this.sendError(res, 'Status invalido', 400)
        return
      }

      const updated = await operatorRepository.updateStatus(
        id,
        status as OperatorStatus,
      )

      if (updated) {
        const operator = await operatorRepository.findById(id)
        if (operator) {
          const { password, ...operatorWithoutPassword } = operator
          const metrics = operator._id
            ? await this.buildMetrics(operator._id.toString())
            : undefined
          this.sendSuccess(
            res,
            { ...operatorWithoutPassword, metrics },
            'Status atualizado com sucesso',
          )
        }
      } else {
        this.sendError(res, 'Operador não encontrado', 404)
      }
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Metricas do operador
   */
  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      if (!ObjectId.isValid(id)) {
        this.sendError(res, 'ID invalido', 400)
        return
      }

      const operator = await operatorRepository.findById(id)
      if (!operator) {
        this.sendError(res, 'Operador não encontrado', 404)
        return
      }

      const metrics = operator._id
        ? await this.buildMetrics(operator._id.toString())
        : undefined
      this.sendSuccess(res, metrics)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Busca conversas do operador
   */
  async getConversations(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      if (!ObjectId.isValid(id)) {
        this.sendError(res, 'ID invalido', 400)
        return
      }

      const operator = await operatorRepository.findById(id)
      if (!operator) {
        this.sendError(res, 'Operador não encontrado', 404)
        return
      }

      this.sendSuccess(res, [], 'Conversas do operador')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Estatisticas do operador
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      if (!ObjectId.isValid(id)) {
        this.sendError(res, 'ID invalido', 400)
        return
      }

      const operator = await operatorRepository.findById(id)
      if (!operator) {
        this.sendError(res, 'Operador não encontrado', 404)
        return
      }

      const metrics = operator._id
        ? await this.buildMetrics(operator._id.toString())
        : undefined

      this.sendSuccess(res, {
        metrics,
        status: operator.status,
        departmentCount: operator.departmentIds?.length || 0,
      })
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }
}

export default new OperatorController()
