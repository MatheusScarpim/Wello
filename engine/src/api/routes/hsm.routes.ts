import { Router } from 'express'

import hsmTemplateController from '../controllers/HsmTemplateController'

const router = Router()

// CRUD
router.get('/', (req, res) => hsmTemplateController.list(req, res))
router.get('/:id', (req, res) => hsmTemplateController.getById(req, res))
router.post('/', (req, res) => hsmTemplateController.create(req, res))
router.put('/:id', (req, res) => hsmTemplateController.update(req, res))
router.delete('/:id', (req, res) => hsmTemplateController.delete(req, res))

// Meta integration
router.post('/sync/:instanceId', (req, res) => hsmTemplateController.syncFromMeta(req, res))
router.post('/:id/submit', (req, res) => hsmTemplateController.submitToMeta(req, res))
router.delete('/:id/meta', (req, res) => hsmTemplateController.deleteFromMeta(req, res))

// Preview
router.post('/:id/preview', (req, res) => hsmTemplateController.preview(req, res))

export default router
