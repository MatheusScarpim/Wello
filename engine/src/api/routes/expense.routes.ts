import { Router } from 'express'

import { ExpenseController } from '../controllers/ExpenseController'

const router = Router()
const controller = new ExpenseController()

/**
 * Rotas de despesas
 */
router.get('/', controller.listExpenses)
router.post('/list', controller.listExpenses)
router.get('/weekly-sheet', controller.weeklySheet)
router.get('/clients', controller.getClientes)
router.get('/:id', controller.getExpense)
router.post('/', controller.createExpense)
router.put('/:id', controller.updateExpense)

export default router
