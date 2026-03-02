import { Router } from 'express'

import campaignController from '../controllers/CampaignController'

const router = Router()

// CRUD
router.get('/', (req, res) => campaignController.list(req, res))
router.get('/:id', (req, res) => campaignController.getById(req, res))
router.post('/', (req, res) => campaignController.create(req, res))
router.put('/:id', (req, res) => campaignController.update(req, res))
router.delete('/:id', (req, res) => campaignController.delete(req, res))

// Actions
router.post('/:id/duplicate', (req, res) => campaignController.duplicate(req, res))
router.post('/:id/schedule', (req, res) => campaignController.schedule(req, res))
router.post('/:id/start', (req, res) => campaignController.start(req, res))
router.put('/:id/pause', (req, res) => campaignController.pause(req, res))
router.put('/:id/resume', (req, res) => campaignController.resume(req, res))
router.put('/:id/cancel', (req, res) => campaignController.cancel(req, res))

// Metrics & Contacts
router.get('/:id/metrics', (req, res) => campaignController.getMetrics(req, res))
router.get('/:id/contacts', (req, res) => campaignController.getContacts(req, res))
router.get('/:id/export', (req, res) => campaignController.exportContacts(req, res))

export default router
