import operatorRepository from '@/api/repositories/OperatorRepository'
import whatsappInstanceRepository from '@/api/repositories/WhatsAppInstanceRepository'
import whitelabelRepository from '@/api/repositories/WhitelabelRepository'
import setupRoutes from '@/api/routes'
import HttpServer from '@/api/server/HttpServer'
import { ConversationService } from '@/api/services/ConversationService'
import { MessageService } from '@/api/services/MessageService'
import WebhookManager from '@/api/webhooks/WebhookManager'
import { azureStorageService } from '@/services/AzureStorageService'

import BotFactory from './bot/BotFactory'
import { MessageContext } from './bot/interfaces/IBotStage'
import DatabaseManager from './database/DatabaseManager'
import MessagingService from './messaging/MessagingService'
import { BotSessionRepository } from './repositories/BotSessionRepository'
import WhatsAppManager, { IncomingMessage } from './whatsapp/WhatsAppManager'
import WhatsAppMultiManager from './whatsapp/WhatsAppMultiManager'
import fairDistributionService from './fairDistribution/FairDistributionService'

// Verifica se esta usando modo multi-instancia
const isMultiInstanceMode = process.env.WHATSAPP_MULTI_INSTANCE === 'true'

/**
 * Classe principal da aplicação
 * Gerencia o ciclo de vida completo do sistema
 */
export class Application {
  private static instance: Application
  private messageQueue: IncomingMessage[] = []
  private isProcessingQueue: boolean = false
  private isInitialized: boolean = false
  private botSessionRepository!: BotSessionRepository
  private conversationService!: ConversationService
  private messageService!: MessageService
  private botEnabledCache: { value: boolean; lastFetch: number } = {
    value: true,
    lastFetch: 0,
  }

  private constructor() {
    // Constructor is now intentionally empty of initializations
  }

  /**
   * Entrada unificada para mensagens recebidas (WPPConnect, Meta, etc.)
   */
  public handleIncomingMessage(message: IncomingMessage): void {
    this.enqueueMessage(message)
    WebhookManager.trigger('message', message)
  }

  /**
   * Retorna a instância única da aplicação
   */
  public static getInstance(): Application {
    if (!Application.instance) {
      Application.instance = new Application()
    }
    return Application.instance
  }

  /**
   * Inicializa toda a aplicação
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️  Aplicação já está inicializada')
      return
    }

    try {
      console.log('🚀 Iniciando welloChat...')

      // 1. Conecta ao banco de dados
      await this.initializeDatabase()

      // 1.1. Inicializa repositórios após a conexão com o BD
      this.initializeRepositories()

      // 2. Inicializa Azure Storage Service (opcional)
      await this.initializeStorage()

      // 3. Registra os bots
      await this.registerBots()

      // 4. Inicia servidor HTTP/API
      await this.initializeHttpServer()

      // 5. Conecta ao WhatsApp
      await this.initializeWhatsApp()

      // 6. Configura limpeza automática
      this.setupCleanupJobs()
      fairDistributionService.start()

      this.isInitialized = true
      console.log('✅ welloChat inicializado com sucesso!')
    } catch (error) {
      console.error('❌ Erro ao inicializar aplicação:', error)
      throw error
    }
  }

  /**
   * Inicializa conexão com banco de dados
   */
  private async initializeDatabase(): Promise<void> {
    console.log('📦 Conectando ao banco de dados...')
    await DatabaseManager.connect()
  }

  /**
   * Inicializa os repositórios que dependem do banco de dados
   */
  private initializeRepositories(): void {
    this.botSessionRepository = new BotSessionRepository()
    this.conversationService = new ConversationService()
    this.messageService = new MessageService()
    console.log('🗄️  Repositórios inicializados')
  }

  /**
   * Inicializa Azure Storage Service (opcional)
   */
  private async initializeStorage(): Promise<void> {
    try {
      console.log('☁️  Inicializando Azure Storage...')
      await azureStorageService.initialize()
      console.log('✅ Azure Storage inicializado')
    } catch (error: any) {
      console.warn('⚠️  Azure Storage não configurado:', error.message)
      console.log('   Uploads de mídia não estarão disponíveis')
    }
  }

  /**
   * Registra todos os bots disponíveis
   */
  private async registerBots(): Promise<void> {
    console.log('🤖 Registrando bots...')
    console.log('⚠️ Nenhum bot registrado')
  }

  /**
   * Inicializa servidor HTTP e APIs
   */
  private async initializeHttpServer(): Promise<void> {
    console.log('🌐 Iniciando servidor HTTP...')

    // Registra rotas
    const routes = setupRoutes()
    HttpServer.registerRouters(routes)

    // Inicia servidor
    await HttpServer.start()

    console.log(`✅ Servidor HTTP rodando na porta ${HttpServer.getPort()}`)
  }

  /**
   * Inicializa WhatsApp e configura handlers
   */
  private async initializeWhatsApp(): Promise<void> {
    if (process.env.NXZAP_WPP === 'false') {
      console.log('⚠️  WhatsApp desabilitado')
      return
    }

    // Modo multi-instancia: usa WhatsAppMultiManager
    if (isMultiInstanceMode) {
      console.log('📱 Modo Multi-Instancia ativado')
      await this.initializeWhatsAppMultiInstance()
      return
    }

    // Modo single-instance (padrao)
    console.log('📱 Conectando ao WhatsApp (modo single-instance)...')

    // Configura handlers de eventos
    WhatsAppManager.on('message', (message: IncomingMessage) => {
      this.handleIncomingMessage(message)
    })

    WhatsAppManager.on('connected', () => {
      console.log('✅ WhatsApp conectado')
      WebhookManager.trigger('connection', { status: 'connected' })
    })

    WhatsAppManager.on('disconnected', () => {
      console.log('⚠️  WhatsApp desconectado')
      WebhookManager.trigger('connection', { status: 'disconnected' })
    })

    WhatsAppManager.on('stateChange', (state: string) => {
      console.log(`📱 Estado do WhatsApp: ${state}`)
      WebhookManager.trigger('status', { state })
    })

    WhatsAppManager.on('error', (error: any) => {
      console.error('❌ Erro no WhatsApp:', error)
      WebhookManager.trigger('error', { error: error.message })
    })

    // Conecta
    await WhatsAppManager.connect()
  }

  /**
   * Inicializa WhatsApp em modo multi-instancia
   */
  private async initializeWhatsAppMultiInstance(): Promise<void> {
    console.log('📱 Inicializando WhatsApp Multi-Instancia...')

    // Configura handlers de eventos para multi-instancia
    WhatsAppMultiManager.on(
      'message',
      ({ sessionName, instanceName, message }) => {
        // Adiciona info da instancia na mensagem
        const enrichedMessage = {
          ...message,
          _instanceName: instanceName,
          _sessionName: sessionName,
        }
        this.handleIncomingMessage(enrichedMessage as IncomingMessage)
      },
    )

    WhatsAppMultiManager.on('connected', ({ sessionName }) => {
      console.log(`✅ [Multi] Instancia ${sessionName} conectada`)
      WebhookManager.trigger('connection', { status: 'connected', sessionName })
    })

    WhatsAppMultiManager.on('disconnected', ({ sessionName }) => {
      console.log(`⚠️  [Multi] Instancia ${sessionName} desconectada`)
      WebhookManager.trigger('connection', {
        status: 'disconnected',
        sessionName,
      })
    })

    WhatsAppMultiManager.on('qrcode', ({ sessionName, qrCode }) => {
      console.log(`📱 [Multi] QR Code para ${sessionName}`)
      WebhookManager.trigger('qrcode', { sessionName, qrCode })
    })

    // Inicializa instancias com autoConnect=true
    // Não bloqueia - deixa o manager fazer em background
    WhatsAppMultiManager.initialize().catch((err) => {
      console.error('❌ Erro ao inicializar multi-instancias:', err)
    })

    console.log(
      '✅ WhatsApp Multi-Instancia pronto (instancias conectarao em background)',
    )
  }

  /**
   * Adiciona mensagem à fila de processamento
   */
  private enqueueMessage(message: IncomingMessage): void {
    this.messageQueue.push(message)
    this.processMessageQueue()
  }

  /**
   * Processa fila de mensagens
   */
  private async processMessageQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      return
    }

    this.isProcessingQueue = true

    try {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift()

        if (!message) {
          continue
        }

        await this.processMessage(message)
      }
    } catch (error) {
      console.error('❌ Erro ao processar fila de mensagens:', error)
    } finally {
      this.isProcessingQueue = false
    }
  }

  /**
   * Processa uma mensagem individual
   */
  private async processMessage(message: IncomingMessage): Promise<void> {
    try {
      console.log(`📨 Processando mensagem de: ${message.identifier}`)
      console.log('[Message Raw]', {
        identifier: message.identifier,
        provider: message.provider,
        type: message.type,
        message: message.message,
        idMessage: message.idMessage,
        quotedMsg: message.quotedMsg,
        identifierProvider: message.identifierProvider,
        name: message.name,
        hasMedia: Boolean(message.mediaUrl),
      })

      const instanceBotConfig = await this.getInstanceBotConfig(
        message._sessionName,
      )
      const isBotEnabled =
        instanceBotConfig?.enabled ?? (await this.isBotEnabled())

      if (isBotEnabled) {
        console.log('🔎 Bot habilitado. Conteúdo recebido:', {
          from: message.identifier,
          type: message.type,
          hasMedia: Boolean(message.mediaUrl),
        })

        console.log('🤖 Bot está ativado. Processando com o bot...')

        const conversation = await this.conversationService.createConversation({
          identifier: message.identifier,
          provider: message.provider,
          name: message.name,
          photo: message.photo,
          // Passa dados da instância do WhatsApp
          sessionName: message._sessionName,
          instanceName: message._instanceName,
        })

        await this.messageService.saveMessage({
          conversationId: conversation._id.toString(),
          message: message.message,
          type: message.type,
          direction: 'incoming',
          status: 'sent',
          messageId: message.idMessage,
          quotedMessageId: message.quotedMsg,
          mediaUrl: message.mediaUrl,
          mediaStorage: message.mediaStorage,
          from: message.identifier,
          to: message.identifierProvider,
        })

        // Verifica se a mensagem é um comando para atendimento humano
        const messageText = (message.message || '').trim()
        if (messageText.toLowerCase() === '#human') {
          console.log(
            `🗣️ Solicitação de atendimento humano para: ${message.identifier}`,
          )

          // Cria a conversa formal para o atendente
          await this.conversationService.createConversation({
            identifier: message.identifier,
            provider: message.provider,
            name: message.name,
            photo: message.photo,
            // Passa dados da instância do WhatsApp
            sessionName: message._sessionName,
            instanceName: message._instanceName,
          })

          // Envia mensagem de confirmação
          await MessagingService.sendMessage({
            to: message.identifier,
            provider: message.provider as any,
            message:
              'Você será transferido para um de nossos atendentes em breve.',
            type: 'text',
          })

          // Interrompe o processamento pelo bot
          return
        }

        // Verifica se é para processar (filtro opcional)
        if (!this.shouldProcessMessage(message)) {
          console.log('⏭️ Mensagem ignorada por filtro')
          return
        }

        // Busca ou cria sessão de bot
        const session = await this.botSessionRepository.getActiveSession(
          message.identifier,
        )

        // Define qual bot usar
        let botId =
          session?.botId || instanceBotConfig?.botId || this.getDefaultBotId()

        // Se o bot não estiver registrado, usa o bot 'chat'
        if (!BotFactory.isBotRegistered(botId)) {
          console.warn(
            `⚠️ Bot ${botId} não registrado. Usando bot 'chat' como fallback.`,
          )
          botId = 'chat'
        }

        // Cria contexto da mensagem
        const context: MessageContext = {
          conversationId: message.identifier,
          identifier: message.identifier,
          message: message.message,
          name: message.name,
          provider: message.provider,
          type: message.type,
          idMessage: message.idMessage,
          quotedMsg: message.quotedMsg,
          identifierProvider: message.identifierProvider,
          photo: message.photo,
          mediaUrl: message.mediaUrl,
          mediaStorage: message.mediaStorage,
          sessionData: session?.sessionData,
        }

        // Processa com o bot
        const response = await BotFactory.processMessage(botId, context)

        // Envia resposta
        if (response.message && !response.skipMessage) {
          await this.sendResponse(
            message.identifier,
            message.provider,
            response,
          )
        }

        console.log(`✅ Mensagem processada pelo bot: ${message.identifier}`)
      } else {
        // Lógica padrão: criar conversa para atendimento humano
        console.log(
          `🗣️ Bot desativado. Criando/atualizando conversa para: ${message.identifier}`,
        )

        const conversation = await this.conversationService.createConversation({
          identifier: message.identifier,
          provider: message.provider,
          name: message.name,
          photo: message.photo,
          // Passa dados da instância do WhatsApp
          sessionName: message._sessionName,
          instanceName: message._instanceName,
        })

        await this.messageService.saveMessage({
          conversationId: conversation._id.toString(),
          message: message.message,
          type: message.type,
          direction: 'incoming',
          status: 'sent',
          messageId: message.idMessage,
          quotedMessageId: message.quotedMsg,
          mediaUrl: message.mediaUrl,
          mediaStorage: message.mediaStorage,
          from: message.identifier,
          to: message.identifierProvider,
        })

        console.log(
          `✅ Conversa e mensagem salvas para atendimento humano: ${message.identifier}`,
        )
      }
    } catch (error) {
      console.error(
        `❌ Erro ao processar mensagem de ${message.identifier}:`,
        error,
      )

      // Envia mensagem de erro ao usuário
      await MessagingService.sendMessage({
        to: message.identifier,
        provider: message.provider as any,
        message:
          'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
        type: 'text',
      })
    }
  }

  /**
   * Envia resposta ao usuário
   */
  private async sendResponse(
    to: string,
    provider: string,
    response: any,
  ): Promise<void> {
    try {
      // Se tem lista interativa
      if (response.list) {
        await MessagingService.sendMessage({
          to,
          provider: provider as any,
          type: 'list',
          listTitle: response.list.title,
          listDescription: response.list.description,
          listButtonText: response.list.buttonText,
          listSections: response.list.sections,
        })
      }
      // Se tem botões interativos
      else if (response.buttons) {
        await MessagingService.sendMessage({
          to,
          provider: provider as any,
          type: 'buttons',
          buttonsTitle: response.buttons.title,
          buttonsDescription: response.buttons.description,
          buttons: response.buttons.buttons,
          buttonsFooter: response.buttons.footer,
        })
      }
      // Se tem localização
      else if (response.location) {
        await MessagingService.sendMessage({
          to,
          provider: provider as any,
          type: 'location',
          latitude: response.location.latitude,
          longitude: response.location.longitude,
          locationTitle: response.location.title,
          locationAddress: response.location.address,
        })
      }
      // Se tem contato
      else if (response.contact) {
        await MessagingService.sendMessage({
          to,
          provider: provider as any,
          type: 'contact',
          contactId: response.contact.contactId,
        })
      }
      // Se tem mídia
      else if (response.media) {
        const { type, url, base64, caption, filename } = response.media

        await MessagingService.sendMessage({
          to,
          provider: provider as any,
          type,
          mediaUrl: url,
          mediaBase64: base64,
          caption: caption || response.message,
          filename,
        })
      }
      // Envia texto
      else if (response.message) {
        await MessagingService.sendMessage({
          to,
          provider: provider as any,
          message: response.message,
          type: 'text',
        })
      }
    } catch (error) {
      console.error('❌ Erro ao enviar resposta:', error)
      throw error
    }
  }

  /**
   * Verifica se deve processar a mensagem
   */
  private shouldProcessMessage(message: IncomingMessage): boolean {
    // Filtro opcional de número específico (modo lite)
    if (process.env.NXZAP_LITE === 'true') {
      const allowedNumber = process.env.NXZAP_LITE_NUMBER || ''
      if (allowedNumber && message.identifier !== allowedNumber) {
        console.log('⚠️ Mensagem ignorada por NXZAP_LITE', {
          from: message.identifier,
          allowedNumber,
        })
        return false
      }
    }

    return true
  }

  /**
   * Verifica se bots estao habilitados
   */
  private async getInstanceBotConfig(
    sessionName?: string,
  ): Promise<{ enabled?: boolean; botId?: string | null } | null> {
    if (!sessionName) return null

    try {
      const instance =
        await whatsappInstanceRepository.findBySessionName(sessionName)
      if (!instance) return null

      return {
        enabled: instance.botEnabled ?? true,
        botId: instance.botId ?? null,
      }
    } catch (error) {
      return null
    }
  }

  /**
   * Verifica se bots estao habilitados
   */
  private async isBotEnabled(): Promise<boolean> {
    const envFlag = process.env.BOT_ENABLED
    const envValue =
      envFlag === 'true'
        ? true
        : envFlag === 'false'
          ? false
          : this.botEnabledCache.value

    const now = Date.now()
    if (now - this.botEnabledCache.lastFetch < 10000) {
      return this.botEnabledCache.value
    }

    try {
      const settings = await whitelabelRepository.getSettings()
      const enabled =
        typeof settings.features?.enableBots === 'boolean'
          ? settings.features.enableBots
          : envValue
      this.botEnabledCache = { value: enabled, lastFetch: now }
      return enabled
    } catch (error) {
      return envValue
    }
  }

  /**
   * Retorna o bot padrao a ser usado
   */
  private getDefaultBotId(): string {
    return process.env.BOT_IDENTIFIER || 'fornecedor-upload'
  }

  /**
   * Configura jobs de limpeza automática
   */
  private setupCleanupJobs(): void {
    // Clean expired sessions hourly
    setInterval(
      async () => {
        console.log('Cleaning expired sessions...')
        const cleaned = await this.botSessionRepository.cleanExpiredSessions()
        if (cleaned > 0) {
          console.log('Removed ' + cleaned + ' expired session(s)')
        }
      },
      60 * 60 * 1000,
    ) // 1 hour

    const awayMinutes = Number(process.env.OPERATOR_AWAY_MINUTES || 10)
    if (Number.isFinite(awayMinutes) && awayMinutes > 0) {
      setInterval(async () => {
        const cutoff = new Date(Date.now() - awayMinutes * 60 * 1000)
        const updated = await operatorRepository.markInactiveAsAway(cutoff)
        if (updated > 0) {
          console.log('Marked ' + updated + ' operator(s) as away')
        }
      }, 60 * 1000)
    }

    console.log('Cleanup jobs configured')
  }

  /**
   * Encerra a aplica��o gracefully
   */
  public async shutdown(): Promise<void> {
    console.log('Shutting down application...')

    try {
      fairDistributionService.stop()
      if (this.messageQueue.length > 0) {
        console.log('Processing pending messages: ' + this.messageQueue.length)
        await this.processMessageQueue()
      }

      if (HttpServer.getIsRunning()) {
        await HttpServer.stop()
      }

      if (WhatsAppManager.isConnected()) {
        await WhatsAppManager.disconnect()
      }

      await BotFactory.clearAll()

      if (DatabaseManager.isConnected()) {
        await DatabaseManager.disconnect()
      }

      this.isInitialized = false
      console.log('Application shut down successfully')
    } catch (error) {
      console.error('Error while shutting down application:', error)
      throw error
    }
  }

  public getStatus(): {
    initialized: boolean
    database: boolean
    whatsapp: boolean
    httpServer: boolean
    httpPort: number
    bots: string[]
    queueSize: number
  } {
    return {
      initialized: this.isInitialized,
      database: DatabaseManager.isConnected(),
      whatsapp: WhatsAppManager.isConnected(),
      httpServer: HttpServer.getIsRunning(),
      httpPort: HttpServer.getPort(),
      bots: BotFactory.getActiveBots(),
      queueSize: this.messageQueue.length,
    }
  }
}

export default Application.getInstance()
