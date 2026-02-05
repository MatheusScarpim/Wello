import { Router } from 'express'

import dashboardController from '../controllers/DashboardController'

const router = Router()

// Métricas do dashboard
router.get('/metrics', (req, res) => dashboardController.getMetrics(req, res))

// Estatísticas em tempo real
router.get('/realtime', (req, res) =>
  dashboardController.getRealtimeStats(req, res),
)

export default router
