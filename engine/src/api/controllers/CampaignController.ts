import { Request, Response } from 'express'
import { ObjectId } from 'mongodb'

import campaignRepository from '../repositories/CampaignRepository'
import campaignContactRepository from '../repositories/CampaignContactRepository'
import hsmTemplateRepository from '../repositories/HsmTemplateRepository'
import contactRepository from '../repositories/ContactRepository'
import { BaseController } from './BaseController'

class CampaignController extends BaseController {
  private campaignEngine: any = null

  setCampaignEngine(engine: any) {
    this.campaignEngine = engine
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const { page, limit } = this.getPagination(req)
      const status = this.getQueryParam(req, 'status')
      const type = this.getQueryParam(req, 'type')

      const filter: any = {}
      if (status) filter.status = status
      if (type) filter.type = type

      const result = await campaignRepository.paginate(filter, page, limit, { sort: { createdAt: -1 } } as any)
      this.sendSuccess(res, result)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const campaign = await campaignRepository.findById(req.params.id)
      if (!campaign) {
        this.sendError(res, 'Campanha não encontrada', 404)
        return
      }

      const metrics = await campaignContactRepository.getMetricsByCampaign(campaign._id!.toString())
      this.sendSuccess(res, { ...campaign, metrics })
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, type, instanceId, instanceName, templateId, message, mediaUrl, mediaType, tags, contactListType, contactIds, delayMs, importedContacts } = req.body

      const validation = this.validateRequiredFields(req.body, ['name', 'type', 'instanceId'])
      if (!validation.valid) {
        this.sendError(res, `Campos obrigatórios: ${validation.missing?.join(', ')}`)
        return
      }

      const campaign = await campaignRepository.create({
        name,
        description,
        type,
        status: 'draft',
        instanceId,
        instanceName,
        templateId,
        message,
        mediaUrl,
        mediaType,
        tags: tags || [],
        contactListType: contactListType || 'manual',
        contactIds: contactIds || [],
        importedContacts: importedContacts || undefined,
        delayMs: delayMs || 3000,
        totalContacts: 0,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        createdBy: (req as any).user?.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      this.sendSuccess(res, campaign, 'Campanha criada com sucesso', 201)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const campaign = await campaignRepository.findById(req.params.id)
      if (!campaign) {
        this.sendError(res, 'Campanha não encontrada', 404)
        return
      }

      if (!['draft', 'scheduled'].includes(campaign.status)) {
        this.sendError(res, 'Apenas campanhas em rascunho ou agendadas podem ser editadas')
        return
      }

      const allowedFields = ['name', 'description', 'type', 'instanceId', 'instanceName', 'templateId', 'message', 'mediaUrl', 'mediaType', 'tags', 'contactListType', 'contactIds', 'importedContacts', 'delayMs']
      const updateData: any = { updatedAt: new Date() }

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) updateData[field] = req.body[field]
      }

      await campaignRepository.updateOne(
        { _id: campaign._id } as any,
        { $set: updateData },
      )

      const updated = await campaignRepository.findById(req.params.id)
      this.sendSuccess(res, updated, 'Campanha atualizada')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const campaign = await campaignRepository.findById(req.params.id)
      if (!campaign) {
        this.sendError(res, 'Campanha não encontrada', 404)
        return
      }

      if (!['draft', 'cancelled', 'completed', 'failed'].includes(campaign.status)) {
        this.sendError(res, 'Apenas campanhas em rascunho, canceladas, completas ou falhas podem ser removidas')
        return
      }

      await campaignContactRepository.deleteByCampaign(campaign._id!.toString())
      await campaignRepository.deleteOne({ _id: campaign._id } as any)
      this.sendSuccess(res, null, 'Campanha removida')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async duplicate(req: Request, res: Response): Promise<void> {
    try {
      const campaign = await campaignRepository.findById(req.params.id)
      if (!campaign) {
        this.sendError(res, 'Campanha não encontrada', 404)
        return
      }

      const newCampaign = await campaignRepository.create({
        name: `${campaign.name} (cópia)`,
        description: campaign.description,
        type: campaign.type,
        status: 'draft',
        instanceId: campaign.instanceId,
        instanceName: campaign.instanceName,
        templateId: campaign.templateId,
        message: campaign.message,
        mediaUrl: campaign.mediaUrl,
        mediaType: campaign.mediaType,
        tags: campaign.tags,
        contactListType: campaign.contactListType,
        contactIds: campaign.contactIds,
        importedContacts: campaign.importedContacts,
        delayMs: campaign.delayMs,
        totalContacts: 0,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        createdBy: (req as any).user?.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      this.sendSuccess(res, newCampaign, 'Campanha duplicada', 201)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async schedule(req: Request, res: Response): Promise<void> {
    try {
      const campaign = await campaignRepository.findById(req.params.id)
      if (!campaign) {
        this.sendError(res, 'Campanha não encontrada', 404)
        return
      }

      if (!['draft'].includes(campaign.status)) {
        this.sendError(res, 'Apenas campanhas em rascunho podem ser agendadas')
        return
      }

      const { scheduledAt } = req.body
      if (!scheduledAt) {
        this.sendError(res, 'scheduledAt é obrigatório')
        return
      }

      const scheduledDate = new Date(scheduledAt)
      if (scheduledDate <= new Date()) {
        this.sendError(res, 'Data de agendamento deve ser no futuro')
        return
      }

      // Resolve e insere contatos
      const totalContacts = await this.resolveAndInsertContacts(campaign)

      if (totalContacts === 0) {
        this.sendError(res, 'Nenhum contato encontrado para a campanha')
        return
      }

      await campaignRepository.updateOne(
        { _id: campaign._id } as any,
        { $set: { status: 'scheduled', scheduledAt: scheduledDate, totalContacts, updatedAt: new Date() } },
      )

      const updated = await campaignRepository.findById(req.params.id)
      this.sendSuccess(res, updated, 'Campanha agendada')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async start(req: Request, res: Response): Promise<void> {
    try {
      const campaign = await campaignRepository.findById(req.params.id)
      if (!campaign) {
        this.sendError(res, 'Campanha não encontrada', 404)
        return
      }

      if (!['draft', 'scheduled'].includes(campaign.status)) {
        this.sendError(res, 'Apenas campanhas em rascunho ou agendadas podem ser iniciadas')
        return
      }

      // Se ainda não tem contatos inseridos (draft direto para start)
      const existingContacts = await campaignContactRepository.count({ campaignId: campaign._id!.toString() } as any)
      let totalContacts = existingContacts

      if (existingContacts === 0) {
        totalContacts = await this.resolveAndInsertContacts(campaign)
        if (totalContacts === 0) {
          this.sendError(res, 'Nenhum contato encontrado para a campanha')
          return
        }
      }

      await campaignRepository.updateOne(
        { _id: campaign._id } as any,
        { $set: { status: 'running', startedAt: new Date(), totalContacts, updatedAt: new Date() } },
      )

      // Inicia o disparo no engine
      if (this.campaignEngine) {
        this.campaignEngine.startCampaign(campaign._id!.toString())
      }

      const updated = await campaignRepository.findById(req.params.id)
      this.sendSuccess(res, updated, 'Campanha iniciada')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async pause(req: Request, res: Response): Promise<void> {
    try {
      const campaign = await campaignRepository.findById(req.params.id)
      if (!campaign) {
        this.sendError(res, 'Campanha não encontrada', 404)
        return
      }

      if (campaign.status !== 'running') {
        this.sendError(res, 'Apenas campanhas em execução podem ser pausadas')
        return
      }

      if (this.campaignEngine) {
        this.campaignEngine.pauseCampaign(campaign._id!.toString())
      }

      await campaignRepository.updateOne(
        { _id: campaign._id } as any,
        { $set: { status: 'paused', updatedAt: new Date() } },
      )

      this.sendSuccess(res, null, 'Campanha pausada')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async resume(req: Request, res: Response): Promise<void> {
    try {
      const campaign = await campaignRepository.findById(req.params.id)
      if (!campaign) {
        this.sendError(res, 'Campanha não encontrada', 404)
        return
      }

      if (campaign.status !== 'paused') {
        this.sendError(res, 'Apenas campanhas pausadas podem ser retomadas')
        return
      }

      await campaignRepository.updateOne(
        { _id: campaign._id } as any,
        { $set: { status: 'running', updatedAt: new Date() } },
      )

      if (this.campaignEngine) {
        this.campaignEngine.resumeCampaign(campaign._id!.toString())
      }

      this.sendSuccess(res, null, 'Campanha retomada')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async cancel(req: Request, res: Response): Promise<void> {
    try {
      const campaign = await campaignRepository.findById(req.params.id)
      if (!campaign) {
        this.sendError(res, 'Campanha não encontrada', 404)
        return
      }

      if (!['running', 'paused', 'scheduled'].includes(campaign.status)) {
        this.sendError(res, 'Apenas campanhas em execução, pausadas ou agendadas podem ser canceladas')
        return
      }

      if (this.campaignEngine) {
        this.campaignEngine.cancelCampaign(campaign._id!.toString())
      }

      await campaignRepository.updateOne(
        { _id: campaign._id } as any,
        { $set: { status: 'cancelled', completedAt: new Date(), updatedAt: new Date() } },
      )

      this.sendSuccess(res, null, 'Campanha cancelada')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const campaign = await campaignRepository.findById(req.params.id)
      if (!campaign) {
        this.sendError(res, 'Campanha não encontrada', 404)
        return
      }

      const metrics = await campaignContactRepository.getMetricsByCampaign(campaign._id!.toString())
      this.sendSuccess(res, metrics)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async getContacts(req: Request, res: Response): Promise<void> {
    try {
      const campaign = await campaignRepository.findById(req.params.id)
      if (!campaign) {
        this.sendError(res, 'Campanha não encontrada', 404)
        return
      }

      const { page, limit } = this.getPagination(req)
      const status = this.getQueryParam(req, 'status')
      const result = await campaignContactRepository.findByCampaign(campaign._id!.toString(), status, page, limit)
      this.sendSuccess(res, result)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async exportContacts(req: Request, res: Response): Promise<void> {
    try {
      const campaign = await campaignRepository.findById(req.params.id)
      if (!campaign) {
        this.sendError(res, 'Campanha não encontrada', 404)
        return
      }

      const contacts = await campaignContactRepository.find({ campaignId: campaign._id!.toString() } as any)

      const csvRows = [
        'Nome,Telefone,Status,Erro,Enviado em,Entregue em,Lido em',
        ...contacts.map((c) => [
          c.name || '',
          c.phone,
          c.status,
          c.errorMessage || '',
          c.sentAt ? new Date(c.sentAt).toISOString() : '',
          c.deliveredAt ? new Date(c.deliveredAt).toISOString() : '',
          c.readAt ? new Date(c.readAt).toISOString() : '',
        ].join(',')),
      ]

      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="campanha-${campaign.name}-contatos.csv"`)
      res.send(csvRows.join('\n'))
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  // === Helper privado ===

  private async resolveAndInsertContacts(campaign: any): Promise<number> {
    const campaignId = campaign._id!.toString()

    // Limpa contatos anteriores se existirem
    await campaignContactRepository.deleteByCampaign(campaignId)

    let contacts: any[] = []

    switch (campaign.contactListType) {
      case 'all': {
        const allContacts = await contactRepository.find({} as any)
        contacts = allContacts.map((c: any) => ({
          campaignId,
          contactId: c._id?.toString(),
          phone: c.identifier || c.phone,
          name: c.name,
          status: 'pending',
          variables: { nome: c.name || '', telefone: c.identifier || c.phone || '' },
          createdAt: new Date(),
        }))
        break
      }
      case 'tags': {
        if (campaign.tags?.length) {
          const taggedContacts = await contactRepository.find({ tags: { $in: campaign.tags } } as any)
          contacts = taggedContacts.map((c: any) => ({
            campaignId,
            contactId: c._id?.toString(),
            phone: c.identifier || c.phone,
            name: c.name,
            status: 'pending',
            variables: { nome: c.name || '', telefone: c.identifier || c.phone || '' },
            createdAt: new Date(),
          }))
        }
        break
      }
      case 'manual': {
        if (campaign.contactIds?.length) {
          for (const entry of campaign.contactIds) {
            // entry pode ser um ObjectId de contato ou um número de telefone direto
            if (ObjectId.isValid(entry)) {
              const c = await contactRepository.findById(entry)
              if (c) {
                contacts.push({
                  campaignId,
                  contactId: c._id?.toString(),
                  phone: (c as any).identifier || (c as any).phone,
                  name: (c as any).name,
                  status: 'pending',
                  variables: { nome: (c as any).name || '', telefone: (c as any).identifier || (c as any).phone || '' },
                  createdAt: new Date(),
                })
              }
            } else {
              // É um número de telefone direto
              contacts.push({
                campaignId,
                phone: entry.replace(/\D/g, ''),
                name: '',
                status: 'pending',
                variables: { nome: '', telefone: entry.replace(/\D/g, '') },
                createdAt: new Date(),
              })
            }
          }
        }
        break
      }
      case 'import': {
        // Check if importedContacts array is available (spreadsheet import with names)
        if (campaign.importedContacts?.length) {
          contacts = campaign.importedContacts.map((entry: { phone: string; name: string; variables?: Record<string, string> }) => ({
            campaignId,
            phone: entry.phone.replace(/\D/g, ''),
            name: entry.name || '',
            status: 'pending',
            variables: entry.variables || { nome: entry.name || '', telefone: entry.phone.replace(/\D/g, '') },
            createdAt: new Date(),
          }))
        } else if (campaign.contactIds?.length) {
          // Fallback: contacts provided as plain phone numbers (paste mode)
          contacts = campaign.contactIds.map((phone: string) => ({
            campaignId,
            phone: phone.replace(/\D/g, ''),
            name: '',
            status: 'pending',
            variables: { nome: '', telefone: phone.replace(/\D/g, '') },
            createdAt: new Date(),
          }))
        }
        break
      }
    }

    if (contacts.length > 0) {
      await campaignContactRepository.bulkInsert(contacts as any[])
    }

    return contacts.length
  }
}

export default new CampaignController()
