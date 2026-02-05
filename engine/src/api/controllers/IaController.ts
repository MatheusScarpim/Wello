import { Request, Response } from 'express'

import { IaService } from '../services/IaService'
import { BaseController } from './BaseController'

export class IaController extends BaseController {
  private iaService: IaService

  constructor() {
    super()
    this.iaService = new IaService()
  }

  /**
   * GET /api/ia/company-description
   * Retorna a descricao da empresa
   */
  public getCompanyDescription = this.asyncHandler(
    async (req: Request, res: Response) => {
      const description = await this.iaService.getCompanyDescription()

      this.sendSuccess(res, { description }, 'Descricao recuperada com sucesso')
    },
  )

  /**
   * POST /api/ia/company-description
   * Salva a descricao da empresa
   */
  public saveCompanyDescription = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { description } = req.body

      if (description === undefined) {
        return this.sendError(res, 'Campo description e obrigatorio', 400)
      }

      await this.iaService.saveCompanyDescription(description)

      this.sendSuccess(res, { description }, 'Descricao salva com sucesso')
    },
  )

  /**
   * GET /api/ia/suggestion-instructions
   * Retorna as instrucoes de sugestoes
   */
  public getSuggestionInstructions = this.asyncHandler(
    async (req: Request, res: Response) => {
      const instructions = await this.iaService.getSuggestionInstructions()

      this.sendSuccess(
        res,
        { instructions },
        'Instrucoes recuperadas com sucesso',
      )
    },
  )

  /**
   * POST /api/ia/suggestion-instructions
   * Salva as instrucoes de sugestoes
   */
  public saveSuggestionInstructions = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { instructions } = req.body

      if (instructions === undefined) {
        return this.sendError(res, 'Campo instructions e obrigatorio', 400)
      }

      await this.iaService.saveSuggestionInstructions(instructions)

      this.sendSuccess(res, { instructions }, 'Instrucoes salvas com sucesso')
    },
  )

  /**
   * POST /api/ia/suggestion
   * Gera uma sugestao de resposta para o atendimento
   */
  public getSuggestion = this.asyncHandler(
    async (req: Request, res: Response) => {
      const validation = this.validateRequiredFields(req.body, [
        'conversationId',
      ])

      if (!validation.valid) {
        return this.sendError(res, 'Campo conversationId e obrigatorio', 400, {
          missing: validation.missing,
        })
      }

      const { conversationId, lastMessages } = req.body
      const operatorId = (req as any).user?.userId

      try {
        const result = await this.iaService.generateSuggestion(
          conversationId,
          lastMessages || 20,
          operatorId,
        )

        this.sendSuccess(res, result, 'Sugestao gerada com sucesso')
      } catch (error: any) {
        if (error.message === 'Conversa não encontrada') {
          return this.sendError(res, error.message, 404)
        }
        throw error
      }
    },
  )

  /**
   * POST /api/ia/improve-message
   * Melhora uma mensagem antes de enviar
   */
  public improveMessage = this.asyncHandler(
    async (req: Request, res: Response) => {
      const validation = this.validateRequiredFields(req.body, [
        'conversationId',
        'message',
      ])

      if (!validation.valid) {
        return this.sendError(
          res,
          'Campos conversationId e message sao obrigatorios',
          400,
          { missing: validation.missing },
        )
      }

      const { conversationId, message } = req.body

      try {
        const improved = await this.iaService.improveMessage(
          conversationId,
          message,
        )

        this.sendSuccess(res, { improved }, 'Mensagem melhorada com sucesso')
      } catch (error: any) {
        if (error.message === 'Conversa não encontrada') {
          return this.sendError(res, error.message, 404)
        }
        throw error
      }
    },
  )

  /**
   * GET /api/ia/config
   * Retorna configuracoes da IA
   */
  public getConfig = this.asyncHandler(async (req: Request, res: Response) => {
    const config = await this.iaService.getConfig()

    this.sendSuccess(res, config, 'Configuracoes recuperadas com sucesso')
  })

  /**
   * PUT /api/ia/config
   * Atualiza configuracoes da IA
   */
  public saveConfig = this.asyncHandler(async (req: Request, res: Response) => {
    const config = await this.iaService.saveConfig(req.body)

    this.sendSuccess(res, config, 'Configuracoes salvas com sucesso')
  })
}
