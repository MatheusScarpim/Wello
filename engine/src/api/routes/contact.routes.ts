import { Router } from 'express'

import { ContactController } from '../controllers/ContactController'

const router = Router()
const contactController = new ContactController()

router.get('/', contactController.list)
router.post('/', contactController.create)
router.get('/:id', contactController.getById)
router.get('/:id/conversation', contactController.checkConversation)
router.put('/:id', contactController.update)
router.delete('/:id', contactController.delete)

export default router
