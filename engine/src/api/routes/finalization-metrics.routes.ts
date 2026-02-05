import { Router } from 'express'

import { FinalizationMetricsController } from '../controllers/FinalizationMetricsController'

const router = Router()
const controller = new FinalizationMetricsController()

// Métricas de finalizações
// GET /api/finalization-metrics?period=today|week|month|custom&startDate=&endDate=
router.get('/', (req, res) => controller.getMetrics(req, res))

// Lista detalhada de finalizações
// GET /api/finalization-metrics/list?period=...&page=&limit=&operatorId=&finalizationType=
router.get('/list', (req, res) => controller.getDetailedList(req, res))

export default router
