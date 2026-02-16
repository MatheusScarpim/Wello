import { Router } from 'express'

import cannedResponseController from '../controllers/CannedResponseController'
import AuthMiddleware from '../middlewares/AuthMiddleware'

const router = Router()

router.use(AuthMiddleware.authenticate)

// Qualquer usuario autenticado pode listar respostas rapidas
router.get('/', (req, res) => cannedResponseController.list(req, res))

// Apenas admin e supervisor podem criar/editar/deletar
router.use(AuthMiddleware.requireAnyRole(['admin', 'supervisor']))

router.post('/', (req, res) => cannedResponseController.create(req, res))
router.put('/:id', (req, res) => cannedResponseController.update(req, res))
router.delete('/:id', (req, res) => cannedResponseController.delete(req, res))

export default router
