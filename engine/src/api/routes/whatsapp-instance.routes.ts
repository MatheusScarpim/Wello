import { Router } from 'express'

import whatsappInstanceController from '../controllers/WhatsAppInstanceController'

const router = Router()

// Status geral de todas as instâncias
router.get('/status', (req, res) =>
  whatsappInstanceController.getStatus(req, res),
)

// Lista todas as instâncias
router.get('/', (req, res) => whatsappInstanceController.list(req, res))

// Obtém uma instância específica
router.get('/:id', (req, res) => whatsappInstanceController.getById(req, res))

// Cria nova instância
router.post('/', (req, res) => whatsappInstanceController.create(req, res))

// Atualiza uma instância
router.put('/:id', (req, res) => whatsappInstanceController.update(req, res))

// Remove uma instância
router.delete('/:id', (req, res) => whatsappInstanceController.delete(req, res))

// Conecta uma instância
router.post('/:id/connect', (req, res) =>
  whatsappInstanceController.connect(req, res),
)

// Desconecta uma instância
router.post('/:id/disconnect', (req, res) =>
  whatsappInstanceController.disconnect(req, res),
)

// Obtém QR Code de uma instância
router.get('/:id/qrcode', (req, res) =>
  whatsappInstanceController.getQrCode(req, res),
)

// Define instância como padrão
router.post('/:id/default', (req, res) =>
  whatsappInstanceController.setDefault(req, res),
)

export default router
