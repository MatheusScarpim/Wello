import { Request, Response, Router } from 'express'

import whatsappInstanceRepository from '@/api/repositories/WhatsAppInstanceRepository'
import Application from '@/core/Application'
import MetaManager from '@/core/providers/MetaManager'

const router = Router()

/**
 * Webhook verification (GET) - Meta envia isso para verificar o webhook
 */
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  const verifyToken = process.env.META_VERIFY_TOKEN || 'your-verify-token'

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('? Webhook Meta verificado')
    res.status(200).send(challenge)
  } else {
    console.error('? Falha na verificação do webhook Meta')
    res.sendStatus(403)
  }
})

/**
 * Webhook receiver (POST) - Recebe mensagens do Meta
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const body = req.body
    const entries = Array.isArray(body?.entry) ? body.entry : []

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : []

      for (const change of changes) {
        const value = change?.value
        const phoneNumberId = value?.metadata?.phone_number_id
        const messages = Array.isArray(value?.messages) ? value.messages : []

        if (!messages.length) continue

        let customConfig:
          | {
              accessToken?: string
              phoneNumberId?: string
              apiVersion?: string
              baseUrl?: string
            }
          | undefined
        let context: { sessionName?: string; instanceName?: string } | undefined

        if (phoneNumberId) {
          const instance =
            await whatsappInstanceRepository.findByMetaPhoneNumberId(
              phoneNumberId,
            )

          if (instance?.metaConfig?.enabled) {
            customConfig = {
              accessToken: instance.metaConfig.accessToken,
              phoneNumberId: instance.metaConfig.phoneNumberId,
              apiVersion: instance.metaConfig.apiVersion,
              baseUrl: instance.metaConfig.baseUrl,
            }
            context = {
              sessionName: instance.sessionName,
              instanceName: instance.name,
            }
          }
        }

        for (const messageItem of messages) {
          const singlePayload = {
            entry: [
              {
                changes: [
                  {
                    value: {
                      ...value,
                      messages: [messageItem],
                    },
                  },
                ],
              },
            ],
          }

          const message = await MetaManager.processWebhookMessage(
            singlePayload,
            customConfig,
            context,
          )

          if (!message) continue

          console.log(`Mensagem Meta recebida de: ${message.identifier}`)
          Application.handleIncomingMessage(message)
        }
      }
    }

    // Sempre responde 200 para o Meta
    res.sendStatus(200)
  } catch (error) {
    console.error('? Erro ao processar webhook Meta:', error)
    res.sendStatus(500)
  }
})

/**
 * Status do Meta Manager
 */
router.get('/status', async (req: Request, res: Response) => {
  const validation = await MetaManager.validateCredentials()

  res.json({
    success: true,
    data: {
      enabled: MetaManager.getIsEnabled(),
      connected: validation.valid,
      config: {
        phoneNumberId: MetaManager.getConfig().phoneNumberId,
        apiVersion: MetaManager.getConfig().apiVersion,
      },
      validation,
    },
  })
})

/**
 * Envia mensagem de teste via Meta
 */
router.post('/send-test', async (req: Request, res: Response) => {
  try {
    const { to, message } = req.body

    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Campos to e message são obrigatórios',
      })
    }

    const result = await MetaManager.sendText(to, message)

    res.json({
      success: true,
      data: result,
      message: 'Mensagem enviada com sucesso',
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

export default router
