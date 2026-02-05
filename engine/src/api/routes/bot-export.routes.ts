import { Router } from 'express'
import * as fs from 'fs'
import multer from 'multer'
import * as path from 'path'

import { BotExportController } from '../controllers/BotExportController'

const router = Router()
const controller = new BotExportController()

// Configuração do multer para upload de arquivos .jn
const uploadDir = path.join(process.cwd(), 'uploads', 'temp')

// Garante que o diretório existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${uniqueSuffix}-${file.originalname}`)
  },
})

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.jn')) {
      cb(null, true)
    } else {
      cb(new Error('Apenas arquivos .jn são permitidos'))
    }
  },
})

/**
 * @swagger
 * tags:
 *   name: Bot Export/Import
 *   description: Exportação e importação de bots em formato .jn
 */

/**
 * @swagger
 * /api/bots/{botId}/export:
 *   post:
 *     summary: Exporta um bot para arquivo .jn
 *     tags: [Bot Export/Import]
 *     parameters:
 *       - in: path
 *         name: botId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do bot a ser exportado
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               exportedBy:
 *                 type: string
 *                 description: Nome do usuário que está exportando
 *               metadata:
 *                 type: object
 *                 description: Metadados adicionais
 *     responses:
 *       200:
 *         description: Bot exportado com sucesso
 *       404:
 *         description: Bot não encontrado
 *       500:
 *         description: Erro ao exportar bot
 */
router.post('/:botId/export', (req, res) => controller.exportBot(req, res))

/**
 * @swagger
 * /api/bots/import:
 *   post:
 *     summary: Importa um bot a partir de arquivo .jn
 *     tags: [Bot Export/Import]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo .jn do bot
 *     responses:
 *       200:
 *         description: Bot importado com sucesso
 *       400:
 *         description: Arquivo inválido ou estrutura incorreta
 *       500:
 *         description: Erro ao importar bot
 */
router.post('/import', upload.single('file'), (req, res) =>
  controller.importBot(req, res),
)

/**
 * @swagger
 * /api/bots/exports:
 *   get:
 *     summary: Lista todos os bots exportados
 *     tags: [Bot Export/Import]
 *     responses:
 *       200:
 *         description: Lista de exports
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exports:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       filename:
 *                         type: string
 *                       filepath:
 *                         type: string
 *                       bot:
 *                         type: object
 *       500:
 *         description: Erro ao listar exports
 */
router.get('/exports', (req, res) => controller.listExports(req, res))

/**
 * @swagger
 * /api/bots/export/{filename}/download:
 *   get:
 *     summary: Faz download de um arquivo .jn exportado
 *     tags: [Bot Export/Import]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: Nome do arquivo a ser baixado
 *     responses:
 *       200:
 *         description: Arquivo para download
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Arquivo não encontrado
 *       500:
 *         description: Erro ao baixar arquivo
 */
router.get('/export/:filename/download', (req, res) =>
  controller.downloadExport(req, res),
)

/**
 * @swagger
 * /api/bots/export/{filename}/info:
 *   get:
 *     summary: Obtém informações sobre um arquivo .jn exportado
 *     tags: [Bot Export/Import]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: Nome do arquivo
 *     responses:
 *       200:
 *         description: Informações do arquivo
 *       404:
 *         description: Arquivo não encontrado
 *       500:
 *         description: Erro ao obter informações
 */
router.get('/export/:filename/info', (req, res) =>
  controller.getExportInfo(req, res),
)

/**
 * @swagger
 * /api/bots/export/{filename}:
 *   delete:
 *     summary: Deleta um arquivo .jn exportado
 *     tags: [Bot Export/Import]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: Nome do arquivo a ser deletado
 *     responses:
 *       200:
 *         description: Arquivo deletado com sucesso
 *       404:
 *         description: Arquivo não encontrado
 *       500:
 *         description: Erro ao deletar arquivo
 */
router.delete('/export/:filename', (req, res) =>
  controller.deleteExport(req, res),
)

export default router
