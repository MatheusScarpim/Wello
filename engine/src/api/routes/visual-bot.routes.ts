import { Router } from 'express'

import visualBotController from '../controllers/VisualBotController'
import AuthMiddleware from '../middlewares/AuthMiddleware'

const router = Router()

router.use(AuthMiddleware.authenticate)
router.use(AuthMiddleware.requireAnyRole(['admin', 'supervisor']))

router.get('/', (req, res) => visualBotController.list(req, res))
router.get('/:id', (req, res) => visualBotController.getById(req, res))
router.post('/', (req, res) => visualBotController.create(req, res))
router.put('/:id', (req, res) => visualBotController.update(req, res))
router.delete('/:id', (req, res) => visualBotController.delete(req, res))
router.post('/:id/publish', (req, res) => visualBotController.publish(req, res))
router.post('/:id/unpublish', (req, res) => visualBotController.unpublish(req, res))
router.post('/:id/duplicate', (req, res) => visualBotController.duplicate(req, res))
router.post('/:id/test', (req, res) => visualBotController.test(req, res))

export default router
