import { Router } from 'express'
import multer from 'multer'

import whitelabelController from '../controllers/WhitelabelController'

const router = Router()

// Configuração do multer para upload em memória (será convertido para base64)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB para suportar imagens de background maiores
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Apenas arquivos de imagem são permitidos'))
    }
  },
})

// Busca configurações de whitelabel
router.get('/', (req, res) => whitelabelController.getSettings(req, res))

// Atualiza configurações de whitelabel
router.put('/', (req, res) => whitelabelController.updateSettings(req, res))

// Atualiza apenas o tema
router.patch('/theme', (req, res) => whitelabelController.updateTheme(req, res))

// Atualiza apenas as feature flags
router.patch('/features', (req, res) =>
  whitelabelController.updateFeatures(req, res),
)

// Upload de logo (aceita tipo: 'logo', 'logoSmall', 'favicon')
router.post('/logo', upload.single('file'), (req, res) =>
  whitelabelController.uploadLogo(req, res),
)

// Upload de favicon (rota separada)
router.post('/favicon', upload.single('file'), (req, res) =>
  whitelabelController.uploadFavicon(req, res),
)

// Reset para configurações padrão
router.post('/reset', (req, res) =>
  whitelabelController.resetToDefault(req, res),
)

export default router
