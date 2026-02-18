import { Router } from 'express'

import appointmentController from '../controllers/AppointmentController'
import AuthMiddleware from '../middlewares/AuthMiddleware'

const router = Router()

router.use(AuthMiddleware.authenticate)

router.get('/', (req, res) => appointmentController.list(req, res))
router.get('/calendar', (req, res) => appointmentController.calendar(req, res))
router.get('/slots/:date', (req, res) => appointmentController.slots(req, res))
router.post('/', (req, res) => appointmentController.create(req, res))
router.put('/:id', (req, res) => appointmentController.update(req, res))
router.patch('/:id/status', (req, res) => appointmentController.updateStatus(req, res))
router.delete('/:id', (req, res) => appointmentController.delete(req, res))

export default router
