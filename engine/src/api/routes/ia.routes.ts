import { Router } from 'express'
import multer from 'multer'

import { IaController } from '../controllers/IaController'

const router = Router()
const controller = new IaController()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true)
    } else {
      cb(new Error('Apenas arquivos de audio sao permitidos'))
    }
  },
})

/**
 * Rotas de IA (Inteligencia Artificial)
 */

// Busca descricao da empresa
router.get('/company-description', controller.getCompanyDescription)

// Salva descricao da empresa
router.post('/company-description', controller.saveCompanyDescription)

// Busca instrucoes de sugestoes
router.get('/suggestion-instructions', controller.getSuggestionInstructions)

// Salva instrucoes de sugestoes
router.post('/suggestion-instructions', controller.saveSuggestionInstructions)

// Gera sugestao de resposta
router.post('/suggestion', controller.getSuggestion)

// Melhora mensagem antes de enviar
router.post('/improve-message', controller.improveMessage)

// Gera audio a partir de texto (Text-to-Speech)
router.post('/text-to-speech', controller.textToSpeech)

// Transcreve audio para texto (Speech-to-Text)
router.post('/speech-to-text', upload.single('audio'), controller.speechToText)

// Clona voz na ElevenLabs
router.post('/clone-voice', upload.single('audio'), controller.cloneVoice)

// Lista vozes disponiveis na ElevenLabs
router.get('/elevenlabs-voices', controller.listElevenLabsVoices)

// Gera bot completo com IA
router.post('/generate-bot', controller.generateBot)

// Busca configuracoes da IA
router.get('/config', controller.getConfig)

// Atualiza configuracoes da IA
router.put('/config', controller.saveConfig)

export default router
