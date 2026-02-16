import { Request, Response } from 'express'

import MessagingService, {
  SendMessageParams,
} from '@/core/messaging/MessagingService'

import { MessageService } from '../services/MessageService'
import { BaseController } from './BaseController'

/**
 * Controller para gerenciamento de mensagens
 */
export class MessageController extends BaseController {
  private messageService: MessageService

  constructor() {
    super()
    this.messageService = new MessageService()
  }

  /**
   * Lista mensagens de uma conversa
   * GET /api/messages?conversationId=xxx ou GET /api/messages?identifier=xxx&provider=whatsapp
   */
  public getMessages = this.asyncHandler(
    async (req: Request, res: Response) => {
      let conversationId = this.getQueryParam(req, 'conversationId')
      const identifier = this.getQueryParam(req, 'identifier')
      const provider = this.getQueryParam(req, 'provider') || 'whatsapp'

      // Se não tiver conversationId, mas tiver identifier, busca a conversa
      if (!conversationId && identifier) {
        try {
          const conversation =
            await this.messageService.getOrCreateConversation(
              identifier,
              provider,
            )
          conversationId = conversation._id.toString()
        } catch (error: any) {
          return this.sendError(
            res,
            'Erro ao buscar conversa',
            500,
            error.message,
          )
        }
      }

      if (!conversationId) {
        return this.sendError(
          res,
          'conversationId ou identifier é obrigatório',
          400,
        )
      }

      const { page, limit } = this.getPagination(req)

      const messages = await this.messageService.getMessagesByConversation(
        conversationId,
        page,
        limit,
      )

      this.sendSuccess(res, messages, 'Mensagens recuperadas com sucesso')
    },
  )

  /**
   * Envia uma mensagem
   * POST /api/messages/send
   *
   * Body:
   * - to: número destinatário
   * - message: texto da mensagem
   * - provider: 'whatsapp' | 'meta_whatsapp' (default: 'whatsapp')
   * - type: 'text' | 'image' | 'list' | 'buttons' | etc
   * - async: boolean (default: false) - se true, responde imediatamente sem aguardar envio
   * - metaAccessToken: token Meta (opcional, usa ENV se não fornecido)
   * - metaPhoneNumberId: phone number ID Meta (opcional, usa ENV se não fornecido)
   * - ... outros campos opcionais
   */
  public sendMessage = this.asyncHandler(
    async (req: Request, res: Response) => {
      const validation = this.validateRequiredFields(req.body, ['to'])

      if (!validation.valid) {
        return this.sendError(res, 'Campos obrigatórios faltando', 400, {
          missing: validation.missing,
        })
      }

      const {
        to,
        message,
        provider = 'whatsapp', // Padrão é whatsapp
        type = 'text',
        async = false, // Modo assíncrono - responde imediatamente
        mediaUrl,
        mediaBase64,
        caption,
        filename,
        quotedMessageId,
        // Listas
        listTitle,
        listDescription,
        listButtonText,
        listSections,
        // Botões
        buttonsTitle,
        buttonsDescription,
        buttons,
        buttonsFooter,
        // Localização
        latitude,
        longitude,
        locationTitle,
        locationAddress,
        // Contato
        contactId,
        operatorName,
        // Credenciais Meta (opcionais - usa ENV se não fornecido)
        metaAccessToken,
        metaPhoneNumberId,
        metaApiVersion,
        metaBaseUrl,
        instagramAccessToken,
        instagramAccountId,
        instagramApiVersion,
        instagramBaseUrl,
      } = req.body
      const normalizedProvider =
        provider === 'meta' ? 'meta_whatsapp' : provider

      // Se tiver quotedMessageId, busca o messageId original do WhatsApp
      let whatsappQuotedMessageId: string | undefined
      if (quotedMessageId) {
        try {
          const quotedMessage =
            await this.messageService.getMessageById(quotedMessageId)
          if (quotedMessage?.messageId) {
            whatsappQuotedMessageId = quotedMessage.messageId
            console.log(
              `📎 Reply: MongoDB _id=${quotedMessageId} -> WhatsApp messageId=${whatsappQuotedMessageId}`,
            )
          } else {
            console.warn(
              `⚠️ Mensagem citada não encontrada ou sem messageId: ${quotedMessageId}`,
            )
          }
        } catch (error) {
          console.error(
            `❌ Erro ao buscar mensagem citada: ${quotedMessageId}`,
            error,
          )
        }
      }

      const params = {
        to,
        provider: normalizedProvider,
        message,
        type,
        mediaUrl,
        mediaBase64,
        caption,
        filename,
        quotedMessageId: whatsappQuotedMessageId,
        listTitle,
        listDescription,
        listButtonText,
        listSections,
        buttonsTitle,
        buttonsDescription,
        buttons,
        buttonsFooter,
        latitude,
        longitude,
        locationTitle,
        locationAddress,
        contactId,
        operatorName,
        metaAccessToken,
        metaPhoneNumberId,
        metaApiVersion,
        metaBaseUrl,
        instagramAccessToken,
        instagramAccountId,
        instagramApiVersion,
        instagramBaseUrl,
        mediaStorage: req.body.mediaStorage,
      }

      // Modo assíncrono: responde imediatamente e processa em background
      if (async) {
        // Inicia o envio em background
        this.sendMessageAsync(
          params,
          to,
          message,
          caption,
          type,
          quotedMessageId,
        ).catch((error) => {
          console.error('❌ Erro no envio assíncrono:', error)
        })

        // Responde imediatamente
        return this.sendSuccess(
          res,
          {
            queued: true,
            to,
            provider: normalizedProvider,
            type,
          },
          'Mensagem enfileirada para envio',
        )
      }

      // Modo síncrono: aguarda o envio completar
      const messagingParams = this.buildMessagingParams(params)

      try {
        // Busca a conversa para obter o sessionName (instância do WhatsApp)
        const conversation = await this.messageService.getOrCreateConversation(
          to,
          normalizedProvider,
        )
        if (conversation?.sessionName) {
          messagingParams.sessionName = conversation.sessionName
          console.log(`📱 Usando instância: ${conversation.sessionName}`)
        }

        console.log(`📤 Enviando mensagem para ${to} via ${normalizedProvider}...`)
        const result = await MessagingService.sendMessage(messagingParams)

        if (!result.success) {
          console.error(`❌ Falha ao enviar mensagem para ${to}:`, result.error)
          return this.sendError(
            res,
            result.error || 'Erro ao enviar mensagem',
            500,
          )
        }

        console.log(
          `✅ Mensagem enviada com sucesso para ${to}, messageId:`,
          result.messageId,
        )

        // Salva mensagem no banco (usa a conversa já buscada acima)
        try {
          await this.messageService.saveMessage({
            conversationId: conversation._id.toString(),
            message: message || caption || '',
            type,
            direction: 'outgoing',
            status: 'sent',
            messageId: result.messageId,
            quotedMessageId, // Salva o _id do MongoDB para poder buscar a mensagem citada
            from: undefined,
            to,
            operatorId: conversation.operatorId || req.user?.userId,
            operatorName: conversation.operatorName || params.operatorName,
            mediaUrl: params.mediaUrl,
            mediaStorage: params.mediaStorage,
          })
          console.log(`✅ Mensagem salva no banco para ${to}`)
        } catch (saveError: any) {
          console.error(
            `❌ ERRO ao salvar mensagem no banco para ${to}:`,
            saveError,
          )
          // Não retorna erro para o usuário, pois a mensagem foi enviada
          // mas loga o erro para investigação
        }

        this.sendSuccess(res, result, 'Mensagem enviada com sucesso')
      } catch (error: any) {
        console.error('❌ Erro ao enviar mensagem:', error)
        this.sendError(res, 'Erro ao enviar mensagem', 500, error.message)
      }
    },
  )

  /**
   * Processa envio de mensagem de forma assíncrona
   */
  private async sendMessageAsync(
    params: any,
    to: string,
    message: string,
    caption: string,
    type: string,
    originalQuotedMessageId?: string, // _id do MongoDB para salvar no banco
  ): Promise<void> {
    try {
      console.log(`📤 Enviando mensagem assíncrona para ${to}...`)

      // Busca ou cria a conversa ANTES de enviar para obter o sessionName
      const conversation = await this.messageService.getOrCreateConversation(
        to,
        params.provider,
      )

      const messagingParams = this.buildMessagingParams(
        params as SendMessageParams,
      )

      // Usa a instância correta do WhatsApp
      if (conversation?.sessionName) {
        messagingParams.sessionName = conversation.sessionName
        console.log(`📱 Usando instância (async): ${conversation.sessionName}`)
      }

      const result = await MessagingService.sendMessage(messagingParams)

      if (result.success) {
        console.log(
          `✅ Mensagem enviada com sucesso para ${to}, messageId:`,
          result.messageId,
        )

        try {
          await this.messageService.saveMessage({
            conversationId: conversation._id.toString(),
            message: message || caption || '',
            type,
            direction: 'outgoing',
            status: 'sent',
            messageId: result.messageId,
            quotedMessageId: originalQuotedMessageId, // Salva o _id do MongoDB
            from: undefined,
            to,
            operatorId: conversation.operatorId,
            operatorName: conversation.operatorName || params.operatorName,
            mediaUrl: params.mediaUrl,
            mediaStorage: params.mediaStorage,
          })
          console.log(`✅ Mensagem salva no banco para ${to}`)
        } catch (saveError: any) {
          console.error(
            `❌ ERRO ao salvar mensagem no banco para ${to}:`,
            saveError,
          )
        }
      } else {
        console.error(`❌ Falha ao enviar mensagem para ${to}:`, result.error)

        try {
          await this.messageService.saveMessage({
            conversationId: conversation._id.toString(),
            message: message || caption || '',
            type,
            direction: 'outgoing',
            status: 'failed',
            quotedMessageId: originalQuotedMessageId, // Salva o _id do MongoDB
            from: undefined,
            to,
            operatorId: conversation.operatorId,
            operatorName: conversation.operatorName || params.operatorName,
            mediaUrl: params.mediaUrl,
            mediaStorage: params.mediaStorage,
          })
          console.log(`✅ Mensagem falhada salva no banco para ${to}`)
        } catch (saveError: any) {
          console.error(
            `❌ ERRO ao salvar mensagem falhada no banco para ${to}:`,
            saveError,
          )
        }
      }
    } catch (error: any) {
      console.error(`❌ Erro crítico no envio assíncrono para ${to}:`, error)

      try {
        const conversation = await this.messageService.getOrCreateConversation(
          to,
          params.provider,
        )
        await this.messageService.saveMessage({
          conversationId: conversation._id.toString(),
          message: message || caption || '',
          type,
          direction: 'outgoing',
          status: 'failed',
          from: undefined,
          to,
          operatorId: conversation.operatorId,
          operatorName: conversation.operatorName || params.operatorName,
          mediaUrl: params.mediaUrl,
          mediaStorage: params.mediaStorage,
        })
        console.log(`✅ Mensagem de erro salva no banco para ${to}`)
      } catch (saveError) {
        console.error('❌ Erro ao salvar mensagem falhada no banco:', saveError)
      }
    }
  }

  private buildMessagingParams(params: SendMessageParams): SendMessageParams {
    const messagingParams: SendMessageParams = { ...params }

    if (params.operatorName && params.type === 'text') {
      const baseMessage = params.message ?? ''
      messagingParams.message = `*${params.operatorName}*\n${baseMessage}`
    }

    return messagingParams
  }

  /**
   * Cria uma nota interna na conversa (visível apenas para a equipe)
   * POST /api/messages/note
   */
  public sendNote = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { conversationId, message } = req.body

      if (!conversationId || !message?.trim()) {
        return this.sendError(
          res,
          'conversationId e message são obrigatórios',
          400,
        )
      }

      try {
        const note = await this.messageService.saveNote({
          conversationId,
          message: message.trim(),
          operatorId: req.user?.userId,
          operatorName: req.user?.email?.split('@')[0] || undefined,
        })

        this.sendSuccess(res, note, 'Nota interna criada com sucesso')
      } catch (error: any) {
        console.error('❌ Erro ao criar nota interna:', error)
        this.sendError(res, 'Erro ao criar nota interna', 500, error.message)
      }
    },
  )

  /**
   * Marca mensagem como lida
   * PATCH /api/messages/:id/read
   */
  public markAsRead = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    if (!id) {
      return this.sendError(res, 'ID da mensagem é obrigatório', 400)
    }

    const marked = await this.messageService.markAsRead(id)

    if (!marked) {
      return this.sendError(res, 'Mensagem não encontrada', 404)
    }

    this.sendSuccess(res, null, 'Mensagem marcada como lida')
  })

  /**
   * Busca mensagem por ID
   * GET /api/messages/:id
   */
  public getMessage = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    if (!id) {
      return this.sendError(res, 'ID da mensagem é obrigatório', 400)
    }

    const message = await this.messageService.getMessageById(id)

    if (!message) {
      return this.sendError(res, 'Mensagem não encontrada', 404)
    }

    this.sendSuccess(res, message, 'Mensagem encontrada')
  })

  /**
   * Baixa arquivo/mídia de uma mensagem
   * GET /api/messages/:id/media
   */
  public getMedia = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    if (!id) {
      return this.sendError(res, 'ID da mensagem é obrigatório', 400)
    }

    const media = await this.messageService.getMessageMedia(id)

    if (!media) {
      return this.sendError(res, 'Mídia não encontrada', 404)
    }

    this.sendSuccess(res, media, 'Mídia recuperada')
  })

  /**
   * Deleta uma mensagem
   * DELETE /api/messages/:id
   */
  public deleteMessage = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params

      if (!id) {
        return this.sendError(res, 'ID da mensagem é obrigatório', 400)
      }

      const deleted = await this.messageService.deleteMessage(id)

      if (!deleted) {
        return this.sendError(res, 'Mensagem não encontrada', 404)
      }

      this.sendSuccess(res, null, 'Mensagem deletada com sucesso')
    },
  )
}
