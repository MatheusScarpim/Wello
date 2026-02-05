import { Router } from 'express'

import { WebhookController } from '../controllers/WebhookController'

const router = Router()
const controller = new WebhookController()

/**
 * Rotas de webhooks
 */

// Lista eventos disponíveis (precisa vir antes do :id)
router.get('/events', controller.listEvents)

// Estatísticas de webhooks (precisa vir antes do :id)
router.get('/stats', controller.getStats)

// Lista webhooks com filtros e paginação
router.get('/', controller.list)

// Busca webhook específico
router.get('/:id', controller.getById)

// Cria novo webhook
router.post('/', controller.create)

// Atualiza webhook
router.put('/:id', controller.update)

// Deleta webhook
router.delete('/:id', controller.delete)

// Ativa webhook
router.post('/:id/enable', controller.enable)

// Desativa webhook
router.post('/:id/disable', controller.disable)

// Testa webhook
router.post('/:id/test', controller.test)

export default router
