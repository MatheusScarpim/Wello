import { Request, Response } from 'express'

import BaseController from './BaseController'
import GoogleCalendarManager from '@/core/providers/GoogleCalendarManager'
import googleCalendarSyncService from '@/api/services/GoogleCalendarSyncService'

class GoogleCalendarController extends BaseController {
  // GET /api/google-calendar/status
  async getStatus(req: Request, res: Response) {
    try {
      const status = await GoogleCalendarManager.getConnectionStatus()
      this.sendSuccess(res, {
        enabled: GoogleCalendarManager.getIsEnabled(),
        ...status,
      })
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  // GET /api/google-calendar/oauth/url
  async getAuthUrl(req: Request, res: Response) {
    try {
      if (!GoogleCalendarManager.getIsEnabled()) {
        return this.sendError(res, 'Google Calendar nao configurado. Configure as variaveis GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.')
      }
      const url = GoogleCalendarManager.getAuthUrl()
      this.sendSuccess(res, { url })
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  // GET /api/google-calendar/oauth/callback
  async handleCallback(req: Request, res: Response) {
    try {
      const code = req.query.code as string
      if (!code) {
        return this.sendError(res, 'Codigo de autorizacao nao fornecido')
      }
      await GoogleCalendarManager.handleOAuthCallback(code)

      // Redireciona para o frontend com indicador de sucesso
      const frontendUrl = process.env.VITE_API_URL || 'http://localhost:4176'
      res.redirect(`${frontendUrl}/settings?googleCalendar=connected`)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  // POST /api/google-calendar/sync
  async manualSync(req: Request, res: Response) {
    try {
      const stats = await googleCalendarSyncService.syncFromGoogle()
      this.sendSuccess(res, stats, 'Sincronizacao concluida')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  // POST /api/google-calendar/disconnect
  async disconnect(req: Request, res: Response) {
    try {
      await GoogleCalendarManager.disconnect()
      this.sendSuccess(res, null, 'Google Calendar desconectado')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  // POST /api/google-calendar/webhook
  async handleWebhook(req: Request, res: Response) {
    try {
      await googleCalendarSyncService.syncFromGoogle()
      res.sendStatus(200)
    } catch (error) {
      console.error('Erro ao processar webhook do Google Calendar:', error)
      res.sendStatus(200)
    }
  }

  // POST /api/google-calendar/watch
  async setupWatch(req: Request, res: Response) {
    try {
      const { webhookUrl } = req.body
      if (!webhookUrl) {
        return this.sendError(res, 'webhookUrl e obrigatorio')
      }
      await GoogleCalendarManager.setupWatch(webhookUrl)
      this.sendSuccess(res, null, 'Watch configurado com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }
}

export default new GoogleCalendarController()
