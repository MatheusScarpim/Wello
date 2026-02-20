import { Router } from 'express'

import googleCalendarController from '../controllers/GoogleCalendarController'
import AuthMiddleware from '../middlewares/AuthMiddleware'

const router = Router()

// OAuth callback NAO requer auth (redirect do Google)
router.get('/oauth/callback', (req, res) => googleCalendarController.handleCallback(req, res))

// Webhook do Google NAO requer auth JWT
router.post('/webhook', (req, res) => googleCalendarController.handleWebhook(req, res))

// Demais rotas requerem autenticacao
router.use(AuthMiddleware.authenticate)

router.get('/status', (req, res) => googleCalendarController.getStatus(req, res))
router.get('/oauth/url', (req, res) => googleCalendarController.getAuthUrl(req, res))
router.post('/sync', (req, res) => googleCalendarController.manualSync(req, res))
router.post('/disconnect', (req, res) => googleCalendarController.disconnect(req, res))
router.post('/watch', (req, res) => googleCalendarController.setupWatch(req, res))

export default router
