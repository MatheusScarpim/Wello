import { Request, Response, Router } from 'express'

import WhatsAppManager from '@/core/whatsapp/WhatsAppManager'

const router = Router()
const isMultiInstanceMode = process.env.WHATSAPP_MULTI_INSTANCE === 'true'

/**
 * Rotas de controle do WhatsApp (legacy single-instance)
 */

// Status da conexao legacy
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await WhatsAppManager.getStatus()

    res.json({
      success: true,
      data: status,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// QR Code legacy
router.get('/qrcode', (req: Request, res: Response) => {
  if (isMultiInstanceMode) {
    return res.status(400).json({
      success: false,
      error:
        'Endpoint legado desabilitado no modo multi-instancia. Use /api/whatsapp/instances/:id/qrcode',
    })
  }

  if (WhatsAppManager.isConnected()) {
    return res.status(200).json({
      success: true,
      data: {
        connected: true,
        qrCode: null,
      },
      message: 'WhatsApp ja esta conectado',
    })
  }

  const qrCode = WhatsAppManager.getQrCode()

  res.json({
    success: true,
    data: {
      connected: false,
      qrCode,
    },
    message: qrCode
      ? undefined
      : 'QR Code ainda nao disponivel. Aguarde alguns segundos.',
  })
})

// Forca reconexao legacy
router.post('/reconnect', async (req: Request, res: Response) => {
  try {
    if (isMultiInstanceMode) {
      return res.status(400).json({
        success: false,
        error:
          'Endpoint legado desabilitado no modo multi-instancia. Use /api/whatsapp/instances/:id/connect',
      })
    }

    if (WhatsAppManager.isConnected()) {
      await WhatsAppManager.disconnect()
    }

    await WhatsAppManager.connect()

    res.json({
      success: true,
      message: 'Reconexao iniciada',
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// Desconecta legacy
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    if (isMultiInstanceMode) {
      return res.status(400).json({
        success: false,
        error:
          'Endpoint legado desabilitado no modo multi-instancia. Use /api/whatsapp/instances/:id/disconnect',
      })
    }

    await WhatsAppManager.disconnect()

    res.json({
      success: true,
      message: 'WhatsApp desconectado',
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

export default router
