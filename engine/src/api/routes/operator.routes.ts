import { Router } from 'express'

import operatorController from '../controllers/OperatorController'
import AuthMiddleware from '../middlewares/AuthMiddleware'

const router = Router()

// Lista todos os operadores
router.get('/', (req, res) => operatorController.list(req, res))

// Operador atual (autenticado)
router.get('/me', AuthMiddleware.authenticate, (req, res) =>
  operatorController.getCurrentOperator(req, res),
)

// Busca operador por ID
router.get('/:id', (req, res) => operatorController.getById(req, res))

// Cria novo operador
router.post('/', (req, res) => operatorController.create(req, res))

// Atualiza operador
router.put('/:id', (req, res) => operatorController.update(req, res))

// Remove operador
router.delete('/:id', (req, res) => operatorController.delete(req, res))

// Atualiza status do operador
router.patch('/:id/status', (req, res) =>
  operatorController.updateStatus(req, res),
)

// Busca conversas do operador
router.get('/:id/conversations', (req, res) =>
  operatorController.getConversations(req, res),
)

// Estatísticas do operador
router.get('/:id/stats', (req, res) => operatorController.getStats(req, res))

export default router
