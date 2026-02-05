import { BaseBot } from '@/core/bot/BaseBot'
import {
  IBotStage,
  MessageContext,
  StageResponse,
} from '@/core/bot/interfaces/IBotStage'
import MessagingService from '@/core/messaging/MessagingService'

import {
  TireShopConfig,
  TireShopPriceTable,
  TireShopRepository,
} from './repository/TireShopRepository'

type ConfigCommandResult = {
  handled: boolean
  response?: StageResponse
}

export class TireShopBot extends BaseBot {
  private repository!: TireShopRepository
  private configCache: TireShopConfig | null = null
  private readonly legacyBrandName = 'PADRAO'

  constructor() {
    super({
      id: 'loja-pneus',
      name: 'Loja de Pneus',
      description: 'Bot de atendimento para loja de pneus',
      initialStage: 0,
      sessionTimeout: 1440,
      enableAnalytics: true,
    })
  }

  protected registerStages(): void {
    this.addStage(new TireShopMainStage(this))
  }

  async initialize(): Promise<void> {
    await super.initialize()
    this.repository = new TireShopRepository()
    await this.repository.initialize()
    await this.loadConfig()
    console.log('TireShopBot initialized')
  }

  private async loadConfig(): Promise<TireShopConfig> {
    this.configCache = await this.repository.getConfig(this.config.id)
    await this.ensureNormalizedPrices()
    const envTarget = (process.env.TIRE_BOT_TARGET_NUMBER || '').trim()
    if (envTarget && !this.configCache.targetNumber) {
      this.configCache = await this.repository.updateConfig(this.config.id, {
        targetNumber: envTarget,
      })
    }
    return this.configCache
  }

  async getConfig(): Promise<TireShopConfig> {
    if (!this.configCache) {
      await this.loadConfig()
    }
    return this.configCache as TireShopConfig
  }

  async updateConfig(update: Partial<TireShopConfig>): Promise<TireShopConfig> {
    const updated = await this.repository.updateConfig(this.config.id, update)
    this.configCache = updated
    return updated
  }

  getConfigPassword(): string | null {
    const password =
      process.env.TIRE_BOT_CONFIG_PASSWORD || process.env.BOT_CONFIG_PASSWORD
    return password ? password.trim() : null
  }

  normalizeSize(input: string): string {
    return input.replace(/\s+/g, '').replace(/-/g, '/').toUpperCase()
  }

  extractSize(input: string): string | null {
    const normalized = input
      .replace(/\s+/g, '')
      .replace(/-/g, '/')
      .toUpperCase()
    const fullMatch = normalized.match(/\d{2,3}\/\d{2}(?:R|\/)\d{2}/)
    if (fullMatch) {
      return fullMatch[0]
    }
    const simpleMatch = normalized.match(/\b\d{2,3}\b/)
    if (simpleMatch) {
      return simpleMatch[0]
    }
    return null
  }

  isSizeCandidate(input: string): boolean {
    return Boolean(this.extractSize(input))
  }

  formatPrice(value: number): string {
    return value.toFixed(2)
  }

  formatBrandList(size: string, brands: Record<string, number>): string {
    const entries = Object.entries(brands).sort((a, b) =>
      a[0].localeCompare(b[0]),
    )
    const lines = entries.map(
      ([brand, price], index) =>
        `${index + 1}) ${brand} - R$ ${this.formatPrice(price)}`,
    )
    return [
      `✅ Tamanho ${size} encontrado. Escolha uma marca:`,
      ...lines,
      '',
      '👉 Responda com o número ou o nome da marca.',
    ].join('\n')
  }

  resolveBrandSelection(
    input: string,
    brands: Record<string, number>,
  ): { brand: string; price: number } | null {
    const entries = Object.entries(brands).sort((a, b) =>
      a[0].localeCompare(b[0]),
    )
    const trimmed = input.trim()
    const numeric = Number(trimmed)
    if (!Number.isNaN(numeric) && Number.isInteger(numeric)) {
      const index = numeric - 1
      if (index >= 0 && index < entries.length) {
        const [brand, price] = entries[index]
        return { brand, price }
      }
    }

    const lowered = trimmed.toLowerCase()
    for (const [brand, price] of entries) {
      if (brand.toLowerCase() === lowered) {
        return { brand, price }
      }
    }

    return null
  }

  buildOrderMessage(
    context: MessageContext,
    size: string,
    brand: string,
    price: number,
  ): string {
    return [
      '🛞 Novo interesse em pneus:',
      `👤 Cliente: ${context.name || 'Não informado'}`,
      `📱 WhatsApp: ${context.identifier}`,
      `📏 Tamanho: ${size}`,
      `🏷️ Marca: ${brand}`,
      `💰 Preço: R$ ${this.formatPrice(price)}`,
    ].join('\n')
  }

  getConfigHelpMessage(): string {
    return [
      '⚙️ Modo de configuração ativo.',
      '',
      '📌 Comandos:',
      'listar',
      'listar <tamanho>',
      'numero <telefone>',
      'marca <tamanho> <marca> <valor>',
      'remover <tamanho>',
      'removermarca <tamanho> <marca>',
      'sair',
    ].join('\n')
  }

  private normalizePrices(prices: TireShopPriceTable | undefined): {
    prices: Record<string, Record<string, number>>
    changed: boolean
  } {
    const normalized: Record<string, Record<string, number>> = {}
    let changed = false

    if (!prices) {
      return { prices: normalized, changed }
    }

    for (const [size, entry] of Object.entries(prices)) {
      if (typeof entry === 'number') {
        normalized[size] = { [this.legacyBrandName]: entry }
        changed = true
        continue
      }

      normalized[size] = { ...entry }
    }

    return { prices: normalized, changed }
  }

  private async ensureNormalizedPrices(): Promise<void> {
    if (!this.configCache) return
    const { prices, changed } = this.normalizePrices(this.configCache.prices)
    if (changed) {
      this.configCache = await this.repository.updateConfig(this.config.id, {
        prices,
      })
    } else {
      this.configCache = { ...this.configCache, prices }
    }
  }

  getPriceTable(
    config?: TireShopConfig,
  ): Record<string, Record<string, number>> {
    const source = config?.prices ?? this.configCache?.prices
    return this.normalizePrices(source).prices
  }

  async handleConfigCommand(
    context: MessageContext,
  ): Promise<ConfigCommandResult> {
    const text = context.message.trim()
    const lowered = text.toLowerCase()

    if (lowered.startsWith('!config')) {
      const password = this.getConfigPassword()
      const provided = text.split(/\s+/)[1] || ''

      if (!password) {
        return {
          handled: true,
          response: {
            message:
              '⚠️ Senha de configuração não definida. Ajuste no .env e reinicie.',
          },
        }
      }

      if (provided !== password) {
        return {
          handled: true,
          response: {
            message: '❌ Senha inválida. Tente novamente.',
          },
        }
      }

      return {
        handled: true,
        response: {
          message: this.getConfigHelpMessage(),
          updateSessionData: { configMode: true },
        },
      }
    }

    if (!context.sessionData?.configMode) {
      return { handled: false }
    }

    if (lowered === 'sair') {
      return {
        handled: true,
        response: {
          message: '✅ Modo de configuração encerrado.',
          updateSessionData: { configMode: false },
        },
      }
    }

    if (lowered === 'ajuda' || lowered === 'help') {
      return {
        handled: true,
        response: {
          message: this.getConfigHelpMessage(),
          updateSessionData: { configMode: true },
        },
      }
    }

    if (lowered.startsWith('listar')) {
      const targetSizeRaw = text.slice('listar'.length).trim()
      const config = await this.getConfig()
      const { prices } = this.normalizePrices(config.prices)
      const sizes = Object.keys(prices).sort()
      const targetLine = config.targetNumber
        ? `Numero destino: ${config.targetNumber}`
        : 'Numero destino: não configurado'

      if (targetSizeRaw) {
        const size = this.normalizeSize(targetSizeRaw)
        const brands = prices[size]
        if (!brands || Object.keys(brands).length === 0) {
          return {
            handled: true,
            response: {
              message: `⚠️ Nenhuma marca configurada para ${size}. Cadastre com o comando marca.`,
              updateSessionData: { configMode: true },
            },
          }
        }

        const lines = Object.keys(brands)
          .sort()
          .map((brand) => `${brand} - R$ ${this.formatPrice(brands[brand])}`)
        return {
          handled: true,
          response: {
            message: [`Marcas para ${size}:`, ...lines].join('\n'),
            updateSessionData: { configMode: true },
          },
        }
      }

      const lines = sizes.length
        ? sizes.map(
            (size) => `${size} (${Object.keys(prices[size]).length} marcas)`,
          )
        : ['⚠️ Nenhum tamanho configurado ainda.']
      return {
        handled: true,
        response: {
          message: [targetLine, '', ...lines].join('\n'),
          updateSessionData: { configMode: true },
        },
      }
    }

    if (lowered.startsWith('numero ')) {
      const target = text.slice('numero '.length).trim()
      const normalized = target.replace(/\D/g, '')
      if (!target || !normalized) {
        return {
          handled: true,
          response: {
            message: '☎️ Informe o número no formato 55DDDNUMERO.',
            updateSessionData: { configMode: true },
          },
        }
      }

      await this.updateConfig({ targetNumber: normalized })
      return {
        handled: true,
        response: {
          message: `✅ Número de destino atualizado para: ${normalized}`,
          updateSessionData: { configMode: true },
        },
      }
    }

    if (lowered.startsWith('marca ')) {
      const payload = text.slice('marca '.length).trim()
      const parts = payload.split(/\s+/)
      if (parts.length < 3) {
        return {
          handled: true,
          response: {
            message: 'ℹ️ Use: marca <tamanho> <marca> <valor>',
            updateSessionData: { configMode: true },
          },
        }
      }

      const size = this.normalizeSize(parts[0])
      const priceRaw = parts[parts.length - 1]
      const brand = parts.slice(1, -1).join(' ')
      const price = Number(priceRaw.replace(',', '.'))
      if (!size || !brand || Number.isNaN(price)) {
        return {
          handled: true,
          response: {
            message: '❌ Tamanho, marca ou valor inválido.',
            updateSessionData: { configMode: true },
          },
        }
      }

      const config = await this.getConfig()
      const { prices } = this.normalizePrices(config.prices)
      const brands = { ...(prices[size] || {}) }
      brands[brand] = price
      await this.updateConfig({
        prices: {
          ...prices,
          [size]: brands,
        },
      })
      return {
        handled: true,
        response: {
          message: `✅ Marca atualizada: ${size} - ${brand} = R$ ${this.formatPrice(price)}`,
          updateSessionData: { configMode: true },
        },
      }
    }

    if (lowered.startsWith('remover ')) {
      const size = this.normalizeSize(text.slice('remover '.length).trim())
      if (!size) {
        return {
          handled: true,
          response: {
            message: 'ℹ️ Use: remover <tamanho>',
            updateSessionData: { configMode: true },
          },
        }
      }

      const config = await this.getConfig()
      const { prices } = this.normalizePrices(config.prices)
      if (!(size in prices)) {
        return {
          handled: true,
          response: {
            message: `⚠️ Tamanho não encontrado: ${size}`,
            updateSessionData: { configMode: true },
          },
        }
      }

      delete prices[size]
      await this.updateConfig({ prices })
      return {
        handled: true,
        response: {
          message: `✅ Tamanho removido: ${size}`,
          updateSessionData: { configMode: true },
        },
      }
    }

    if (lowered.startsWith('removermarca ')) {
      const payload = text.slice('removermarca '.length).trim()
      const parts = payload.split(/\s+/)
      if (parts.length < 2) {
        return {
          handled: true,
          response: {
            message: 'ℹ️ Use: removermarca <tamanho> <marca>',
            updateSessionData: { configMode: true },
          },
        }
      }

      const size = this.normalizeSize(parts[0])
      const brand = parts.slice(1).join(' ')
      const config = await this.getConfig()
      const { prices } = this.normalizePrices(config.prices)
      const brands = { ...(prices[size] || {}) }

      const brandKey = Object.keys(brands).find(
        (key) => key.toLowerCase() === brand.toLowerCase(),
      )
      if (!brandKey || !(brandKey in brands)) {
        return {
          handled: true,
          response: {
            message: `⚠️ Marca não encontrada para ${size}: ${brand}`,
            updateSessionData: { configMode: true },
          },
        }
      }

      delete brands[brandKey]
      const updatedPrices = { ...prices }
      if (Object.keys(brands).length === 0) {
        delete updatedPrices[size]
      } else {
        updatedPrices[size] = brands
      }

      await this.updateConfig({ prices: updatedPrices })
      return {
        handled: true,
        response: {
          message: `✅ Marca removida: ${size} - ${brand}`,
          updateSessionData: { configMode: true },
        },
      }
    }

    return {
      handled: true,
      response: {
        message: this.getConfigHelpMessage(),
        updateSessionData: { configMode: true },
      },
    }
  }
}

class TireShopMainStage implements IBotStage {
  readonly stageNumber = 0
  readonly description = 'Atendimento principal e configuracao'

  constructor(private bot: TireShopBot) {}

  async execute(context: MessageContext): Promise<StageResponse> {
    const configResult = await this.bot.handleConfigCommand(context)
    if (configResult.handled) {
      return configResult.response as StageResponse
    }

    const text = context.message.trim()
    const awaitingSize = Boolean(context.sessionData?.awaitingSize)
    const awaitingBrandSize = context.sessionData?.awaitingBrandSize as
      | string
      | undefined
    const config = await this.bot.getConfig()
    const prices = this.bot.getPriceTable(config)

    if (awaitingBrandSize) {
      const targetSize = this.bot.normalizeSize(awaitingBrandSize)
      const brands = prices[targetSize]

      if (!brands || Object.keys(brands).length === 0) {
        return {
          message:
            '⚠️ Não encontrei marcas para esse tamanho. Informe outro tamanho.',
          updateSessionData: {
            awaitingSize: true,
            awaitingBrandSize: undefined,
          },
        }
      }

      if (this.bot.isSizeCandidate(text)) {
        const extracted = this.bot.extractSize(text)
        const newSize = extracted
          ? this.bot.normalizeSize(extracted)
          : this.bot.normalizeSize(text)
        const newBrands = prices[newSize]
        if (!newBrands || Object.keys(newBrands).length === 0) {
          return {
            message: `⚠️ Não encontrei marcas para ${newSize}. Envie outro tamanho.`,
            updateSessionData: {
              awaitingSize: true,
              awaitingBrandSize: undefined,
            },
          }
        }

        return {
          message: this.bot.formatBrandList(newSize, newBrands),
          updateSessionData: {
            awaitingBrandSize: newSize,
            awaitingSize: false,
          },
        }
      }

      const selection = this.bot.resolveBrandSelection(text, brands)
      if (!selection) {
        return {
          message: this.bot.formatBrandList(targetSize, brands),
          updateSessionData: {
            awaitingBrandSize: targetSize,
            awaitingSize: false,
          },
        }
      }

      if (!config.targetNumber) {
        return {
          message:
            '⚠️ Número do atendente não configurado. Use !config senha para configurar.',
          updateSessionData: {
            awaitingBrandSize: targetSize,
            awaitingSize: false,
          },
        }
      }

      const orderMessage = this.bot.buildOrderMessage(
        context,
        targetSize,
        selection.brand,
        selection.price,
      )
      const result = await MessagingService.sendMessage({
        to: config.targetNumber,
        provider: context.provider as any,
        message: orderMessage,
        type: 'text',
      })

      if (!result.success) {
        return {
          message:
            '⚠️ Não foi possível registrar seu interesse agora. Tente novamente.',
          updateSessionData: {
            awaitingBrandSize: targetSize,
            awaitingSize: false,
          },
        }
      }

      return {
        message:
          '✅ Perfeito! Seu interesse foi registrado. Em breve entraremos em contato.',
        endSession: true,
        updateSessionData: {
          awaitingSize: false,
          awaitingBrandSize: undefined,
          lastSize: targetSize,
          lastBrand: selection.brand,
          lastPrice: selection.price,
        },
      }
    }

    if (awaitingSize && !this.bot.isSizeCandidate(text)) {
      return {
        message: '📏 Informe o tamanho do pneu (ex: 205/55R16 ou 22).',
        updateSessionData: { awaitingSize: true },
      }
    }

    if (!awaitingSize && !this.bot.isSizeCandidate(text)) {
      return {
        message: '👋 Olá! Qual o tamanho do pneu? (ex: 205/55R16 ou 22).',
        updateSessionData: { awaitingSize: true },
      }
    }

    const extractedSize = this.bot.extractSize(text)
    const size = this.bot.normalizeSize(extractedSize || text)
    const brands = prices[size]
    if (!brands || Object.keys(brands).length === 0) {
      return {
        message: `⚠️ Não encontrei marcas para ${size}. Envie outro tamanho.`,
        updateSessionData: { awaitingSize: true },
      }
    }

    if (!config.targetNumber) {
      return {
        message:
          '⚠️ Número do atendente não configurado. Use !config senha para configurar.',
        updateSessionData: { awaitingSize: true },
      }
    }

    return {
      message: this.bot.formatBrandList(size, brands),
      updateSessionData: { awaitingBrandSize: size, awaitingSize: false },
    }
  }
}
