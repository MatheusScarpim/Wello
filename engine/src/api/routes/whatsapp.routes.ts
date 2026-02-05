import { Request, Response, Router } from 'express'

import WhatsAppManager from '@/core/whatsapp/WhatsAppManager'

const router = Router()

/**
 * Rotas de controle do WhatsApp
 */

// Status da conexão
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

// QR Code
router.get('/qrcode', (req: Request, res: Response) => {
  if (WhatsAppManager.isConnected()) {
    return res.status(200).json({
      success: true,
      data: {
        connected: true,
        qrCode: null,
      },
      message: 'WhatsApp já está conectado',
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
      : 'QR Code ainda não disponível. Aguarde alguns segundos.',
  })
})

// Força reconexão
router.post('/reconnect', async (req: Request, res: Response) => {
  try {
    if (WhatsAppManager.isConnected()) {
      await WhatsAppManager.disconnect()
    }

    await WhatsAppManager.connect()

    res.json({
      success: true,
      message: 'Reconexão iniciada',
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// Desconecta
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
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
