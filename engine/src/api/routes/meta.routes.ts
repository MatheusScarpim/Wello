import { Request, Response, Router } from 'express'

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
    console.log('✅ Webhook Meta verificado')
    res.status(200).send(challenge)
  } else {
    console.error('❌ Falha na verificação do webhook Meta')
    res.sendStatus(403)
  }
})

/**
 * Webhook receiver (POST) - Recebe mensagens do Meta
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const body = req.body

    // Processa mensagem (agora é assíncrono para processar mídia)
    const message = await MetaManager.processWebhookMessage(body)

    if (message) {
      console.log(`Mensagem Meta recebida de: ${message.identifier}`)

      // Envia para o pipeline principal de processamento
      Application.handleIncomingMessage(message)
    }

    // Sempre responde 200 para o Meta
    res.sendStatus(200)
  } catch (error) {
    console.error('❌ Erro ao processar webhook Meta:', error)
    res.sendStatus(500)
  }
})

/**
 * Status do Meta Manager
 */
router.get('/status', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      enabled: MetaManager.getIsEnabled(),
      config: {
        phoneNumberId: MetaManager.getConfig().phoneNumberId,
        apiVersion: MetaManager.getConfig().apiVersion,
      },
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
