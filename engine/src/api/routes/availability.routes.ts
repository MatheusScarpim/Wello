import { Router } from 'express'

import availabilityController from '../controllers/AvailabilityController'
import AuthMiddleware from '../middlewares/AuthMiddleware'

const router = Router()

router.use(AuthMiddleware.authenticate)

router.get('/', (req, res) => availabilityController.get(req, res))

router.use(AuthMiddleware.requireAnyRole(['admin', 'supervisor']))

router.put('/', (req, res) => availabilityController.update(req, res))

export default router
