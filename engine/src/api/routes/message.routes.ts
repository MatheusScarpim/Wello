import { Router } from 'express'

import { MessageController } from '../controllers/MessageController'
import { mediaUploadMiddleware } from '../middlewares/mediaUploadMiddleware'

const router = Router()
const controller = new MessageController()

/**
 * Rotas de mensagens
 */

// Lista mensagens de uma conversa
router.get('/', controller.getMessages)

// Busca mensagem específica
router.get('/:id', controller.getMessage)

// Envia mensagem (com middleware de upload de mídia)
router.post('/send', mediaUploadMiddleware, controller.sendMessage)

// Marca como lida
router.patch('/:id/read', controller.markAsRead)

// Busca mídia da mensagem
router.get('/:id/media', controller.getMedia)

// Deleta mensagem
router.delete('/:id', controller.deleteMessage)

export default router
