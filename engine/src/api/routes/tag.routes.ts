import { Router } from 'express'

import tagController from '../controllers/TagController'
import AuthMiddleware from '../middlewares/AuthMiddleware'

const router = Router()

router.use(AuthMiddleware.authenticate)

// Qualquer usuario autenticado pode listar tags
router.get('/', (req, res) => tagController.list(req, res))

// Apenas admin e supervisor podem criar/editar/deletar tags
router.use(AuthMiddleware.requireAnyRole(['admin', 'supervisor']))

router.post('/', (req, res) => tagController.create(req, res))
router.put('/:id', (req, res) => tagController.update(req, res))
router.delete('/:id', (req, res) => tagController.delete(req, res))

export default router
