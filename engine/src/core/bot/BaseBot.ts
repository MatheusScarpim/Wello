import BotSessionRepository from '../repositories/BotSessionRepository'
import { BotConfig, IBot } from './interfaces/IBot'
import {
  IBotStage,
  MessageContext,
  StageResponse,
} from './interfaces/IBotStage'

/**
 * Classe base abstrata para criação de bots
 * Implementa a lógica comum de gerenciamento de estágios
 */
export abstract class BaseBot implements IBot {
  public readonly config: BotConfig
  public readonly stages: Map<number, IBotStage>

  constructor(config: BotConfig) {
    this.config = {
      initialStage: 0,
      sessionTimeout: 1440, // 24 horas
      enableAnalytics: true,
      ...config,
    }
    this.stages = new Map()
  }

  /**
   * Método abstrato para registrar os estágios
   * Deve ser implementado por cada bot específico
   */
  protected abstract registerStages(): void

  /**
   * Inicializa o bot
   */
  async initialize(): Promise<void> {
    console.log(`🤖 Inicializando bot: ${this.config.name} (${this.config.id})`)
    this.registerStages()
    console.log(`✅ Bot inicializado com ${this.stages.size} estágios`)
  }

  /**
   * Processa uma mensagem do usuário.
   * Auto-executa estágios encadeados que não precisam de input do usuário.
   */
  async processMessage(context: MessageContext): Promise<StageResponse> {
    const MAX_CHAIN = 25

    try {
      // Busca ou cria sessão
      let session = await BotSessionRepository.getActiveSession(
        context.conversationId,
      )

      if (!session) {
        session = await BotSessionRepository.upsertSession(
          context.conversationId,
          this.config.id,
          this.config.initialStage || 0,
          {},
        )
      }

      if (!session) {
        throw new Error('Falha ao criar sessão')
      }

      // Adiciona dados da sessão ao contexto
      context.sessionData = session.sessionData

      let currentStageNum = session.currentStage
      const collectedMessages: string[] = []
      let finalResponse: StageResponse = { message: 'Erro interno', endSession: true }

      for (let i = 0; i < MAX_CHAIN; i++) {
        const stage = this.getStage(currentStageNum)

        if (!stage) {
          throw new Error(`Estágio ${currentStageNum} não encontrado`)
        }

        // Validação só na primeira iteração (input do usuário)
        if (i === 0) {
          if (stage.beforeExecute) {
            await stage.beforeExecute(context)
          }

          if (stage.validate) {
            const validation = await stage.validate(context.message, context)
            if (!validation.isValid) {
              return {
                message:
                  validation.error ||
                  'Entrada inválida. Por favor, tente novamente.',
                skipMessage: false,
              }
            }
          }
        }

        // Executa o estágio
        const response = await stage.execute(context)

        // Atualiza sessão se necessário
        if (response.updateSessionData) {
          await BotSessionRepository.mergeSessionData(
            context.conversationId,
            response.updateSessionData,
          )
          context.sessionData = { ...context.sessionData, ...response.updateSessionData }
        }

        if (response.nextStage !== undefined) {
          await BotSessionRepository.updateStage(
            context.conversationId,
            response.nextStage,
          )
        }

        if (response.endSession) {
          await BotSessionRepository.endSession(context.conversationId)
        }

        // Executa hook pós-processamento
        if (stage.afterExecute) {
          await stage.afterExecute(context, response)
        }

        // Analytics (se habilitado)
        if (this.config.enableAnalytics) {
          await this.logAnalytics(context, stage.stageNumber, response)
        }

        // Coleta mensagem de texto se presente e não skipMessage
        if (response.message && !response.skipMessage) {
          collectedMessages.push(response.message)
        }

        // Condições de parada — o estágio precisa de interação do usuário
        const shouldStop =
          response.nextStage === undefined ||
          response.endSession ||
          response.buttons ||
          response.list ||
          response.media ||
          response.transferToHuman

        if (shouldStop) {
          finalResponse = response
          break
        }

        // Auto-avança para o próximo estágio
        currentStageNum = response.nextStage!
      }

      // Monta resposta final com mensagens acumuladas dos estágios anteriores
      if (collectedMessages.length > 0) {
        if (finalResponse.message && !finalResponse.skipMessage) {
          // Resposta final também tem mensagem — ela já está em collectedMessages
          // (foi adicionada no loop), então usa direto
          finalResponse._previousMessages = collectedMessages.slice(0, -1)
          finalResponse.message = collectedMessages[collectedMessages.length - 1]
        } else if (finalResponse.buttons || finalResponse.list || finalResponse.media) {
          // Resposta final é interativa — envia textos anteriores separadamente
          finalResponse._previousMessages = collectedMessages
        } else {
          // Sem conteúdo final (skipMessage) — usa mensagens coletadas
          finalResponse.message = collectedMessages[collectedMessages.length - 1]
          finalResponse._previousMessages = collectedMessages.slice(0, -1)
          finalResponse.skipMessage = false
        }
      }

      return finalResponse
    } catch (error) {
      console.error(
        `❌ Erro ao processar mensagem no bot ${this.config.id}:`,
        error,
      )
      return {
        message:
          'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
        skipMessage: false,
      }
    }
  }

  /**
   * Adiciona um estágio ao bot
   */
  addStage(stage: IBotStage): void {
    if (this.stages.has(stage.stageNumber)) {
      console.warn(
        `⚠️  Estágio ${stage.stageNumber} já existe e será substituído`,
      )
    }
    this.stages.set(stage.stageNumber, stage)
  }

  /**
   * Remove um estágio
   */
  removeStage(stageNumber: number): void {
    this.stages.delete(stageNumber)
  }

  /**
   * Retorna um estágio específico
   */
  getStage(stageNumber: number): IBotStage | undefined {
    return this.stages.get(stageNumber)
  }

  /**
   * Verifica se um estágio existe
   */
  hasStage(stageNumber: number): boolean {
    return this.stages.has(stageNumber)
  }

  /**
   * Retorna todos os números de estágios disponíveis
   */
  getAvailableStages(): number[] {
    return Array.from(this.stages.keys()).sort((a, b) => a - b)
  }

  /**
   * Registra analytics (pode ser sobrescrito)
   */
  protected async logAnalytics(
    context: MessageContext,
    stageNumber: number,
    response: StageResponse,
  ): Promise<void> {
    // Implementação básica - pode ser expandida
    // console.log(`📊 Analytics: Bot ${this.config.id}, Stage ${stageNumber}`)
  }

  /**
   * Finaliza o bot e libera recursos
   */
  async dispose(): Promise<void> {
    console.log(`🛑 Finalizando bot: ${this.config.name}`)
    this.stages.clear()
  }
}
