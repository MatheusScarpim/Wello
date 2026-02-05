import { Router } from 'express'

import queueController from '../controllers/QueueController'
import AuthMiddleware from '../middlewares/AuthMiddleware'

const router = Router()

router.use(AuthMiddleware.authenticate)

// Lista fila de atendimento
router.get('/', (req, res) => queueController.list(req, res))

// Estatísticas da fila
router.get('/stats/overview', (req, res) => queueController.getStats(req, res))

// Adiciona conversa à fila
router.post('/', (req, res) => queueController.addToQueue(req, res))

// Assume conversa
router.post('/:conversationId/assume', (req, res) =>
  queueController.assume(req, res),
)

// Transfere conversa
router.post('/:conversationId/transfer', (req, res) =>
  queueController.transfer(req, res),
)

// Resolve conversa
router.post('/:conversationId/resolve', (req, res) =>
  queueController.resolve(req, res),
)

// Libera conversa de volta para a fila
router.post('/:conversationId/release', (req, res) =>
  queueController.release(req, res),
)

// Adiciona tags
router.post('/:conversationId/tags', (req, res) =>
  queueController.addTags(req, res),
)

// Adiciona nota
router.post('/:conversationId/notes', (req, res) =>
  queueController.addNote(req, res),
)

// Busca item da fila por ID
router.get('/:id', (req, res) => queueController.getById(req, res))

export default router
