import { IBot } from './interfaces/IBot'
import { MessageContext, StageResponse } from './interfaces/IBotStage'

/**
 * Factory para criação e gerenciamento de bots
 * Implementa padrão Singleton + Factory
 */
class BotFactory {
  private static instance: BotFactory
  private bots: Map<string, IBot>
  private botConstructors: Map<string, new () => IBot>

  private constructor() {
    this.bots = new Map()
    this.botConstructors = new Map()
  }

  /**
   * Retorna a instância única do BotFactory
   */
  public static getInstance(): BotFactory {
    if (!BotFactory.instance) {
      BotFactory.instance = new BotFactory()
    }
    return BotFactory.instance
  }

  /**
   * Registra um novo tipo de bot
   */
  public registerBot(botId: string, botConstructor: new () => IBot): void {
    if (this.botConstructors.has(botId)) {
      console.warn(`⚠️  Bot ${botId} já está registrado e será substituído`)
    }
    this.botConstructors.set(botId, botConstructor)
    console.log(`✅ Bot registrado: ${botId}`)
  }

  /**
   * Cria e inicializa uma instância de bot
   */
  public async createBot(botId: string): Promise<IBot> {
    // Verifica se já existe uma instância em cache
    if (this.bots.has(botId)) {
      return this.bots.get(botId)!
    }

    // Busca o construtor
    const BotConstructor = this.botConstructors.get(botId)

    if (!BotConstructor) {
      throw new Error(`Bot ${botId} não está registrado`)
    }

    // Cria e inicializa
    const bot = new BotConstructor()
    await bot.initialize()

    // Armazena em cache
    this.bots.set(botId, bot)

    return bot
  }

  /**
   * Retorna um bot já criado
   */
  public getBot(botId: string): IBot | undefined {
    return this.bots.get(botId)
  }

  /**
   * Processa uma mensagem usando o bot apropriado
   */
  public async processMessage(
    botId: string,
    context: MessageContext,
  ): Promise<StageResponse> {
    try {
      const bot = await this.createBot(botId)
      return await bot.processMessage(context)
    } catch (error) {
      console.error(`❌ Erro ao processar mensagem com bot ${botId}:`, error)
      throw error
    }
  }

  /**
   * Remove um bot do cache
   */
  public async removeBot(botId: string): Promise<void> {
    const bot = this.bots.get(botId)
    if (bot && bot.dispose) {
      await bot.dispose()
    }
    this.bots.delete(botId)
    console.log(`🗑️  Bot removido: ${botId}`)
  }

  /**
   * Lista todos os bots registrados
   */
  public getRegisteredBots(): string[] {
    return Array.from(this.botConstructors.keys())
  }

  /**
   * Lista todos os bots ativos (instanciados)
   */
  public getActiveBots(): string[] {
    return Array.from(this.bots.keys())
  }

  /**
   * Verifica se um bot está registrado
   */
  public isBotRegistered(botId: string): boolean {
    return this.botConstructors.has(botId)
  }

  /**
   * Limpa todos os bots
   */
  public async clearAll(): Promise<void> {
    const disposePromises = Array.from(this.bots.values())
      .filter((bot) => bot.dispose)
      .map((bot) => bot.dispose!())

    await Promise.all(disposePromises)

    this.bots.clear()
    console.log('🧹 Todos os bots foram limpos')
  }

  /**
   * Recarrega um bot específico
   */
  public async reloadBot(botId: string): Promise<void> {
    await this.removeBot(botId)
    await this.createBot(botId)
    console.log(`🔄 Bot recarregado: ${botId}`)
  }
}

export default BotFactory.getInstance()
