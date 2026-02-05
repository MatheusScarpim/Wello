import { Request, Response } from 'express'

import whitelabelRepository from '../repositories/WhitelabelRepository'
import { BaseController } from './BaseController'

class WhitelabelController extends BaseController {
  /**
   * Busca configurações whitelabel
   */
  async getSettings(req: Request, res: Response): Promise<void> {
    try {
      const settings = await whitelabelRepository.getSettings()
      this.sendSuccess(res, settings, 'Configurações carregadas com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Atualiza configurações whitelabel
   */
  async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const updates = req.body

      // Validate that at least one field is being updated
      if (Object.keys(updates).length === 0) {
        this.sendError(res, 'Nenhum campo para atualizar', 400)
        return
      }

      const updated = await whitelabelRepository.updateSettings(updates)

      if (updated) {
        this.sendSuccess(res, updated, 'Configurações atualizadas com sucesso')
      } else {
        this.sendError(res, 'Falha ao atualizar configurações', 500)
      }
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Atualiza apenas o tema
   */
  async updateTheme(req: Request, res: Response): Promise<void> {
    try {
      const theme = req.body

      if (!theme || Object.keys(theme).length === 0) {
        this.sendError(res, 'Dados do tema não fornecidos', 400)
        return
      }

      const updated = await whitelabelRepository.updateSettings({ theme })

      if (updated) {
        this.sendSuccess(res, updated, 'Tema atualizado com sucesso')
      } else {
        this.sendError(res, 'Falha ao atualizar tema', 500)
      }
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Atualiza apenas as feature flags
   */
  async updateFeatures(req: Request, res: Response): Promise<void> {
    try {
      const features = req.body

      if (!features || Object.keys(features).length === 0) {
        this.sendError(res, 'Dados das features não fornecidos', 400)
        return
      }

      const updated = await whitelabelRepository.updateSettings({ features })

      if (updated) {
        this.sendSuccess(res, updated, 'Features atualizadas com sucesso')
      } else {
        this.sendError(res, 'Falha ao atualizar features', 500)
      }
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Upload de logo (aceita tipo: 'logo', 'logoSmall', 'favicon')
   * Salva a imagem como base64 no banco de dados
   */
  async uploadLogo(req: Request, res: Response): Promise<void> {
    try {
      const file = req.file as Express.Multer.File | undefined

      if (!file) {
        this.sendError(res, 'Arquivo não enviado', 400)
        return
      }

      // Converte para base64 data URI
      const base64 = file.buffer.toString('base64')
      const dataUri = `data:${file.mimetype};base64,${base64}`

      const type = req.body.type as
        | 'logo'
        | 'logoSmall'
        | 'favicon'
        | 'loginBackground'
        | undefined
      const updateField =
        type === 'logoSmall'
          ? 'logoSmall'
          : type === 'favicon'
            ? 'favicon'
            : type === 'loginBackground'
              ? 'loginBackground'
              : 'logo'

      await whitelabelRepository.updateSettings({ [updateField]: dataUri })

      this.sendSuccess(
        res,
        { url: dataUri },
        `${updateField} enviado com sucesso`,
      )
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Upload de favicon
   * Salva a imagem como base64 no banco de dados
   */
  async uploadFavicon(req: Request, res: Response): Promise<void> {
    try {
      const file = req.file as Express.Multer.File | undefined

      if (!file) {
        this.sendError(res, 'Arquivo não enviado', 400)
        return
      }

      // Converte para base64 data URI
      const base64 = file.buffer.toString('base64')
      const dataUri = `data:${file.mimetype};base64,${base64}`

      await whitelabelRepository.updateSettings({ favicon: dataUri })

      this.sendSuccess(res, { url: dataUri }, 'Favicon enviado com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Restaura configurações padrão
   */
  async resetToDefault(req: Request, res: Response): Promise<void> {
    try {
      const settings = await whitelabelRepository.resetToDefault()

      if (settings) {
        this.sendSuccess(res, settings, 'Configurações restauradas com sucesso')
      } else {
        this.sendError(res, 'Falha ao restaurar configurações', 500)
      }
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }
}

export default new WhitelabelController()
