import { Request, Response } from 'express'
import { ObjectId } from 'mongodb'

import departmentRepository, {
  defaultDepartmentSettings,
  IDepartment,
} from '../repositories/DepartmentRepository'
import { BaseController } from './BaseController'

class DepartmentController extends BaseController {
  /**
   * Lista todos os departamentos
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const departments = await departmentRepository.findAll()
      this.sendSuccess(res, departments, 'Departamentos listados com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Busca departamento por ID
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      if (!ObjectId.isValid(id)) {
        this.sendError(res, 'ID inválido', 400)
        return
      }

      const department = await departmentRepository.findById(id)

      if (!department) {
        this.sendError(res, 'Departamento não encontrado', 404)
        return
      }

      this.sendSuccess(res, department)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Cria novo departamento
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, color, icon, isActive, settings } = req.body

      const validation = this.validateRequiredFields(req.body, [
        'name',
        'color',
      ])
      if (!validation.valid) {
        this.sendError(
          res,
          `Campos obrigatórios: ${validation.missing?.join(', ')}`,
          400,
        )
        return
      }

      const department: IDepartment = {
        name,
        description,
        color,
        icon,
        isActive: isActive ?? true,
        settings: {
          ...defaultDepartmentSettings,
          ...settings,
        },
        operators: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const created = await departmentRepository.create(department)
      this.sendSuccess(res, created, 'Departamento criado com sucesso', 201)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Atualiza departamento
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const updates = req.body

      if (!ObjectId.isValid(id)) {
        this.sendError(res, 'ID inválido', 400)
        return
      }

      const existing = await departmentRepository.findById(id)
      if (!existing) {
        this.sendError(res, 'Departamento não encontrado', 404)
        return
      }

      const updated = await departmentRepository.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            ...updates,
            updatedAt: new Date(),
          },
        },
      )

      if (updated) {
        const department = await departmentRepository.findById(id)
        this.sendSuccess(res, department, 'Departamento atualizado com sucesso')
      } else {
        this.sendError(res, 'Falha ao atualizar departamento', 500)
      }
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Remove departamento
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      if (!ObjectId.isValid(id)) {
        this.sendError(res, 'ID inválido', 400)
        return
      }

      const deleted = await departmentRepository.deleteOne({
        _id: new ObjectId(id),
      })

      if (deleted) {
        this.sendSuccess(res, null, 'Departamento excluído com sucesso')
      } else {
        this.sendError(res, 'Departamento não encontrado', 404)
      }
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Adiciona operador ao departamento
   */
  async addOperator(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { operatorId } = req.body

      if (!ObjectId.isValid(id)) {
        this.sendError(res, 'ID do departamento inválido', 400)
        return
      }

      if (!operatorId) {
        this.sendError(res, 'ID do operador é obrigatório', 400)
        return
      }

      const updated = await departmentRepository.addOperator(id, operatorId)

      if (updated) {
        this.sendSuccess(res, null, 'Operador adicionado ao departamento')
      } else {
        this.sendError(res, 'Falha ao adicionar operador', 500)
      }
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Remove operador do departamento
   */
  async removeOperator(req: Request, res: Response): Promise<void> {
    try {
      const { id, operatorId } = req.params

      if (!ObjectId.isValid(id)) {
        this.sendError(res, 'ID do departamento inválido', 400)
        return
      }

      const updated = await departmentRepository.removeOperator(id, operatorId)

      if (updated) {
        this.sendSuccess(res, null, 'Operador removido do departamento')
      } else {
        this.sendError(res, 'Falha ao remover operador', 500)
      }
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Estatísticas do departamento
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      if (!ObjectId.isValid(id)) {
        this.sendError(res, 'ID inválido', 400)
        return
      }

      const stats = await departmentRepository.getStats(id)
      this.sendSuccess(res, stats)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }
}

export default new DepartmentController()
