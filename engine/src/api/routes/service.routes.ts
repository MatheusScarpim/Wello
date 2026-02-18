import { Router } from 'express'

import serviceController from '../controllers/ServiceController'
import AuthMiddleware from '../middlewares/AuthMiddleware'

const router = Router()

router.use(AuthMiddleware.authenticate)

router.get('/', (req, res) => serviceController.list(req, res))

router.use(AuthMiddleware.requireAnyRole(['admin', 'supervisor']))

router.post('/', (req, res) => serviceController.create(req, res))
router.put('/:id', (req, res) => serviceController.update(req, res))
router.delete('/:id', (req, res) => serviceController.delete(req, res))

export default router
