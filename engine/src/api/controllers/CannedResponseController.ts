import { Request, Response } from 'express'
import { ObjectId } from 'mongodb'

import cannedResponseRepository from '../repositories/CannedResponseRepository'
import BaseController from './BaseController'

class CannedResponseController extends BaseController {
  async list(req: Request, res: Response) {
    try {
      const search = this.getQueryParam(req, 'search', '')
      const departmentId = this.getQueryParam(req, 'departmentId', '')

      let results = await cannedResponseRepository.findAllSorted()

      if (departmentId) {
        results = results.filter(
          (r) => r.isGlobal || r.departmentId === departmentId,
        )
      }

      if (search) {
        const term = search.toLowerCase()
        results = results.filter(
          (r) =>
            r.title.toLowerCase().includes(term) ||
            r.shortcut.toLowerCase().includes(term) ||
            r.content.toLowerCase().includes(term),
        )
      }

      this.sendSuccess(res, results)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { shortcut, title, content, departmentId, isGlobal } = req.body

      const validation = this.validateRequiredFields(req.body, [
        'shortcut',
        'title',
        'content',
      ])
      if (!validation.valid) {
        this.sendError(
          res,
          `Campos obrigatorios: ${validation.missing?.join(', ')}`,
          400,
        )
        return
      }

      const existing = await cannedResponseRepository.findByShortcut(shortcut.trim())
      if (existing) {
        this.sendError(res, 'Ja existe uma resposta rapida com esse atalho', 400)
        return
      }

      const now = new Date()
      const doc = await cannedResponseRepository.create({
        shortcut: shortcut.trim(),
        title: title.trim(),
        content: content.trim(),
        departmentId: departmentId || undefined,
        isGlobal: isGlobal !== false,
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      } as any)

      this.sendSuccess(res, doc, 'Resposta rapida criada com sucesso', 201)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { shortcut, title, content, departmentId, isGlobal } = req.body

      const existing = await cannedResponseRepository.findById(id)
      if (!existing) {
        this.sendError(res, 'Resposta rapida nao encontrada', 404)
        return
      }

      if (shortcut && shortcut !== existing.shortcut) {
        const duplicate = await cannedResponseRepository.findByShortcut(shortcut.trim())
        if (duplicate) {
          this.sendError(res, 'Ja existe uma resposta rapida com esse atalho', 400)
          return
        }
      }

      const updateData: Record<string, any> = { updatedAt: new Date() }

      if (shortcut !== undefined) updateData.shortcut = shortcut.trim()
      if (title !== undefined) updateData.title = title.trim()
      if (content !== undefined) updateData.content = content.trim()
      if (departmentId !== undefined) updateData.departmentId = departmentId || null
      if (isGlobal !== undefined) updateData.isGlobal = isGlobal

      await cannedResponseRepository.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData },
      )

      const updated = await cannedResponseRepository.findById(id)
      this.sendSuccess(res, updated, 'Resposta rapida atualizada com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params

      const existing = await cannedResponseRepository.findById(id)
      if (!existing) {
        this.sendError(res, 'Resposta rapida nao encontrada', 404)
        return
      }

      await cannedResponseRepository.deleteOne({ _id: new ObjectId(id) } as any)
      this.sendSuccess(res, null, 'Resposta rapida removida com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }
}

export default new CannedResponseController()
