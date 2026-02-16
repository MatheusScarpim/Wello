import { Request, Response } from 'express'
import { ObjectId } from 'mongodb'

import visualBotRepository from '../repositories/VisualBotRepository'
import BaseController from './BaseController'

class VisualBotController extends BaseController {
  async list(req: Request, res: Response) {
    try {
      const search = this.getQueryParam(req, 'search', '')
      const status = this.getQueryParam(req, 'status', '')

      let results = await visualBotRepository.findAllSorted()

      if (status) {
        results = results.filter((r) => r.status === status)
      }

      if (search) {
        const term = search.toLowerCase()
        results = results.filter(
          (r) =>
            r.name.toLowerCase().includes(term) ||
            r.botId.toLowerCase().includes(term) ||
            (r.description && r.description.toLowerCase().includes(term)),
        )
      }

      this.sendSuccess(res, results)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params

      const definition = await visualBotRepository.findById(id)
      if (!definition) {
        this.sendError(res, 'Definicao de bot nao encontrada', 404)
        return
      }

      this.sendSuccess(res, definition)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { name, botId, description } = req.body

      const validation = this.validateRequiredFields(req.body, [
        'name',
        'botId',
      ])
      if (!validation.valid) {
        this.sendError(
          res,
          `Campos obrigatorios: ${validation.missing?.join(', ')}`,
          400,
        )
        return
      }

      const slug = botId
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-')
        .replace(/-+/g, '-')

      const existing = await visualBotRepository.findByBotId(slug)
      if (existing) {
        this.sendError(res, 'Ja existe um bot com esse ID', 400)
        return
      }

      const now = new Date()
      const startNodeId = `node_${new ObjectId().toHexString()}`

      const doc = await visualBotRepository.create({
        botId: slug,
        name: name.trim(),
        description: description?.trim() || '',
        status: 'draft',
        nodes: [
          {
            id: startNodeId,
            type: 'start',
            position: { x: 250, y: 50 },
            data: {},
            label: 'Inicio',
          },
        ],
        edges: [],
        initialNodeId: startNodeId,
        sessionTimeout: 1440,
        enableAnalytics: true,
        createdAt: now,
        updatedAt: now,
      } as any)

      this.sendSuccess(res, doc, 'Bot visual criado com sucesso', 201)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { name, description, nodes, edges, viewport, sessionTimeout, enableAnalytics } =
        req.body

      const existing = await visualBotRepository.findById(id)
      if (!existing) {
        this.sendError(res, 'Definicao de bot nao encontrada', 404)
        return
      }

      const updateData: Record<string, any> = { updatedAt: new Date() }

      if (name !== undefined) updateData.name = name.trim()
      if (description !== undefined) updateData.description = description.trim()
      if (nodes !== undefined) {
        updateData.nodes = nodes
        const startNode = nodes.find((n: any) => n.type === 'start')
        if (startNode) {
          updateData.initialNodeId = startNode.id
        }
      }
      if (edges !== undefined) updateData.edges = edges
      if (viewport !== undefined) updateData.viewport = viewport
      if (sessionTimeout !== undefined) updateData.sessionTimeout = sessionTimeout
      if (enableAnalytics !== undefined) updateData.enableAnalytics = enableAnalytics

      await visualBotRepository.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData },
      )

      const updated = await visualBotRepository.findById(id)
      this.sendSuccess(res, updated, 'Bot visual atualizado com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params

      const existing = await visualBotRepository.findById(id)
      if (!existing) {
        this.sendError(res, 'Definicao de bot nao encontrada', 404)
        return
      }

      if (existing.status === 'published') {
        const { DynamicBotLoader } = await import(
          '@/core/bot/DynamicBotLoader'
        )
        await DynamicBotLoader.unpublishBot(existing.botId)
      }

      await visualBotRepository.deleteOne({ _id: new ObjectId(id) } as any)
      this.sendSuccess(res, null, 'Bot visual removido com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async publish(req: Request, res: Response) {
    try {
      const { id } = req.params

      const existing = await visualBotRepository.findById(id)
      if (!existing) {
        this.sendError(res, 'Definicao de bot nao encontrada', 404)
        return
      }

      if (existing.status === 'published') {
        this.sendError(res, 'Bot ja esta publicado', 400)
        return
      }

      const startNode = existing.nodes.find((n) => n.type === 'start')
      if (!startNode) {
        this.sendError(res, 'Bot precisa ter um no de inicio (Start)', 400)
        return
      }

      if (existing.nodes.length < 2) {
        this.sendError(
          res,
          'Bot precisa ter pelo menos 2 nos para ser publicado',
          400,
        )
        return
      }

      const now = new Date()
      await visualBotRepository.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'published', publishedAt: now, updatedAt: now } },
      )

      const { DynamicBotLoader } = await import('@/core/bot/DynamicBotLoader')
      await DynamicBotLoader.publishBot(existing.botId)

      const updated = await visualBotRepository.findById(id)
      this.sendSuccess(res, updated, 'Bot publicado com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async unpublish(req: Request, res: Response) {
    try {
      const { id } = req.params

      const existing = await visualBotRepository.findById(id)
      if (!existing) {
        this.sendError(res, 'Definicao de bot nao encontrada', 404)
        return
      }

      if (existing.status !== 'published') {
        this.sendError(res, 'Bot nao esta publicado', 400)
        return
      }

      const now = new Date()
      await visualBotRepository.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'draft', updatedAt: now } },
      )

      const { DynamicBotLoader } = await import('@/core/bot/DynamicBotLoader')
      await DynamicBotLoader.unpublishBot(existing.botId)

      const updated = await visualBotRepository.findById(id)
      this.sendSuccess(res, updated, 'Bot despublicado com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async duplicate(req: Request, res: Response) {
    try {
      const { id } = req.params

      const existing = await visualBotRepository.findById(id)
      if (!existing) {
        this.sendError(res, 'Definicao de bot nao encontrada', 404)
        return
      }

      const now = new Date()
      const newBotId = `${existing.botId}-copy-${Date.now()}`

      const doc = await visualBotRepository.create({
        botId: newBotId,
        name: `${existing.name} (Copia)`,
        description: existing.description,
        status: 'draft',
        nodes: existing.nodes,
        edges: existing.edges,
        initialNodeId: existing.initialNodeId,
        sessionTimeout: existing.sessionTimeout,
        enableAnalytics: existing.enableAnalytics,
        viewport: existing.viewport,
        createdAt: now,
        updatedAt: now,
      } as any)

      this.sendSuccess(res, doc, 'Bot duplicado com sucesso', 201)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async test(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { message, sessionData } = req.body

      if (!message) {
        this.sendError(res, 'Campo message e obrigatorio', 400)
        return
      }

      const existing = await visualBotRepository.findById(id)
      if (!existing) {
        this.sendError(res, 'Definicao de bot nao encontrada', 404)
        return
      }

      const { DynamicBot } = await import('@/core/bot/DynamicBot')

      const bot = new DynamicBot(existing as any)
      await bot.initialize()

      const currentSessionData = sessionData || {}
      const currentStage = currentSessionData._currentStage ?? undefined

      const context = {
        conversationId: `test_${id}`,
        identifier: 'test-user',
        message,
        name: 'Test User',
        provider: 'test',
        type: 'text',
        idMessage: `test_msg_${Date.now()}`,
        sessionData: currentSessionData,
      }

      // Determinar qual stage executar
      let stageNumber: number
      if (currentStage !== undefined) {
        stageNumber = currentStage
      } else {
        stageNumber = bot.config.initialStage || 0
      }

      const stage = bot.getStage(stageNumber)
      if (!stage) {
        this.sendSuccess(res, {
          response: { message: 'Fluxo finalizado', endSession: true },
          sessionData: currentSessionData,
        })
        return
      }

      // Validar input se necessario
      if (stage.validate) {
        const validationResult = await stage.validate(message, context)
        if (!validationResult.isValid) {
          this.sendSuccess(res, {
            response: {
              message:
                validationResult.error ||
                'Entrada invalida. Tente novamente.',
            },
            sessionData: currentSessionData,
          })
          return
        }
      }

      const response = await stage.execute(context)

      // Atualizar sessionData de teste
      const newSessionData = {
        ...currentSessionData,
        ...(response.updateSessionData || {}),
      }

      if (response.nextStage !== undefined) {
        newSessionData._currentStage = response.nextStage
      } else if (!response.endSession) {
        newSessionData._currentStage = stageNumber
      }

      if (response.endSession) {
        delete newSessionData._currentStage
      }

      // Se o nextStage aponta para um no que nao precisa de input (send_message, set_variable, condition, delay),
      // executar automaticamente ate chegar em um no que precisa de input ou end
      let chainedMessages: any[] = []
      if (response.message || response.buttons || response.list || response.media) {
        chainedMessages.push({
          message: response.message,
          buttons: response.buttons,
          list: response.list,
          media: response.media,
        })
      }

      let currentResponse = response
      while (
        currentResponse.nextStage !== undefined &&
        !currentResponse.endSession &&
        !newSessionData._awaitingInput
      ) {
        const nextStage = bot.getStage(currentResponse.nextStage)
        if (!nextStage) break

        const nextNodeType = (nextStage as any).node?.type
        // Se o proximo no precisa de input, parar a cadeia
        if (
          nextNodeType === 'ask_question' ||
          nextNodeType === 'buttons' ||
          nextNodeType === 'list'
        ) {
          // Executar para enviar a pergunta/botoes
          const nextCtx = { ...context, sessionData: newSessionData }
          const nextResponse = await nextStage.execute(nextCtx)

          if (nextResponse.updateSessionData) {
            Object.assign(newSessionData, nextResponse.updateSessionData)
          }
          if (nextResponse.nextStage !== undefined) {
            newSessionData._currentStage = nextResponse.nextStage
          } else {
            newSessionData._currentStage = currentResponse.nextStage
          }

          if (nextResponse.message || nextResponse.buttons || nextResponse.list || nextResponse.media) {
            chainedMessages.push({
              message: nextResponse.message,
              buttons: nextResponse.buttons,
              list: nextResponse.list,
              media: nextResponse.media,
            })
          }
          break
        }

        // Executar nos auto-executaveis (send_message, set_variable, condition, delay)
        const nextCtx = { ...context, sessionData: newSessionData }
        const nextResponse = await nextStage.execute(nextCtx)

        if (nextResponse.updateSessionData) {
          Object.assign(newSessionData, nextResponse.updateSessionData)
        }

        if (nextResponse.message || nextResponse.buttons || nextResponse.list || nextResponse.media) {
          chainedMessages.push({
            message: nextResponse.message,
            buttons: nextResponse.buttons,
            list: nextResponse.list,
            media: nextResponse.media,
          })
        }

        if (nextResponse.endSession) {
          delete newSessionData._currentStage
          currentResponse = nextResponse
          break
        }

        if (nextResponse.nextStage !== undefined) {
          newSessionData._currentStage = nextResponse.nextStage
          currentResponse = nextResponse
        } else {
          break
        }
      }

      this.sendSuccess(res, {
        responses: chainedMessages,
        sessionData: newSessionData,
        endSession: currentResponse.endSession || false,
      })
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }
}

export default new VisualBotController()
