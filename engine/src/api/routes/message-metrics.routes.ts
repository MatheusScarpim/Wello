import { Router } from 'express'

import { MessageMetricsController } from '../controllers/MessageMetricsController'

const router = Router()
const controller = new MessageMetricsController()

// Métricas de mensagens
// GET /api/message-metrics?period=today|week|month|custom&startDate=&endDate=
router.get('/', (req, res) => controller.getMetrics(req, res))

export default router
