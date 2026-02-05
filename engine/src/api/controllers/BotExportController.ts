import { Request, Response } from 'express'
import * as fs from 'fs'
import * as path from 'path'

import BotFactory from '@/core/bot/BotFactory'

import { BotExportService } from '../services/BotExportService'
import { BaseController } from './BaseController'

/**
 * Controller para exportação e importação de bots
 */
export class BotExportController extends BaseController {
  /**
   * Exporta um bot para arquivo .jn
   * POST /api/bots/:botId/export
   */
  async exportBot(req: Request, res: Response): Promise<void> {
    try {
      const { botId } = req.params
      const { exportedBy, metadata } = req.body

      // Busca o bot
      const bot = BotFactory.getBot(botId)
      if (!bot) {
        this.sendError(res, 'Bot não encontrado', 404)
        return
      }

      // Exporta o bot
      const result = await BotExportService.exportBot(bot, exportedBy, metadata)

      if (result.success) {
        this.sendSuccess(res, result, result.message)
      } else {
        this.sendError(res, result.message, 500)
      }
    } catch (error) {
      this.sendError(res, 'Erro ao exportar bot', 500, error)
    }
  }

  /**
   * Download do arquivo .jn exportado
   * GET /api/bots/export/download/:filename
   */
  async downloadExport(req: Request, res: Response): Promise<void> {
    try {
      const { filename } = req.params

      // Valida filename para segurança
      if (!filename || !filename.endsWith('.jn') || filename.includes('..')) {
        this.sendError(res, 'Nome de arquivo inválido', 400)
        return
      }

      const filepath = path.join(process.cwd(), 'exports', filename)

      // Verifica se o arquivo existe
      if (!fs.existsSync(filepath)) {
        this.sendError(res, 'Arquivo não encontrado', 404)
        return
      }

      // Envia o arquivo para download
      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

      const fileStream = fs.createReadStream(filepath)
      fileStream.pipe(res)
    } catch (error) {
      this.sendError(res, 'Erro ao baixar arquivo', 500, error)
    }
  }

  /**
   * Importa um bot a partir de arquivo .jn
   * POST /api/bots/import
   */
  async importBot(req: Request, res: Response): Promise<void> {
    try {
      // Verifica se há arquivo no upload
      if (!req.file) {
        this.sendError(res, 'Nenhum arquivo foi enviado', 400)
        return
      }

      const { path: tempFilePath } = req.file

      // Valida extensão
      if (!req.file.originalname.endsWith('.jn')) {
        // Remove arquivo temporário
        fs.unlinkSync(tempFilePath)
        this.sendError(
          res,
          'Formato de arquivo inválido. Use arquivos .jn',
          400,
        )
        return
      }

      // Importa o bot
      const result = await BotExportService.importBot(tempFilePath)

      // Remove arquivo temporário
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath)
      }

      if (result.success) {
        this.sendSuccess(res, result, result.message)
      } else {
        this.sendError(res, result.message, 400, {
          errors: result.errors,
          warnings: result.warnings,
        })
      }
    } catch (error) {
      // Remove arquivo temporário em caso de erro
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path)
      }
      this.sendError(res, 'Erro ao importar bot', 500, error)
    }
  }

  /**
   * Lista todos os bots exportados
   * GET /api/bots/exports
   */
  async listExports(req: Request, res: Response): Promise<void> {
    try {
      const exports = BotExportService.listExportedBots()
      this.sendSuccess(
        res,
        { exports, count: exports.length },
        'Exports listados com sucesso',
      )
    } catch (error) {
      this.sendError(res, 'Erro ao listar exports', 500, error)
    }
  }

  /**
   * Deleta um export
   * DELETE /api/bots/export/:filename
   */
  async deleteExport(req: Request, res: Response): Promise<void> {
    try {
      const { filename } = req.params

      // Valida filename para segurança
      if (!filename || !filename.endsWith('.jn') || filename.includes('..')) {
        this.sendError(res, 'Nome de arquivo inválido', 400)
        return
      }

      const success = BotExportService.deleteExportedBot(filename)

      if (success) {
        this.sendSuccess(res, null, 'Export deletado com sucesso')
      } else {
        this.sendError(res, 'Arquivo não encontrado', 404)
      }
    } catch (error) {
      this.sendError(res, 'Erro ao deletar export', 500, error)
    }
  }

  /**
   * Retorna informações sobre um arquivo .jn
   * GET /api/bots/export/:filename/info
   */
  async getExportInfo(req: Request, res: Response): Promise<void> {
    try {
      const { filename } = req.params

      // Valida filename para segurança
      if (!filename || !filename.endsWith('.jn') || filename.includes('..')) {
        this.sendError(res, 'Nome de arquivo inválido', 400)
        return
      }

      const filepath = path.join(process.cwd(), 'exports', filename)

      if (!fs.existsSync(filepath)) {
        this.sendError(res, 'Arquivo não encontrado', 404)
        return
      }

      const content = fs.readFileSync(filepath, 'utf-8')
      const jnFile = JSON.parse(content)

      // Retorna apenas informações básicas, sem o conteúdo completo
      const info = {
        filename,
        fileVersion: jnFile.fileVersion,
        exportDate: jnFile.exportDate,
        exportedBy: jnFile.exportedBy,
        bot: {
          id: jnFile.bot.id,
          name: jnFile.bot.name,
          description: jnFile.bot.description,
          version: jnFile.bot.version,
          stageCount: jnFile.bot.stages?.length || 0,
          metadata: jnFile.bot.metadata,
        },
      }

      this.sendSuccess(res, info, 'Informações do export')
    } catch (error) {
      this.sendError(res, 'Erro ao obter informações do export', 500, error)
    }
  }
}
