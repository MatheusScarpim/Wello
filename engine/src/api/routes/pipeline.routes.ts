import { Router } from 'express'

import pipelineController from '../controllers/PipelineController'
import AuthMiddleware from '../middlewares/AuthMiddleware'

const router = Router()

router.use(AuthMiddleware.authenticate)
router.use(AuthMiddleware.requireAnyRole(['admin', 'supervisor']))

router.get('/board', (req, res) => pipelineController.getBoard(req, res))
router.put('/move', (req, res) => pipelineController.move(req, res))
router.put('/bulk-move', (req, res) => pipelineController.bulkMove(req, res))
router.get('/metrics', (req, res) => pipelineController.getMetrics(req, res))

export default router
