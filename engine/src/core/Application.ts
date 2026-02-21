import messageRepository from '@/api/repositories/MessageRepository'
import operatorRepository from '@/api/repositories/OperatorRepository'
import whatsappInstanceRepository from '@/api/repositories/WhatsAppInstanceRepository'
import whitelabelRepository from '@/api/repositories/WhitelabelRepository'
import setupRoutes from '@/api/routes'
import HttpServer from '@/api/server/HttpServer'
import { ConversationService } from '@/api/services/ConversationService'
import { MessageService } from '@/api/services/MessageService'
import SocketServer from '@/api/socket/SocketServer'
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
import appointmentReminderService from './scheduler/AppointmentReminderService'
import googleCalendarSyncScheduler from './scheduler/GoogleCalendarSyncScheduler'

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
      console.log('🚀 Iniciando ScarlatChat...')

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
      appointmentReminderService.start()
      googleCalendarSyncScheduler.start()

      this.isInitialized = true
      console.log('✅ ScarlatChat inicializado com sucesso!')
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
    const { DynamicBotLoader } = await import('./bot/DynamicBotLoader')
    await DynamicBotLoader.loadAllPublished()
    const count = BotFactory.getRegisteredBots().length
    if (count === 0) {
      console.log('⚠️ Nenhum bot registrado')
    } else {
      console.log(`✅ ${count} bot(s) registrado(s)`)
    }
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
      this.emitWhatsAppInstancesToAdmins()
    })

    WhatsAppMultiManager.on('disconnected', ({ sessionName }) => {
      console.log(`⚠️  [Multi] Instancia ${sessionName} desconectada`)
      WebhookManager.trigger('connection', {
        status: 'disconnected',
        sessionName,
      })
      this.emitWhatsAppInstancesToAdmins()
    })

    WhatsAppMultiManager.on('qrcode', ({ sessionName, qrCode }) => {
      console.log(`📱 [Multi] QR Code para ${sessionName}`)
      WebhookManager.trigger('qrcode', { sessionName, qrCode })
      this.emitWhatsAppInstancesToAdmins()
    })

    // === Eventos avançados do WhatsApp ===

    WhatsAppMultiManager.on('messageReaction', async (data) => {
      WebhookManager.trigger('message.reaction', data)
      // Normaliza campos do WhatsApp
      const msgId = data.msgId?._serialized || data.msgId?.id || String(data.msgId || '')
      const sender = data.sender?._serialized || data.senderId || String(data.sender || '')
      const emoji = data.reactionText || data.reaction || data.emoji || ''

      // Persistir reação no banco
      try {
        if (msgId) {
          await messageRepository.addReaction(msgId, {
            emoji,
            sender,
            timestamp: data.timestamp || Date.now(),
          })
        }
      } catch (err) {
        console.warn('⚠️ Erro ao persistir reação:', err)
      }

      // Emitir pro socket com o _id do MongoDB (que o frontend usa como chave)
      try {
        if (msgId) {
          const message = await messageRepository.findByMessageId(msgId)
          if (message) {
            SocketServer.emitReaction(
              {
                messageId: message._id?.toString(),
                emoji,
                sender,
                timestamp: data.timestamp || Date.now(),
              },
              message.conversationId || data.chatId || '',
            )
          }
        }
      } catch (err) {
        console.warn('⚠️ Erro ao emitir reação via socket:', err)
      }
    })

    WhatsAppMultiManager.on('messageEdit', (data) => {
      SocketServer.emitMessageUpdate({ type: 'edit', ...data }, data.chat || '')
      WebhookManager.trigger('message.edit', data)
    })

    WhatsAppMultiManager.on('messageRevoked', (data) => {
      SocketServer.emitMessageUpdate({ type: 'revoke', ...data }, data.chatId || '')
      WebhookManager.trigger('message.revoked', data)
    })

    WhatsAppMultiManager.on('pollResponse', (data) => {
      SocketServer.emitPollUpdate(data, data.chatId || '')
      WebhookManager.trigger('poll.response', data)
    })

    WhatsAppMultiManager.on('messageAck', (data) => {
      SocketServer.emitMessageAck(data, data.chatId || '')
    })

    WhatsAppMultiManager.on('incomingCall', (data) => {
      SocketServer.emitIncomingCall(data)
      WebhookManager.trigger('call.incoming', data)
    })

    WhatsAppMultiManager.on('presenceChanged', (data) => {
      SocketServer.emitPresenceChange(data)
    })

    WhatsAppMultiManager.on('participantsChanged', (data) => {
      WebhookManager.trigger('group.participants', data)
    })

    WhatsAppMultiManager.on('labelUpdate', (data) => {
      WebhookManager.trigger('label.update', data)
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
   * Emite lista atualizada de instancias WhatsApp para admins via WebSocket
   */
  private emitWhatsAppInstancesToAdmins(): void {
    setImmediate(async () => {
      try {
        const instances = await WhatsAppMultiManager.listInstances()
        SocketServer.emitWhatsAppInstanceUpdate({ instances })
      } catch (err) {
        console.error('❌ Erro ao emitir status das instancias via socket:', err)
      }
    })
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

      // Verifica se é resposta de confirmação de agendamento (antes de qualquer processamento)
      const messageText = (message.message || '').trim()
      const confirmReply = await appointmentReminderService.handleConfirmationReply(
        message.identifier,
        messageText,
      )
      if (confirmReply) {
        // Salva a mensagem recebida
        const confirmConvo = await this.conversationService.createConversation({
          identifier: message.identifier,
          provider: message.provider,
          name: message.name,
          photo: message.photo,
          sessionName: message._sessionName,
          instanceName: message._instanceName,
        })
        await this.messageService.saveMessage({
          conversationId: confirmConvo._id.toString(),
          message: message.message,
          type: message.type,
          direction: 'incoming',
          status: 'sent',
          messageId: message.idMessage,
          from: message.identifier,
          to: message.identifierProvider,
        })

        // Envia resposta de confirmação
        await MessagingService.sendMessage({
          to: message.identifier,
          provider: message.provider as any,
          message: confirmReply,
          type: 'text',
          sessionName: message._sessionName,
        })
        console.log(`✅ Resposta de confirmação de agendamento: ${message.identifier}`)
        return
      }

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

        // Verifica cooldown após transferência para operador
        if (!session) {
          const cooldownMinutes = parseInt(
            process.env.BOT_TRANSFER_COOLDOWN_MINUTES || '10',
            10,
          )
          const transferredSession =
            await this.botSessionRepository.getLastTransferredSession(
              message.identifier,
              cooldownMinutes,
            )

          if (transferredSession) {
            console.log(
              `⏳ Cooldown ativo (${cooldownMinutes}min) após transferência para operador: ${message.identifier}`,
            )
            // Mensagem já foi salva acima — fica visível para o operador na fila
            return
          }
        }

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

        const botConversationId = conversation._id.toString()

        // Envia mensagens intermediárias de estágios auto-executados
        if (response._previousMessages?.length) {
          for (const msg of response._previousMessages) {
            await MessagingService.sendMessage({
              to: message.identifier,
              provider: message.provider as any,
              message: msg,
              type: 'text',
              sessionName: message._sessionName,
            })
            // Salva mensagem intermediária do bot no banco
            await this.messageService.saveMessage({
              conversationId: botConversationId,
              message: msg,
              type: 'text',
              direction: 'outgoing',
              status: 'sent',
              from: 'bot',
              to: message.identifier,
            })
          }
        }

        // Envia resposta final (texto, botoes, lista, media)
        const hasContent =
          (response.message && !response.skipMessage) ||
          response.buttons ||
          response.list ||
          response.media
        if (hasContent) {
          await this.sendResponse(
            message.identifier,
            message.provider,
            response,
          )
          // Salva resposta final do bot no banco
          const botMessageText = response.buttons
            ? `*${response.buttons.title}*\n${response.buttons.description || ''}`
            : response.list
              ? `*${response.list.title}*\n${response.list.description || ''}`
              : response.media
                ? response.media.caption || response.message || ''
                : response.message || ''
          if (botMessageText) {
            await this.messageService.saveMessage({
              conversationId: botConversationId,
              message: botMessageText,
              type: response.buttons ? 'text' : response.list ? 'text' : response.media?.type || 'text',
              direction: 'outgoing',
              status: 'sent',
              from: 'bot',
              to: message.identifier,
              mediaUrl: response.media?.url,
              mediaStorage: response.media?.mediaStorage,
            })
          }
        }

        // Transferencia para atendente humano
        if (response.transferToHuman) {
          await this.handleTransferToHuman(
            message,
            response.transferDepartmentId,
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
      // Providers que nao suportam interativos (buttons/lists)
      // Apenas a API oficial Meta suporta botões/listas interativas
      const supportsInteractive = provider === 'meta_whatsapp' || provider === 'meta'

      // Se tem lista interativa
      if (response.list) {
        if (supportsInteractive) {
          await MessagingService.sendMessage({
            to,
            provider: provider as any,
            type: 'list',
            listTitle: response.list.title,
            listDescription: response.list.description,
            listButtonText: response.list.buttonText,
            listSections: response.list.sections,
          })
        } else {
          // Fallback: converte lista em texto formatado
          const fallback = this.formatListAsText(response.list)
          await MessagingService.sendMessage({
            to,
            provider: provider as any,
            type: 'text',
            message: fallback,
          })
        }
      }
      // Se tem botões interativos
      else if (response.buttons) {
        if (supportsInteractive) {
          await MessagingService.sendMessage({
            to,
            provider: provider as any,
            type: 'buttons',
            buttonsTitle: response.buttons.title,
            buttonsDescription: response.buttons.description,
            buttons: response.buttons.buttons,
            buttonsFooter: response.buttons.footer,
          })
        } else {
          // Fallback: converte botoes em texto formatado
          const fallback = this.formatButtonsAsText(response.buttons)
          await MessagingService.sendMessage({
            to,
            provider: provider as any,
            type: 'text',
            message: fallback,
          })
        }
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
   * Converte botões interativos em texto formatado (fallback para providers sem suporte)
   */
  private formatButtonsAsText(buttons: any): string {
    const lines: string[] = []
    if (buttons.title) lines.push(`*${buttons.title}*`)
    if (buttons.description) lines.push(buttons.description)
    if (buttons.buttons?.length) {
      lines.push('')
      buttons.buttons.forEach((btn: any, i: number) => {
        lines.push(`${i + 1}. ${btn.text}`)
      })
      lines.push('')
      lines.push('_Responda com o número da opção desejada._')
    }
    if (buttons.footer) lines.push(`\n${buttons.footer}`)
    return lines.join('\n')
  }

  /**
   * Converte lista interativa em texto formatado (fallback para providers sem suporte)
   */
  private formatListAsText(list: any): string {
    const lines: string[] = []
    if (list.title) lines.push(`*${list.title}*`)
    if (list.description) lines.push(list.description)
    let counter = 1
    if (list.sections?.length) {
      for (const section of list.sections) {
        lines.push('')
        if (section.title) lines.push(`*${section.title}*`)
        for (const row of section.rows || []) {
          lines.push(`${counter}. ${row.title}${row.description ? ` - ${row.description}` : ''}`)
          counter++
        }
      }
      lines.push('')
      lines.push('_Responda com o número da opção desejada._')
    }
    return lines.join('\n')
  }

  /**
   * Transfere conversa do bot para a fila de atendimento humano
   */
  private async handleTransferToHuman(
    message: any,
    departmentId?: string,
  ): Promise<void> {
    try {
      console.log(
        `🔄 Transferindo para atendente humano: ${message.identifier}`,
      )

      // Cria/atualiza a conversa para garantir que existe no banco
      const conversation = await this.conversationService.createConversation({
        identifier: message.identifier,
        provider: message.provider,
        name: message.name,
        photo: message.photo,
        sessionName: message._sessionName,
        instanceName: message._instanceName,
      })

      const conversationId = conversation._id.toString()

      // Marca sessão de bot como transferida (para cooldown)
      await this.botSessionRepository.setTransferredAt(message.identifier)

      // Remove operador e coloca na fila
      await this.conversationService.removeOperator(conversationId)

      // Se tem departamento, atribui
      if (departmentId) {
        await this.conversationService.setDepartment(conversationId, departmentId)
      }

      // Salva mensagem de sistema indicando transferencia
      await this.messageService.saveMessage({
        conversationId,
        message: departmentId
          ? 'Bot transferiu a conversa para o departamento.'
          : 'Bot transferiu a conversa para atendimento humano.',
        type: 'system',
        direction: 'outgoing',
        status: 'sent',
        from: 'system',
        to: message.identifier,
      })

      console.log(
        `✅ Conversa transferida para fila humana: ${message.identifier}`,
      )
    } catch (error) {
      console.error('❌ Erro ao transferir para atendente:', error)
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
      appointmentReminderService.stop()
      googleCalendarSyncScheduler.stop()
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
