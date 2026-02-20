import { Request, Response } from 'express'

import WhatsAppMultiManager from '../../core/whatsapp/WhatsAppMultiManager'
import whatsappInstanceRepository from '../repositories/WhatsAppInstanceRepository'
import { BaseController } from './BaseController'

class WhatsAppFeatureController extends BaseController {
  /**
   * Obtém o client WPPConnect a partir do sessionName
   * Retorna null se a instância não for WPPConnect
   */
  private async getWppClient(sessionName: string, res: Response) {
    if (!sessionName) {
      this.sendError(res, 'sessionName é obrigatório', 400)
      return null
    }

    const instance = await whatsappInstanceRepository.findBySessionName(sessionName)
    if (!instance) {
      this.sendError(res, 'Instância não encontrada', 404)
      return null
    }

    if (instance.connectionType === 'meta_official') {
      this.sendError(
        res,
        'Esta funcionalidade não está disponível para instâncias Meta Official',
        400,
      )
      return null
    }

    const client = WhatsAppMultiManager.getClient(sessionName)
    if (!client) {
      this.sendError(res, 'Instância não está conectada', 400)
      return null
    }

    return client
  }

  private formatRecipient(to: string): string {
    const cleaned = to.replace(/\D/g, '')
    if (cleaned.startsWith('55') && cleaned.length === 12) {
      return `55${cleaned.charAt(2)}9${cleaned.substring(3)}@c.us`
    }
    return `${cleaned}@c.us`
  }

  // ==================== REAÇÕES ====================

  /**
   * Envia reação (emoji) a uma mensagem
   * Usa page.evaluate para chamar WPP.chat.sendReactionToMessage diretamente
   * evitando problemas de serialização do MsgKey
   */
  async sendReaction(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, messageId, emoji } = req.body

      if (!messageId) {
        this.sendError(res, 'messageId é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const page = client.page
      if (!page) {
        this.sendError(res, 'Sessão WhatsApp sem página ativa', 500)
        return
      }

      const reaction = emoji === null || emoji === '' ? false : emoji
      const result = await page.evaluate(
        `(async () => {
          try {
            const msgId = ${JSON.stringify(String(messageId))};
            const reaction = ${JSON.stringify(reaction)};
            const result = await WPP.chat.sendReactionToMessage(msgId, reaction);
            return { success: true, data: result };
          } catch (err) {
            return { success: false, error: (err && err.message) || String(err) };
          }
        })()`,
      )

      const evalResult = result as { success: boolean; data?: unknown; error?: string }
      if (!evalResult.success) {
        this.sendError(res, evalResult.error || 'Erro ao enviar reação', 500)
        return
      }

      this.sendSuccess(res, evalResult.data, 'Reação enviada com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  // ==================== DIGITANDO ====================

  /**
   * Inicia indicador de "digitando..."
   */
  async startTyping(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, chatId, duration } = req.body

      if (!chatId) {
        this.sendError(res, 'chatId é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const formattedChat = this.formatRecipient(chatId)
      await client.startTyping(formattedChat, duration)

      this.sendSuccess(res, null, 'Indicador de digitação iniciado')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Para indicador de "digitando..."
   */
  async stopTyping(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, chatId } = req.body

      if (!chatId) {
        this.sendError(res, 'chatId é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const formattedChat = this.formatRecipient(chatId)
      await client.stopTyping(formattedChat)

      this.sendSuccess(res, null, 'Indicador de digitação parado')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  // ==================== MENSAGENS ====================

  /**
   * Apaga uma mensagem (para todos ou só localmente)
   */
  async deleteMessage(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, chatId, messageId, onlyLocal } = req.body

      if (!chatId || !messageId) {
        this.sendError(res, 'chatId e messageId são obrigatórios', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const page = client.page
      if (!page) {
        this.sendError(res, 'Sessão WhatsApp sem página ativa', 500)
        return
      }

      const formattedChat = this.formatRecipient(chatId)
      const result = await page.evaluate(
        `(async () => {
          try {
            const chatId = ${JSON.stringify(formattedChat)};
            const msgId = ${JSON.stringify(String(messageId))};
            const onlyLocal = ${JSON.stringify(!!onlyLocal)};
            const result = await WPP.chat.deleteMessage(chatId, msgId, onlyLocal);
            return { success: true, data: result };
          } catch (err) {
            return { success: false, error: (err && err.message) || String(err) };
          }
        })()`,
      )

      const evalResult = result as { success: boolean; data?: unknown; error?: string }
      if (!evalResult.success) {
        this.sendError(res, evalResult.error || 'Erro ao apagar mensagem', 500)
        return
      }

      this.sendSuccess(res, { deleted: evalResult.data }, 'Mensagem apagada com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Edita uma mensagem já enviada
   */
  async editMessage(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, messageId, newText } = req.body

      if (!messageId || !newText) {
        this.sendError(res, 'messageId e newText são obrigatórios', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const page = client.page
      if (!page) {
        this.sendError(res, 'Sessão WhatsApp sem página ativa', 500)
        return
      }

      const result = await page.evaluate(
        `(async () => {
          try {
            const msgId = ${JSON.stringify(String(messageId))};
            const newText = ${JSON.stringify(newText)};
            const result = await WPP.chat.editMessage(msgId, newText);
            return { success: true, data: result };
          } catch (err) {
            return { success: false, error: (err && err.message) || String(err) };
          }
        })()`,
      )

      const evalResult = result as { success: boolean; data?: unknown; error?: string }
      if (!evalResult.success) {
        this.sendError(res, evalResult.error || 'Erro ao editar mensagem', 500)
        return
      }

      this.sendSuccess(res, evalResult.data, 'Mensagem editada com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Encaminha uma mensagem para outro chat
   */
  async forwardMessage(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, messageId, toChatId } = req.body

      if (!messageId || !toChatId) {
        this.sendError(res, 'messageId e toChatId são obrigatórios', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const page = client.page
      if (!page) {
        this.sendError(res, 'Sessão WhatsApp sem página ativa', 500)
        return
      }

      const formattedTo = this.formatRecipient(toChatId)
      const result = await page.evaluate(
        `(async () => {
          try {
            const toChatId = ${JSON.stringify(formattedTo)};
            const msgId = ${JSON.stringify(String(messageId))};
            const result = await WPP.chat.forwardMessage(toChatId, msgId);
            return { success: true, data: result };
          } catch (err) {
            return { success: false, error: (err && err.message) || String(err) };
          }
        })()`,
      )

      const evalResult = result as { success: boolean; data?: unknown; error?: string }
      if (!evalResult.success) {
        this.sendError(res, evalResult.error || 'Erro ao encaminhar', 500)
        return
      }

      this.sendSuccess(res, { forwarded: evalResult.data }, 'Mensagem encaminhada com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  // ==================== LEITURA ====================

  /**
   * Marca todas as mensagens do chat como lidas
   */
  async sendSeen(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, chatId } = req.body

      if (!chatId) {
        this.sendError(res, 'chatId é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const formattedChat = this.formatRecipient(chatId)
      const result = await client.sendSeen(formattedChat)

      this.sendSuccess(res, result, 'Chat marcado como lido')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Marca chat como não lido
   */
  async markUnread(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, chatId } = req.body

      if (!chatId) {
        this.sendError(res, 'chatId é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const formattedChat = this.formatRecipient(chatId)
      const result = await client.markUnseenMessage(formattedChat)

      this.sendSuccess(res, { marked: result }, 'Chat marcado como não lido')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  // ==================== STICKERS ====================

  /**
   * Envia imagem como sticker
   */
  async sendSticker(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, to, imageBase64 } = req.body

      if (!to || !imageBase64) {
        this.sendError(res, 'to e imageBase64 são obrigatórios', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const formattedTo = this.formatRecipient(to)
      const result = await client.sendImageAsSticker(formattedTo, imageBase64)

      this.sendSuccess(res, { messageId: (result as any)?.id }, 'Sticker enviado com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Envia GIF/vídeo como sticker animado
   */
  async sendStickerGif(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, to, imageBase64 } = req.body

      if (!to || !imageBase64) {
        this.sendError(res, 'to e imageBase64 são obrigatórios', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const formattedTo = this.formatRecipient(to)
      const result = await (client as any).sendImageAsStickerGif(formattedTo, imageBase64)

      this.sendSuccess(res, { messageId: result?.id }, 'Sticker animado enviado com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  // ==================== ENQUETES ====================

  // ==================== FAVORITOS ====================

  /**
   * Marca/desmarca mensagem como favorita (estrela)
   */
  async starMessage(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, messageId, star } = req.body

      if (!messageId) {
        this.sendError(res, 'messageId é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const page = client.page
      if (!page) {
        this.sendError(res, 'Sessão WhatsApp sem página ativa', 500)
        return
      }

      const result = await page.evaluate(
        `(async () => {
          try {
            const msgId = ${JSON.stringify(String(messageId))};
            const star = ${JSON.stringify(star ?? true)};
            const result = await WPP.chat.starMessage(msgId, star);
            return { success: true, data: result };
          } catch (err) {
            return { success: false, error: (err && err.message) || String(err) };
          }
        })()`,
      )

      const evalResult = result as { success: boolean; data?: unknown; error?: string }
      if (!evalResult.success) {
        this.sendError(res, evalResult.error || 'Erro ao favoritar', 500)
        return
      }

      this.sendSuccess(res, { starred: evalResult.data }, 'Mensagem atualizada com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  // ==================== PRESENÇA ====================

  /**
   * Define status online/offline
   */
  async setOnlinePresence(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, online } = req.body

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const result = await client.setOnlinePresence(online ?? true)

      this.sendSuccess(res, { online: result }, 'Presença atualizada')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Inscreve para receber atualizações de presença de um contato
   */
  async subscribePresence(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, contactId } = req.body

      if (!contactId) {
        this.sendError(res, 'contactId é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const formattedContact = this.formatRecipient(contactId)
      await (client as any).subscribePresence(formattedContact)

      this.sendSuccess(res, null, 'Inscrito para presença do contato')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Cancela inscrição de presença de um contato
   */
  async unsubscribePresence(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, contactId } = req.body

      if (!contactId) {
        this.sendError(res, 'contactId é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const formattedContact = this.formatRecipient(contactId)
      await (client as any).unsubscribePresence(formattedContact)

      this.sendSuccess(res, null, 'Inscrição de presença cancelada')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  // ==================== STATUS/STORIES ====================

  /**
   * Posta imagem no status
   */
  async sendImageStatus(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, imageBase64, caption } = req.body

      if (!imageBase64) {
        this.sendError(res, 'imageBase64 é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      await (client as any).sendImageStatus(imageBase64, { caption })

      this.sendSuccess(res, null, 'Status de imagem publicado')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Posta vídeo no status
   */
  async sendVideoStatus(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, videoBase64, caption } = req.body

      if (!videoBase64) {
        this.sendError(res, 'videoBase64 é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      await (client as any).sendVideoStatus(videoBase64, { caption })

      this.sendSuccess(res, null, 'Status de vídeo publicado')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Posta texto no status
   */
  async sendTextStatus(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, text, backgroundColor, font } = req.body

      if (!text) {
        this.sendError(res, 'text é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      await (client as any).sendTextStatus(text, { backgroundColor, font })

      this.sendSuccess(res, null, 'Status de texto publicado')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Marca status de alguém como visto
   */
  async sendReadStatus(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, chatId, statusId } = req.body

      if (!chatId || !statusId) {
        this.sendError(res, 'chatId e statusId são obrigatórios', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      await (client as any).sendReadStatus(chatId, statusId)

      this.sendSuccess(res, null, 'Status marcado como visto')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  // ==================== CONTATOS ====================

  /**
   * Bloqueia um contato
   */
  async blockContact(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, contactId } = req.body

      if (!contactId) {
        this.sendError(res, 'contactId é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const formattedContact = this.formatRecipient(contactId)
      const result = await client.blockContact(formattedContact)

      this.sendSuccess(res, { blocked: result }, 'Contato bloqueado')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Desbloqueia um contato
   */
  async unblockContact(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, contactId } = req.body

      if (!contactId) {
        this.sendError(res, 'contactId é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const formattedContact = this.formatRecipient(contactId)
      const result = await client.unblockContact(formattedContact)

      this.sendSuccess(res, { unblocked: result }, 'Contato desbloqueado')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Obtém informações de um contato
   */
  async getContact(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, contactId } = req.body

      if (!contactId) {
        this.sendError(res, 'contactId é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const formattedContact = this.formatRecipient(contactId)
      const result = await client.getContact(formattedContact)

      this.sendSuccess(res, result, 'Contato obtido com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Verifica se um número é WhatsApp válido
   */
  async checkNumberStatus(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, contactId } = req.body

      if (!contactId) {
        this.sendError(res, 'contactId é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const formattedContact = this.formatRecipient(contactId)
      const result = await client.checkNumberStatus(formattedContact)

      this.sendSuccess(res, result, 'Status do número verificado')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Obtém último visto de um contato
   */
  async getLastSeen(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, contactId } = req.body

      if (!contactId) {
        this.sendError(res, 'contactId é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const formattedContact = this.formatRecipient(contactId)
      const result = await (client as any).getLastSeen(formattedContact)

      this.sendSuccess(res, { lastSeen: result }, 'Último visto obtido')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Verifica se contato está online
   */
  async getChatIsOnline(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, contactId } = req.body

      if (!contactId) {
        this.sendError(res, 'contactId é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const formattedContact = this.formatRecipient(contactId)
      const result = await (client as any).getChatIsOnline(formattedContact)

      this.sendSuccess(res, { online: result }, 'Status online obtido')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  // ==================== CHAT ====================

  /**
   * Arquiva/desarquiva um chat
   */
  async archiveChat(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, chatId, archive } = req.body

      if (!chatId) {
        this.sendError(res, 'chatId é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const formattedChat = this.formatRecipient(chatId)
      const result = await client.archiveChat(formattedChat, archive ?? true)

      this.sendSuccess(res, result, archive ? 'Chat arquivado' : 'Chat desarquivado')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Fixa/desfixa um chat
   */
  async pinChat(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, chatId, pin } = req.body

      if (!chatId) {
        this.sendError(res, 'chatId é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const formattedChat = this.formatRecipient(chatId)
      const result = await client.pinChat(formattedChat, pin ?? true)

      this.sendSuccess(res, result, pin ? 'Chat fixado' : 'Chat desfixado')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Apaga um chat inteiro
   */
  async deleteChat(req: Request, res: Response): Promise<void> {
    try {
      const { chatId } = req.params
      const sessionName = req.query.sessionName as string

      if (!chatId) {
        this.sendError(res, 'chatId é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const formattedChat = this.formatRecipient(chatId)
      const result = await client.deleteChat(formattedChat)

      this.sendSuccess(res, { deleted: result }, 'Chat apagado com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Limpa mensagens de um chat
   */
  async clearChat(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, chatId, keepStarred } = req.body

      if (!chatId) {
        this.sendError(res, 'chatId é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const formattedChat = this.formatRecipient(chatId)
      const result = await client.clearChat(formattedChat, keepStarred ?? false)

      this.sendSuccess(res, { cleared: result }, 'Chat limpo com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Ativa/desativa mensagens temporárias
   */
  async setDisappearing(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, chatId, enabled } = req.body

      if (!chatId) {
        this.sendError(res, 'chatId é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const formattedChat = this.formatRecipient(chatId)
      const result = await (client as any).setTemporaryMessages(
        formattedChat,
        enabled ?? true,
      )

      this.sendSuccess(
        res,
        result,
        enabled ? 'Mensagens temporárias ativadas' : 'Mensagens temporárias desativadas',
      )
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Silencia um contato
   */
  async muteContact(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, contactId, time, type } = req.body

      if (!contactId) {
        this.sendError(res, 'contactId é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const formattedContact = this.formatRecipient(contactId)
      await (client as any).sendMute(formattedContact, time || 8, type || 'hours')

      this.sendSuccess(res, null, 'Contato silenciado')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  // ==================== PERFIL ====================

  /**
   * Altera nome do perfil
   */
  async setProfileName(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, name } = req.body

      if (!name) {
        this.sendError(res, 'name é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const result = await (client as any).setProfileName(name)

      this.sendSuccess(res, result, 'Nome do perfil atualizado')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Altera foto do perfil
   */
  async setProfilePic(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, imageBase64 } = req.body

      if (!imageBase64) {
        this.sendError(res, 'imageBase64 é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const result = await (client as any).setProfilePic(imageBase64)

      this.sendSuccess(res, result, 'Foto do perfil atualizada')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Altera status/bio do perfil
   */
  async setProfileStatus(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, status } = req.body

      if (!status) {
        this.sendError(res, 'status é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      await (client as any).setProfileStatus(status)

      this.sendSuccess(res, null, 'Status do perfil atualizado')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Remove foto do perfil
   */
  async removeProfilePic(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName } = req.body

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      await (client as any).removeMyProfilePicture()

      this.sendSuccess(res, null, 'Foto do perfil removida')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  // ==================== DEVICE INFO ====================

  /**
   * Obtém informações do dispositivo
   */
  async getDeviceInfo(req: Request, res: Response): Promise<void> {
    try {
      const sessionName = req.query.sessionName as string

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const [batteryLevel, waVersion, isMultiDevice] = await Promise.allSettled([
        client.getBatteryLevel(),
        (client as any).getWAVersion(),
        (client as any).isMultiDevice(),
      ])

      this.sendSuccess(res, {
        batteryLevel: batteryLevel.status === 'fulfilled' ? batteryLevel.value : null,
        waVersion: waVersion.status === 'fulfilled' ? waVersion.value : null,
        isMultiDevice: isMultiDevice.status === 'fulfilled' ? isMultiDevice.value : null,
      })
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  // ==================== BROADCAST ====================

  /**
   * Envia mensagem em massa para múltiplos contatos
   */
  async sendBroadcast(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, contacts, message, delayMs } = req.body

      if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
        this.sendError(res, 'contacts (array não vazio) é obrigatório', 400)
        return
      }

      if (!message) {
        this.sendError(res, 'message é obrigatório', 400)
        return
      }

      const client = await this.getWppClient(sessionName, res)
      if (!client) return

      const results: Array<{ contact: string; success: boolean; error?: string }> = []
      const delay = delayMs || 2000 // 2s entre mensagens por padrão

      for (const contact of contacts) {
        try {
          const formattedTo = this.formatRecipient(contact)
          await client.sendText(formattedTo, message)
          results.push({ contact, success: true })
        } catch (err: any) {
          results.push({ contact, success: false, error: err.message })
        }

        // Delay entre mensagens para evitar ban
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }

      const sent = results.filter((r) => r.success).length
      const failed = results.filter((r) => !r.success).length

      this.sendSuccess(
        res,
        { results, sent, failed, total: contacts.length },
        `Broadcast concluído: ${sent} enviadas, ${failed} falharam`,
      )
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }
}

export default new WhatsAppFeatureController()
