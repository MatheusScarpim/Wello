import { Router } from 'express'

import departmentController from '../controllers/DepartmentController'

const router = Router()

// Lista todos os departamentos
router.get('/', (req, res) => departmentController.list(req, res))

// Busca departamento por ID
router.get('/:id', (req, res) => departmentController.getById(req, res))

// Cria novo departamento
router.post('/', (req, res) => departmentController.create(req, res))

// Atualiza departamento
router.put('/:id', (req, res) => departmentController.update(req, res))

// Remove departamento
router.delete('/:id', (req, res) => departmentController.delete(req, res))

// Adiciona operador ao departamento
router.post('/:id/operators', (req, res) =>
  departmentController.addOperator(req, res),
)

// Remove operador do departamento
router.delete('/:id/operators/:operatorId', (req, res) =>
  departmentController.removeOperator(req, res),
)

// Estatísticas do departamento
router.get('/:id/stats', (req, res) => departmentController.getStats(req, res))

export default router
