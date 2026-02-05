import { Request, Response } from 'express'

import { ContactService } from '../services/ContactService'
import { ConversationService } from '../services/ConversationService'
import { BaseController } from './BaseController'

export class ContactController extends BaseController {
  private contactService: ContactService
  private conversationService: ConversationService

  constructor() {
    super()
    this.contactService = new ContactService()
    this.conversationService = new ConversationService()
  }

  public list = this.asyncHandler(async (req: Request, res: Response) => {
    const pagination = this.getPagination(req)
    const search = this.getQueryParam(req, 'search')
    const provider = this.getQueryParam(req, 'provider')

    const result = await this.contactService.listContacts({
      page: pagination.page,
      limit: pagination.limit,
      search,
      provider,
    })

    this.sendSuccess(res, result, 'Contatos recuperados com sucesso')
  })

  public create = this.asyncHandler(async (req: Request, res: Response) => {
    const { identifier, provider, name, customName, tags } = req.body

    if (!identifier || !provider) {
      return this.sendError(
        res,
        'Identificador e provedor sao obrigatorios',
        400,
      )
    }

    try {
      const contact = await this.contactService.createContact({
        identifier,
        provider,
        name,
        customName,
        tags,
      })

      this.sendSuccess(res, contact, 'Contato criado com sucesso', 201)
    } catch (error) {
      if (error instanceof Error) {
        return this.sendError(res, error.message, 400)
      }
      return this.sendError(res, 'Erro ao criar contato', 500)
    }
  })

  public getById = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    if (!id) {
      return this.sendError(res, 'ID do contato e obrigatorio', 400)
    }

    const contact = await this.contactService.getContactById(id)

    if (!contact) {
      return this.sendError(res, 'Contato nao encontrado', 404)
    }

    this.sendSuccess(res, contact, 'Contato recuperado com sucesso')
  })

  public update = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const { customName, tags } = req.body

    if (!id) {
      return this.sendError(res, 'ID do contato e obrigatorio', 400)
    }

    const updated = await this.contactService.updateContact(id, {
      customName,
      tags,
    })

    if (!updated) {
      return this.sendError(
        res,
        'Contato nao encontrado ou nao atualizado',
        404,
      )
    }

    const contact = await this.contactService.getContactById(id)

    if (contact) {
      const conversation =
        await this.conversationService.getConversationOpen(
          contact.identifier,
          contact.provider,
        )

      if (conversation) {
        const conversationUpdates: Record<string, unknown> = {}

        if (customName !== undefined) {
          const nextName =
            typeof customName === 'string' ? customName.trim() : ''
          conversationUpdates.name =
            nextName || contact.name || contact.identifier
        }

        if (tags !== undefined) {
          conversationUpdates.tags = contact.tags || []
        }

        if (conversation.operatorId) {
          conversationUpdates.operatorId = conversation.operatorId
        }

        if (Object.keys(conversationUpdates).length > 0) {
          await this.conversationService.updateConversation(
            conversation._id.toString(),
            conversationUpdates,
          )
        }
      }
    }

    this.sendSuccess(res, contact, 'Contato atualizado com sucesso')
  })

  public delete = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    if (!id) {
      return this.sendError(res, 'ID do contato e obrigatorio', 400)
    }

    const contact = await this.contactService.getContactById(id)

    if (!contact) {
      return this.sendError(res, 'Contato nao encontrado', 404)
    }

    const deleted = await this.contactService.deleteContact(id)

    if (!deleted) {
      return this.sendError(res, 'Erro ao deletar contato', 500)
    }

    this.sendSuccess(res, null, 'Contato deletado com sucesso')
  })

  public checkConversation = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params

      if (!id) {
        return this.sendError(res, 'ID do contato e obrigatorio', 400)
      }

      const contact = await this.contactService.getContactById(id)

      if (!contact) {
        return this.sendError(res, 'Contato nao encontrado', 404)
      }

      // Buscar conversa aberta (nao arquivada e nao finalizada) para este contato
      const conversation = await this.conversationService.getConversationOpen(
        contact.identifier,
        contact.provider,
      )

      if (conversation) {
        this.sendSuccess(
          res,
          {
            exists: true,
            conversationId: conversation._id.toString(),
            status: conversation.status,
            operatorId: conversation.operatorId || null,
            operatorName: conversation.operatorName || null,
            archived: conversation.archived,
          },
          'Conversa encontrada',
        )
      } else {
        // Nao existe conversa ativa
        this.sendSuccess(
          res,
          {
            exists: false,
            conversationId: null,
            status: null,
            operatorId: null,
            operatorName: null,
            archived: null,
          },
          'Nenhuma conversa ativa encontrada',
        )
      }
    },
  )
}
