import { Router } from 'express'

import pipelineStageController from '../controllers/PipelineStageController'
import AuthMiddleware from '../middlewares/AuthMiddleware'

const router = Router()

router.use(AuthMiddleware.authenticate)

router.get('/', (req, res) => pipelineStageController.list(req, res))

router.use(AuthMiddleware.requireAnyRole(['admin', 'supervisor']))

router.post('/', (req, res) => pipelineStageController.create(req, res))
router.put('/reorder', (req, res) => pipelineStageController.reorder(req, res))
router.put('/:id', (req, res) => pipelineStageController.update(req, res))
router.delete('/:id', (req, res) => pipelineStageController.delete(req, res))

export default router
