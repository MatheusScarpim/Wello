import { Request, Response, Router } from 'express'

import whatsappInstanceRepository from '@/api/repositories/WhatsAppInstanceRepository'
import Application from '@/core/Application'
import InstagramManager from '@/core/providers/InstagramManager'

const router = Router()

router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  const verifyToken =
    process.env.INSTAGRAM_VERIFY_TOKEN ||
    process.env.META_VERIFY_TOKEN ||
    'your-verify-token'

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('Webhook Instagram verificado')
    res.status(200).send(challenge)
  } else {
    console.error('Falha na verificacao do webhook Instagram')
    res.sendStatus(403)
  }
})

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const body = req.body
    const entries = Array.isArray(body?.entry) ? body.entry : []

    for (const entry of entries) {
      const messagingEvents = Array.isArray(entry?.messaging) ? entry.messaging : []
      for (const event of messagingEvents) {
        if (!event?.message?.mid) {
          continue
        }

        const recipientId = event?.recipient?.id ? String(event.recipient.id) : ''
        let context: { sessionName?: string; instanceName?: string } | undefined

        if (recipientId) {
          const instance =
            await whatsappInstanceRepository.findByInstagramAccountId(recipientId)
          if (instance?.metaConfig?.enabled) {
            context = {
              sessionName: instance.sessionName,
              instanceName: instance.name,
            }
          }
        }

        const message = await InstagramManager.processWebhookMessage(event, context)
        if (!message) {
          continue
        }

        Application.handleIncomingMessage(message as any)
      }
    }

    res.sendStatus(200)
  } catch (error) {
    console.error('Erro ao processar webhook Instagram:', error)
    res.sendStatus(500)
  }
})

router.get('/status', async (_req: Request, res: Response) => {
  const validation = await InstagramManager.validateCredentials()

  res.json({
    success: true,
    data: {
      enabled: InstagramManager.getIsEnabled(),
      connected: validation.valid,
      config: {
        instagramAccountId: InstagramManager.getConfig().instagramAccountId,
        apiVersion: InstagramManager.getConfig().apiVersion,
      },
      validation,
    },
  })
})

router.post('/send-test', async (req: Request, res: Response) => {
  try {
    const { to, message } = req.body

    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Campos to e message sao obrigatorios',
      })
    }

    const result = await InstagramManager.sendText(String(to), String(message))

    return res.json({
      success: true,
      data: result,
      message: 'Mensagem enviada com sucesso',
    })
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

export default router
