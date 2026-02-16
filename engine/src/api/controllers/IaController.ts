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
   * POST /api/ia/text-to-speech
   * Gera audio a partir de texto usando OpenAI TTS
   */
  public textToSpeech = this.asyncHandler(
    async (req: Request, res: Response) => {
      const validation = this.validateRequiredFields(req.body, ['text'])

      if (!validation.valid) {
        return this.sendError(res, 'Campo text e obrigatorio', 400, {
          missing: validation.missing,
        })
      }

      const { text, voice, model, provider, elevenLabsVoiceId } = req.body

      try {
        const result = await this.iaService.textToSpeech(text, voice, model, provider, elevenLabsVoiceId)

        this.sendSuccess(res, result, 'Audio gerado com sucesso')
      } catch (error: any) {
        if (error.message.includes('nao configurada')) {
          return this.sendError(res, error.message, 503)
        }
        if (
          error.message.includes('obrigatorio') ||
          error.message.includes('muito longo')
        ) {
          return this.sendError(res, error.message, 400)
        }
        throw error
      }
    },
  )

  /**
   * POST /api/ia/speech-to-text
   * Transcreve audio para texto usando OpenAI Whisper
   */
  public speechToText = this.asyncHandler(
    async (req: Request, res: Response) => {
      const file = (req as any).file

      if (!file) {
        return this.sendError(res, 'Arquivo de audio e obrigatorio', 400)
      }

      try {
        const result = await this.iaService.speechToText(file.buffer, file.originalname)
        this.sendSuccess(res, result, 'Audio transcrito com sucesso')
      } catch (error: any) {
        if (error.message.includes('nao configurada')) {
          return this.sendError(res, error.message, 503)
        }
        throw error
      }
    },
  )

  /**
   * POST /api/ia/clone-voice
   * Clona uma voz na ElevenLabs a partir de um audio
   */
  public cloneVoice = this.asyncHandler(
    async (req: Request, res: Response) => {
      const file = (req as any).file

      if (!file) {
        return this.sendError(res, 'Arquivo de audio e obrigatorio', 400)
      }

      const name = req.body.name || 'Minha Voz'

      try {
        const result = await this.iaService.cloneVoiceElevenLabs(
          name,
          file.buffer,
          file.originalname,
        )

        this.sendSuccess(res, result, 'Voz clonada com sucesso')
      } catch (error: any) {
        if (error.message.includes('nao configurada')) {
          return this.sendError(res, error.message, 503)
        }
        if (error.message.includes('plano') || error.message.includes('upgrade')) {
          return this.sendError(res, error.message, 403)
        }
        throw error
      }
    },
  )

  /**
   * GET /api/ia/elevenlabs-voices
   * Lista vozes disponiveis na ElevenLabs
   */
  public listElevenLabsVoices = this.asyncHandler(
    async (req: Request, res: Response) => {
      try {
        const voices = await this.iaService.listElevenLabsVoices()
        this.sendSuccess(res, { voices }, 'Vozes listadas com sucesso')
      } catch (error: any) {
        if (error.message.includes('nao configurada')) {
          return this.sendError(res, error.message, 503)
        }
        throw error
      }
    },
  )

  /**
   * POST /api/ia/generate-bot
   * Gera um bot completo a partir de uma descricao em linguagem natural
   */
  public generateBot = this.asyncHandler(
    async (req: Request, res: Response) => {
      const validation = this.validateRequiredFields(req.body, ['prompt'])

      if (!validation.valid) {
        return this.sendError(res, 'Campo prompt e obrigatorio', 400, {
          missing: validation.missing,
        })
      }

      const { prompt } = req.body

      try {
        const result = await this.iaService.generateBot(prompt)

        this.sendSuccess(res, result, 'Bot gerado com sucesso')
      } catch (error: any) {
        if (error.message.includes('nao configurada')) {
          return this.sendError(res, error.message, 503)
        }
        if (error.message.includes('OpenAI API error')) {
          return this.sendError(res, 'Erro ao comunicar com a IA. Tente novamente.', 502)
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
