import { Router } from 'express'

import { ConversationController } from '../controllers/ConversationController'
import AuthMiddleware from '../middlewares/AuthMiddleware'

const router = Router()
const controller = new ConversationController()

/**
 * Rotas de conversas
 */

router.use(AuthMiddleware.authenticate)

// Lista conversas com filtros
router.get('/', controller.listConversations)
router.post('/', controller.listConversations)
router.post('/list', controller.listConversations)

// Busca conversa especifica
router.get('/:id', controller.getConversation)

// Cria nova conversa
router.post('/create', controller.createConversation)

// Atualiza conversa
router.put('/:id', controller.updateConversation)

// Pagina conversas
router.post('/paginate', controller.paginateConversations)

// Arquiva conversa
router.patch('/:id/archive', controller.archiveConversation)

// Desarquiva conversa
router.patch('/:id/unarchive', controller.unarchiveConversation)

// Atribui operador
router.patch('/:id/assign-operator', controller.assignOperator)

export default router
