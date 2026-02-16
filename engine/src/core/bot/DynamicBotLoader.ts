import BotFactory from './BotFactory'
import { DynamicBot } from './DynamicBot'
import visualBotRepository from '../../api/repositories/VisualBotRepository'

/**
 * Servico que carrega bots visuais publicados no BotFactory
 * Chamado na inicializacao da aplicacao e quando bots sao publicados/despublicados
 */
export class DynamicBotLoader {
  /**
   * Carrega todos os bots visuais publicados e registra no BotFactory
   * Chamado em Application.registerBots()
   */
  static async loadAllPublished(): Promise<void> {
    try {
      const publishedBots = await visualBotRepository.findPublished()

      for (const definition of publishedBots) {
        try {
          const BotClass = DynamicBot.createFactory(definition as any)
          BotFactory.registerBot(definition.botId, BotClass)
          await BotFactory.createBot(definition.botId)
          console.log(
            `🤖 Bot visual carregado: ${definition.name} (${definition.botId})`,
          )
        } catch (error) {
          console.error(
            `❌ Falha ao carregar bot visual ${definition.botId}:`,
            error,
          )
        }
      }

      if (publishedBots.length > 0) {
        console.log(
          `✅ ${publishedBots.length} bot(s) visual(is) carregado(s)`,
        )
      }
    } catch (error) {
      console.error('❌ Erro ao carregar bots visuais:', error)
    }
  }

  /**
   * Publica um bot individual — registra no BotFactory em runtime
   */
  static async publishBot(botId: string): Promise<void> {
    const definition = await visualBotRepository.findByBotId(botId)
    if (!definition) {
      throw new Error(`Bot visual ${botId} nao encontrado`)
    }

    // Remover se ja registrado
    if (BotFactory.isBotRegistered(botId)) {
      await BotFactory.removeBot(botId)
    }

    const BotClass = DynamicBot.createFactory(definition as any)
    BotFactory.registerBot(botId, BotClass)
    await BotFactory.createBot(botId)

    console.log(`🤖 Bot visual publicado: ${definition.name} (${botId})`)
  }

  /**
   * Despublica um bot — remove do BotFactory em runtime
   */
  static async unpublishBot(botId: string): Promise<void> {
    if (BotFactory.isBotRegistered(botId)) {
      await BotFactory.removeBot(botId)
      console.log(`🛑 Bot visual despublicado: ${botId}`)
    }
  }
}
