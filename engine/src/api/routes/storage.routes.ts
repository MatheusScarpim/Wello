import { Request, Response, Router } from 'express'
import { ObjectId } from 'mongodb'
import multer from 'multer'

import {
  StorageConfigDocument,
  StorageConfigRepository,
} from '@/api/repositories/StorageConfigRepository'
import { azureStorageService } from '@/services/AzureStorageService'

const router = Router()
const repository = new StorageConfigRepository()

function sendSuccess(
  res: Response,
  payload: Record<string, unknown> = {},
  statusCode = 200,
) {
  res.status(statusCode).json({
    success: true,
    data: payload,
    timestamp: new Date().toISOString(),
  })
}

// Configura multer para upload de arquivos em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
})

/**
 * GET /api/storage/config
 * Lista todas as configurações de storage
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    const configs = await repository.find({} as any)

    // Remove campos sensíveis
    const safeConfigs = configs.map((config) => {
      const { accountKey, connectionString, ...safe } = config
      return safe
    })

    sendSuccess(res, { configs: safeConfigs })
  } catch (error: any) {
    console.error('Erro ao listar configurações:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

/**
 * GET /api/storage/config/active
 * Obtém a configuração ativa
 */
router.get('/config/active', async (req: Request, res: Response) => {
  try {
    const config = await repository.findActive()

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Nenhuma configuração ativa encontrada',
      })
    }

    // Remove campos sensíveis
    const { accountKey, connectionString, ...safeConfig } = config

    sendSuccess(res, { config: safeConfig })
  } catch (error: any) {
    console.error('Erro ao obter configuração ativa:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

/**
 * POST /api/storage/config
 * Cria uma nova configuração de storage
 */
router.post('/config', async (req: Request, res: Response) => {
  try {
    const {
      accountName,
      accountKey,
      containerName,
      connectionString,
      endpoint,
      isActive,
    } = req.body

    const now = new Date()

    const newConfig: StorageConfigDocument = {
      provider: 'azure_blob',
      accountName,
      accountKey,
      containerName: containerName || 'nxzap-media',
      connectionString,
      endpoint,
      isActive: isActive !== undefined ? isActive : true,
      createdAt: now,
      updatedAt: now,
    } as StorageConfigDocument

    // Se for ativa, desativa as outras
    if (newConfig.isActive) {
      await repository.deactivateAll()
    }

    const config = await repository.create(newConfig)

    // Se for ativa, reinicializa o serviço
    if (config.isActive) {
      await azureStorageService.initialize()
    }

    // Retorna sem as credenciais
    const { accountKey: _, connectionString: __, ...safeConfig } = config

    sendSuccess(res, { config: safeConfig }, 201)
  } catch (error: any) {
    console.error('Erro ao criar configuração:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

/**
 * PUT /api/storage/config/:id
 * Atualiza uma configuração de storage
 */
router.put('/config/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const updates = req.body

    // Adiciona updatedAt
    updates.updatedAt = new Date()

    // Se for ativa, desativa as outras
    if (updates.isActive) {
      await repository.updateMany(
        { _id: { $ne: new ObjectId(id) }, isActive: true } as any,
        { $set: { isActive: false, updatedAt: new Date() } } as any,
      )
    }

    const success = await repository.updateOne(
      { _id: new ObjectId(id) } as any,
      { $set: updates } as any,
    )

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Configuração não encontrada',
      })
    }

    // Busca a configuração atualizada
    const config = await repository.findById(id)

    // Se foi ativada, reinicializa o serviço
    if (updates.isActive) {
      await azureStorageService.initialize()
    }

    // Remove campos sensíveis
    const { accountKey, connectionString, ...safeConfig } = config!

    sendSuccess(res, { config: safeConfig })
  } catch (error: any) {
    console.error('Erro ao atualizar configuração:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

/**
 * DELETE /api/storage/config/:id
 * Deleta uma configuração de storage
 */
router.delete('/config/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const success = await repository.deleteOne({ _id: new ObjectId(id) } as any)

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Configuração não encontrada',
      })
    }

    sendSuccess(res, { message: 'Configuração deletada com sucesso' })
  } catch (error: any) {
    console.error('Erro ao deletar configuração:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

/**
 * POST /api/storage/upload/file
 * Faz upload de um arquivo (multipart/form-data)
 */
router.post(
  '/upload/file',
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum arquivo fornecido',
        })
      }

      const result = await azureStorageService.uploadBuffer(req.file.buffer, {
        fileName: req.file.originalname,
        contentType: req.file.mimetype,
        metadata: {
          uploadedBy: req.body.userId || 'system',
          originalName: req.file.originalname,
        },
      })

      sendSuccess(res, { result })
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error)
      res.status(500).json({
        success: false,
        error: error.message,
      })
    }
  },
)

/**
 * POST /api/storage/upload/base64
 * Faz upload de um arquivo base64
 */
router.post('/upload/base64', async (req: Request, res: Response) => {
  try {
    const { base64Data, fileName, contentType } = req.body

    if (!base64Data) {
      return res.status(400).json({
        success: false,
        error: 'base64Data é obrigatório',
      })
    }

    const result = await azureStorageService.uploadBase64(base64Data, {
      fileName,
      contentType,
    })

    sendSuccess(res, { result })
  } catch (error: any) {
    console.error('Erro ao fazer upload de base64:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

/**
 * POST /api/storage/upload/url
 * Faz upload de um arquivo a partir de uma URL
 */
router.post('/upload/url', async (req: Request, res: Response) => {
  try {
    const { url, fileName, contentType } = req.body

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'url é obrigatória',
      })
    }

    const result = await azureStorageService.uploadFromUrl(url, {
      fileName,
      contentType,
    })

    sendSuccess(res, { result })
  } catch (error: any) {
    console.error('Erro ao fazer upload de URL:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

/**
 * DELETE /api/storage/blob/:blobName
 * Deleta um blob
 */
router.delete('/blob/:blobName', async (req: Request, res: Response) => {
  try {
    const { blobName } = req.params

    await azureStorageService.deleteBlob(blobName)

    res.json({
      success: true,
      message: 'Blob deletado com sucesso',
    })
  } catch (error: any) {
    console.error('Erro ao deletar blob:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

/**
 * GET /api/storage/blobs
 * Lista blobs no container
 */
router.get('/blobs', async (req: Request, res: Response) => {
  try {
    const { prefix } = req.query

    const blobs = await azureStorageService.listBlobs(prefix as string)

    sendSuccess(res, {
      blobs,
      count: blobs.length,
    })
  } catch (error: any) {
    console.error('Erro ao listar blobs:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

/**
 * GET /api/storage/status
 * Verifica o status do serviço de storage
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const config = await repository.findActive()

    sendSuccess(res, {
      configured: !!config,
      provider: config?.provider || null,
      containerName: config?.containerName || null,
    })
  } catch (error: any) {
    console.error('Erro ao verificar status:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

export default router
