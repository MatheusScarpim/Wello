import { Router } from 'express'

import finalizationController from '../controllers/FinalizationController'
import AuthMiddleware from '../middlewares/AuthMiddleware'

const router = Router()

router.use(AuthMiddleware.authenticate)

// Allow any authenticated user to fetch the list (operators need it)
router.get('/', (req, res) => finalizationController.list(req, res))

router.use(AuthMiddleware.requireAnyRole(['admin', 'supervisor']))

router.post('/', (req, res) => finalizationController.create(req, res))
router.put('/:id', (req, res) => finalizationController.update(req, res))
router.delete('/:id', (req, res) => finalizationController.delete(req, res))

export default router
