import { Request, Response, Router } from 'express'

import InstagramPrivateManager from '@/core/providers/InstagramPrivateManager'
import instagramPrivateInstanceRepository from '@/api/repositories/InstagramPrivateInstanceRepository'

const router = Router()

/**
 * GET /instances
 * Lista todas as contas Instagram privado cadastradas
 */
router.get('/instances', async (_req: Request, res: Response) => {
  try {
    const instances = await InstagramPrivateManager.listInstances()
    res.json({ success: true, data: instances })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /instances/:id/status
 * Status de uma conta específica
 */
router.get('/instances/:id/status', async (req: Request, res: Response) => {
  try {
    const instance = await instagramPrivateInstanceRepository.findById(req.params.id)
    if (!instance) return res.status(404).json({ success: false, error: 'Conta não encontrada' })

    const info = await InstagramPrivateManager.getInstanceInfo(instance.sessionName)
    return res.json({ success: true, data: info })
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /instances
 * Cria uma nova conta Instagram privado (sem conectar ainda)
 */
router.post('/instances', async (req: Request, res: Response) => {
  try {
    const { name, username, password, botEnabled, botId, departmentIds, autoConnect } = req.body

    if (!name || !username || !password) {
      return res
        .status(400)
        .json({ success: false, error: 'name, username e password são obrigatórios' })
    }

    const sessionName = `ig_private_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    const instance = await instagramPrivateInstanceRepository.createInstance({
      name,
      sessionName,
      username,
      password,
      sessionData: null,
      status: 'disconnected',
      botEnabled: botEnabled ?? true,
      botId: botId ?? null,
      departmentIds: departmentIds ?? [],
      fairDistributionEnabled: false,
      autoConnect: autoConnect ?? true,
    })

    return res.json({ success: true, data: instance })
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /instances/:id/connect
 * Inicia o login da conta. Pode retornar status 'connected' ou 'challenge' (2FA)
 */
router.post('/instances/:id/connect', async (req: Request, res: Response) => {
  try {
    const instance = await instagramPrivateInstanceRepository.findById(req.params.id)
    if (!instance) return res.status(404).json({ success: false, error: 'Conta não encontrada' })

    // Permite sobrescrever credenciais na chamada
    if (req.body.username || req.body.password) {
      await instagramPrivateInstanceRepository.updateOne(
        { sessionName: instance.sessionName },
        {
          $set: {
            ...(req.body.username ? { username: req.body.username } : {}),
            ...(req.body.password ? { password: req.body.password } : {}),
            updatedAt: new Date(),
          },
        },
      )
    }

    const result = await InstagramPrivateManager.connectAccount(instance.sessionName)

    return res.json({ success: true, data: result })
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /instances/:id/challenge
 * Submete o código de 2FA ou checkpoint para completar o login
 */
router.post('/instances/:id/challenge', async (req: Request, res: Response) => {
  try {
    const { code } = req.body
    if (!code) return res.status(400).json({ success: false, error: 'code é obrigatório' })

    const instance = await instagramPrivateInstanceRepository.findById(req.params.id)
    if (!instance) return res.status(404).json({ success: false, error: 'Conta não encontrada' })

    const status = await InstagramPrivateManager.handleChallenge(instance.sessionName, String(code))

    return res.json({ success: true, data: { status } })
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /instances/:id/disconnect
 * Desconecta uma conta (mantém no banco)
 */
router.post('/instances/:id/disconnect', async (req: Request, res: Response) => {
  try {
    const instance = await instagramPrivateInstanceRepository.findById(req.params.id)
    if (!instance) return res.status(404).json({ success: false, error: 'Conta não encontrada' })

    await InstagramPrivateManager.disconnectAccount(instance.sessionName)
    return res.json({ success: true, message: 'Conta desconectada' })
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * DELETE /instances/:id
 * Remove uma conta permanentemente
 */
router.delete('/instances/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await InstagramPrivateManager.deleteAccount(req.params.id)
    if (!deleted) return res.status(404).json({ success: false, error: 'Conta não encontrada' })
    return res.json({ success: true, message: 'Conta removida' })
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message })
  }
})

export default router
