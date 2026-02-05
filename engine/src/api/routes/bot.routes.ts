import { Request, Response, Router } from 'express'

import BotFactory from '@/core/bot/BotFactory'
import BotSessionRepository from '@/core/repositories/BotSessionRepository'

const router = Router()

/**
 * Rotas de controle de bots
 */

// Lista bots registrados
router.get('/list', (req: Request, res: Response) => {
  const registered = BotFactory.getRegisteredBots()
  const active = BotFactory.getActiveBots()

  res.json({
    success: true,
    data: {
      registered,
      active,
      total: registered.length,
      totalActive: active.length,
    },
  })
})

// Ativa um bot para uma conversa
router.post('/activate', async (req: Request, res: Response) => {
  try {
    const { conversationId, botId } = req.body

    if (!conversationId || !botId) {
      return res.status(400).json({
        success: false,
        error: 'conversationId e botId são obrigatórios',
      })
    }

    // Verifica se bot existe
    if (!BotFactory.isBotRegistered(botId)) {
      return res.status(404).json({
        success: false,
        error: `Bot ${botId} não encontrado`,
      })
    }

    // Cria sessão
    await BotSessionRepository.upsertSession(conversationId, botId, 0, {})

    res.json({
      success: true,
      message: `Bot ${botId} ativado para conversa ${conversationId}`,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// Desativa bot de uma conversa
router.post('/deactivate', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.body

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'conversationId é obrigatório',
      })
    }

    await BotSessionRepository.endSession(conversationId)

    res.json({
      success: true,
      message: `Bot desativado para conversa ${conversationId}`,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// Busca sessão ativa de uma conversa
router.get('/session/:conversationId', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params

    const session = await BotSessionRepository.getActiveSession(conversationId)

    res.json({
      success: true,
      data: session,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// Reseta sessão (volta para estágio 0)
router.post('/reset', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.body

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'conversationId é obrigatório',
      })
    }

    const session = await BotSessionRepository.getActiveSession(conversationId)

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sessão não encontrada',
      })
    }

    await BotSessionRepository.updateStage(conversationId, 0)
    await BotSessionRepository.updateSessionData(conversationId, {})

    res.json({
      success: true,
      message: 'Sessão resetada com sucesso',
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// Recarrega um bot
router.post('/reload/:botId', async (req: Request, res: Response) => {
  try {
    const { botId } = req.params

    if (!BotFactory.isBotRegistered(botId)) {
      return res.status(404).json({
        success: false,
        error: `Bot ${botId} não encontrado`,
      })
    }

    await BotFactory.reloadBot(botId)

    res.json({
      success: true,
      message: `Bot ${botId} recarregado com sucesso`,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

export default router
