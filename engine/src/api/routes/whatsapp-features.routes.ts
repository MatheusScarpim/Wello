import { Router } from 'express'

import whatsappFeatureController from '../controllers/WhatsAppFeatureController'

const router = Router()

// ==================== REAÇÕES ====================
router.post('/reaction', (req, res) =>
  whatsappFeatureController.sendReaction(req, res),
)

// ==================== DIGITANDO ====================
router.post('/typing/start', (req, res) =>
  whatsappFeatureController.startTyping(req, res),
)

router.post('/typing/stop', (req, res) =>
  whatsappFeatureController.stopTyping(req, res),
)

// ==================== MENSAGENS ====================
router.post('/message/delete', (req, res) =>
  whatsappFeatureController.deleteMessage(req, res),
)

router.post('/message/edit', (req, res) =>
  whatsappFeatureController.editMessage(req, res),
)

router.post('/message/forward', (req, res) =>
  whatsappFeatureController.forwardMessage(req, res),
)

// ==================== LEITURA ====================
router.post('/seen', (req, res) =>
  whatsappFeatureController.sendSeen(req, res),
)

router.post('/unread', (req, res) =>
  whatsappFeatureController.markUnread(req, res),
)

// ==================== STICKERS ====================
router.post('/sticker', (req, res) =>
  whatsappFeatureController.sendSticker(req, res),
)

router.post('/sticker-gif', (req, res) =>
  whatsappFeatureController.sendStickerGif(req, res),
)

// ==================== FAVORITOS ====================
router.post('/star', (req, res) =>
  whatsappFeatureController.starMessage(req, res),
)

// ==================== PRESENÇA ====================
router.post('/presence/online', (req, res) =>
  whatsappFeatureController.setOnlinePresence(req, res),
)

router.post('/presence/subscribe', (req, res) =>
  whatsappFeatureController.subscribePresence(req, res),
)

router.post('/presence/unsubscribe', (req, res) =>
  whatsappFeatureController.unsubscribePresence(req, res),
)

// ==================== STATUS/STORIES ====================
router.post('/status/image', (req, res) =>
  whatsappFeatureController.sendImageStatus(req, res),
)

router.post('/status/video', (req, res) =>
  whatsappFeatureController.sendVideoStatus(req, res),
)

router.post('/status/text', (req, res) =>
  whatsappFeatureController.sendTextStatus(req, res),
)

router.post('/status/read', (req, res) =>
  whatsappFeatureController.sendReadStatus(req, res),
)

// ==================== CONTATOS ====================
router.post('/contact/block', (req, res) =>
  whatsappFeatureController.blockContact(req, res),
)

router.post('/contact/unblock', (req, res) =>
  whatsappFeatureController.unblockContact(req, res),
)

router.post('/contact/info', (req, res) =>
  whatsappFeatureController.getContact(req, res),
)

router.post('/contact/check-number', (req, res) =>
  whatsappFeatureController.checkNumberStatus(req, res),
)

router.post('/contact/last-seen', (req, res) =>
  whatsappFeatureController.getLastSeen(req, res),
)

router.post('/contact/is-online', (req, res) =>
  whatsappFeatureController.getChatIsOnline(req, res),
)

// ==================== CHAT ====================
router.post('/chat/archive', (req, res) =>
  whatsappFeatureController.archiveChat(req, res),
)

router.post('/chat/pin', (req, res) =>
  whatsappFeatureController.pinChat(req, res),
)

router.delete('/chat/:chatId', (req, res) =>
  whatsappFeatureController.deleteChat(req, res),
)

router.post('/chat/clear', (req, res) =>
  whatsappFeatureController.clearChat(req, res),
)

router.post('/chat/disappearing', (req, res) =>
  whatsappFeatureController.setDisappearing(req, res),
)

router.post('/contact/mute', (req, res) =>
  whatsappFeatureController.muteContact(req, res),
)

// ==================== PERFIL ====================
router.post('/profile/name', (req, res) =>
  whatsappFeatureController.setProfileName(req, res),
)

router.post('/profile/pic', (req, res) =>
  whatsappFeatureController.setProfilePic(req, res),
)

router.post('/profile/status', (req, res) =>
  whatsappFeatureController.setProfileStatus(req, res),
)

router.post('/profile/pic/remove', (req, res) =>
  whatsappFeatureController.removeProfilePic(req, res),
)

// ==================== DEVICE INFO ====================
router.get('/device-info', (req, res) =>
  whatsappFeatureController.getDeviceInfo(req, res),
)

// ==================== BROADCAST ====================
router.post('/broadcast', (req, res) =>
  whatsappFeatureController.sendBroadcast(req, res),
)

export default router
