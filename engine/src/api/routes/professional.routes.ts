import { Router } from 'express'

import professionalController from '../controllers/ProfessionalController'
import AuthMiddleware from '../middlewares/AuthMiddleware'

const router = Router()

router.use(AuthMiddleware.authenticate)

router.get('/', (req, res) => professionalController.list(req, res))
router.get('/active', (req, res) => professionalController.listActive(req, res))

router.use(AuthMiddleware.requireAnyRole(['admin', 'supervisor']))

router.post('/', (req, res) => professionalController.create(req, res))
router.put('/:id', (req, res) => professionalController.update(req, res))
router.delete('/:id', (req, res) => professionalController.delete(req, res))

export default router
