import { IBotStage, MessageContext, StageResponse } from './IBotStage'

/**
 * Configuração do bot
 */
export interface BotConfig {
  id: string
  name: string
  description?: string
  initialStage?: number
  sessionTimeout?: number // em minutos
  enableAnalytics?: boolean
}

/**
 * Interface principal de um bot
 */
export interface IBot {
  /**
   * Configuração do bot
   */
  readonly config: BotConfig

  /**
   * Estágios do bot
   */
  readonly stages: Map<number, IBotStage>

  /**
   * Inicializa o bot (carrega recursos, conecta APIs, etc)
   */
  initialize(): Promise<void>

  /**
   * Processa uma mensagem
   */
  processMessage(context: MessageContext): Promise<StageResponse>

  /**
   * Retorna um estágio específico
   */
  getStage(stageNumber: number): IBotStage | undefined

  /**
   * Adiciona um novo estágio
   */
  addStage(stage: IBotStage): void

  /**
   * Remove um estágio
   */
  removeStage(stageNumber: number): void

  /**
   * Valida se um estágio existe
   */
  hasStage(stageNumber: number): boolean

  /**
   * Retorna todos os números de estágios disponíveis
   */
  getAvailableStages(): number[]

  /**
   * Finaliza o bot (limpa recursos, fecha conexões, etc)
   */
  dispose?(): Promise<void>
}
