import axios from 'axios'
import { Request, Response } from 'express'

import hsmTemplateRepository from '../repositories/HsmTemplateRepository'
import whatsappInstanceRepository from '../repositories/WhatsAppInstanceRepository'
import { BaseController } from './BaseController'

class HsmTemplateController extends BaseController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { page, limit } = this.getPagination(req)
      const status = this.getQueryParam(req, 'status')
      const category = this.getQueryParam(req, 'category')
      const instanceId = this.getQueryParam(req, 'instanceId')

      const filter: any = {}
      if (status) filter.status = status
      if (category) filter.category = category
      if (instanceId) filter.instanceId = instanceId

      const result = await hsmTemplateRepository.paginate(filter, page, limit, { sort: { updatedAt: -1 } } as any)
      this.sendSuccess(res, result)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const template = await hsmTemplateRepository.findById(req.params.id)
      if (!template) {
        this.sendError(res, 'Template não encontrado', 404)
        return
      }
      this.sendSuccess(res, template)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const { name, category, language, components, variables, instanceId, wabaId } = req.body
      const validation = this.validateRequiredFields(req.body, ['name', 'category', 'language'])
      if (!validation.valid) {
        this.sendError(res, `Campos obrigatórios: ${validation.missing?.join(', ')}`)
        return
      }

      const template = await hsmTemplateRepository.create({
        name,
        category,
        language: language || 'pt_BR',
        components: components || [],
        status: 'draft',
        variables: variables || [],
        instanceId,
        wabaId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      this.sendSuccess(res, template, 'Template criado com sucesso', 201)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const template = await hsmTemplateRepository.findById(req.params.id)
      if (!template) {
        this.sendError(res, 'Template não encontrado', 404)
        return
      }

      const { name, category, language, components, variables, instanceId, wabaId } = req.body
      const updateData: any = { updatedAt: new Date() }
      if (name !== undefined) updateData.name = name
      if (category !== undefined) updateData.category = category
      if (language !== undefined) updateData.language = language
      if (components !== undefined) updateData.components = components
      if (variables !== undefined) updateData.variables = variables
      if (instanceId !== undefined) updateData.instanceId = instanceId
      if (wabaId !== undefined) updateData.wabaId = wabaId

      await hsmTemplateRepository.updateOne(
        { _id: template._id } as any,
        { $set: updateData },
      )

      const updated = await hsmTemplateRepository.findById(req.params.id)
      this.sendSuccess(res, updated, 'Template atualizado com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const template = await hsmTemplateRepository.findById(req.params.id)
      if (!template) {
        this.sendError(res, 'Template não encontrado', 404)
        return
      }

      await hsmTemplateRepository.deleteOne({ _id: template._id } as any)
      this.sendSuccess(res, null, 'Template removido com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async syncFromMeta(req: Request, res: Response): Promise<void> {
    try {
      const { instanceId } = req.params
      const instance = await whatsappInstanceRepository.findById(instanceId)

      if (!instance) {
        this.sendError(res, 'Instância não encontrada', 404)
        return
      }

      if (instance.connectionType !== 'meta_official' || !instance.metaConfig?.enabled) {
        this.sendError(res, 'Instância não é do tipo Meta Official', 400)
        return
      }

      const { accessToken, apiVersion } = instance.metaConfig as any
      const wabaId = (instance.metaConfig as any).wabaId || req.body.wabaId

      if (!wabaId) {
        this.sendError(res, 'wabaId é obrigatório para sincronizar templates', 400)
        return
      }

      const version = apiVersion || 'v17.0'
      const response = await axios.get(
        `https://graph.facebook.com/${version}/${wabaId}/message_templates`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { limit: 100 },
        },
      )

      const metaTemplates = response.data.data || []
      let synced = 0

      for (const mt of metaTemplates) {
        const components = (mt.components || []).map((c: any) => ({
          type: c.type,
          format: c.format,
          text: c.text,
          buttons: c.buttons,
          example: c.example,
        }))

        const variables: any[] = []
        const bodyComponent = components.find((c: any) => c.type === 'BODY')
        if (bodyComponent?.text) {
          const matches = bodyComponent.text.match(/\{\{(\d+)\}\}/g) || []
          matches.forEach((m: string, i: number) => {
            variables.push({ key: m, example: '', position: i + 1 })
          })
        }

        await hsmTemplateRepository.upsertByMetaId(mt.id, {
          name: mt.name,
          metaTemplateId: mt.id,
          metaTemplateName: mt.name,
          category: mt.category?.toLowerCase() || 'marketing',
          language: mt.language || 'pt_BR',
          components,
          status: mt.status === 'APPROVED' ? 'approved' : mt.status === 'REJECTED' ? 'rejected' : 'pending',
          rejectionReason: mt.rejected_reason,
          instanceId,
          wabaId,
          variables,
        })
        synced++
      }

      this.sendSuccess(res, { synced, total: metaTemplates.length }, `${synced} templates sincronizados`)
    } catch (error: any) {
      const apiError = error?.response?.data?.error?.message || error.message
      this.sendError(res, `Erro ao sincronizar: ${apiError}`, 500)
    }
  }

  async submitToMeta(req: Request, res: Response): Promise<void> {
    try {
      const template = await hsmTemplateRepository.findById(req.params.id)
      if (!template) {
        this.sendError(res, 'Template não encontrado', 404)
        return
      }

      if (!template.instanceId) {
        this.sendError(res, 'Template não está associado a uma instância', 400)
        return
      }

      const instance = await whatsappInstanceRepository.findById(template.instanceId)
      if (!instance || instance.connectionType !== 'meta_official') {
        this.sendError(res, 'Instância Meta Official não encontrada', 404)
        return
      }

      const { accessToken, apiVersion } = instance.metaConfig as any
      const wabaId = template.wabaId || (instance.metaConfig as any).wabaId

      if (!wabaId) {
        this.sendError(res, 'wabaId é obrigatório', 400)
        return
      }

      const version = apiVersion || 'v17.0'
      const metaComponents = template.components.map((c) => {
        const comp: any = { type: c.type }
        if (c.format) comp.format = c.format
        if (c.text) comp.text = c.text
        if (c.buttons) comp.buttons = c.buttons
        if (c.example) comp.example = c.example
        return comp
      })

      const response = await axios.post(
        `https://graph.facebook.com/${version}/${wabaId}/message_templates`,
        {
          name: template.name,
          category: template.category.toUpperCase(),
          language: template.language,
          components: metaComponents,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )

      await hsmTemplateRepository.updateOne(
        { _id: template._id } as any,
        {
          $set: {
            status: 'pending',
            metaTemplateId: response.data.id,
            updatedAt: new Date(),
          },
        },
      )

      this.sendSuccess(res, { metaTemplateId: response.data.id }, 'Template enviado para aprovação')
    } catch (error: any) {
      const apiError = error?.response?.data?.error?.message || error.message
      this.sendError(res, `Erro ao submeter: ${apiError}`, 500)
    }
  }

  async deleteFromMeta(req: Request, res: Response): Promise<void> {
    try {
      const template = await hsmTemplateRepository.findById(req.params.id)
      if (!template) {
        this.sendError(res, 'Template não encontrado', 404)
        return
      }

      if (template.metaTemplateId && template.instanceId) {
        const instance = await whatsappInstanceRepository.findById(template.instanceId)
        if (instance?.connectionType === 'meta_official' && instance.metaConfig) {
          const { accessToken, apiVersion } = instance.metaConfig as any
          const wabaId = template.wabaId || (instance.metaConfig as any).wabaId
          const version = apiVersion || 'v17.0'

          if (wabaId) {
            try {
              await axios.delete(
                `https://graph.facebook.com/${version}/${wabaId}/message_templates`,
                {
                  headers: { Authorization: `Bearer ${accessToken}` },
                  params: { name: template.name },
                },
              )
            } catch (metaError: any) {
              console.warn('⚠️ Erro ao deletar template no Meta:', metaError?.response?.data?.error?.message)
            }
          }
        }
      }

      await hsmTemplateRepository.deleteOne({ _id: template._id } as any)
      this.sendSuccess(res, null, 'Template removido')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async preview(req: Request, res: Response): Promise<void> {
    try {
      const template = await hsmTemplateRepository.findById(req.params.id)
      if (!template) {
        this.sendError(res, 'Template não encontrado', 404)
        return
      }

      const { variables } = req.body || {}
      let previewText = ''

      for (const comp of template.components) {
        if (comp.text) {
          let text = comp.text
          if (variables) {
            Object.entries(variables).forEach(([key, value]) => {
              text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value as string)
            })
          }
          if (comp.type === 'HEADER') previewText += `*${text}*\n`
          else if (comp.type === 'BODY') previewText += `${text}\n`
          else if (comp.type === 'FOOTER') previewText += `\n_${text}_`
        }
      }

      this.sendSuccess(res, { preview: previewText.trim(), template })
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }
}

export default new HsmTemplateController()
