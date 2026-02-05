import { Request, Response } from 'express'
import { ObjectId } from 'mongodb'

import tagRepository from '../repositories/TagRepository'
import BaseController from './BaseController'

class TagController extends BaseController {
  /**
   * Lista todas as tags
   */
  async list(req: Request, res: Response) {
    try {
      const tags = await tagRepository.findAllSorted()
      this.sendSuccess(res, tags)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Cria uma nova tag
   */
  async create(req: Request, res: Response) {
    try {
      const { name, color, description } = req.body

      // Validar campos obrigatorios
      const validation = this.validateRequiredFields(req.body, [
        'name',
        'color',
      ])
      if (!validation.valid) {
        this.sendError(
          res,
          `Campos obrigatorios: ${validation.missing?.join(', ')}`,
          400,
        )
        return
      }

      // Verificar se ja existe tag com esse nome
      const existing = await tagRepository.findByName(name)
      if (existing) {
        this.sendError(res, 'Ja existe uma tag com esse nome', 400)
        return
      }

      const now = new Date()
      const tag = await tagRepository.create({
        name: name.trim(),
        color,
        description: description?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      } as any)

      this.sendSuccess(res, tag, 'Tag criada com sucesso', 201)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Atualiza uma tag existente
   */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { name, color, description } = req.body

      // Verificar se a tag existe
      const existing = await tagRepository.findById(id)
      if (!existing) {
        this.sendError(res, 'Tag não encontrada', 404)
        return
      }

      // Se estiver alterando o nome, verificar se ja existe outra tag com esse nome
      if (name && name !== existing.name) {
        const duplicateName = await tagRepository.findByName(name)
        if (duplicateName) {
          this.sendError(res, 'Ja existe uma tag com esse nome', 400)
          return
        }
      }

      const updateData: Record<string, any> = {
        updatedAt: new Date(),
      }

      if (name !== undefined) updateData.name = name.trim()
      if (color !== undefined) updateData.color = color
      if (description !== undefined)
        updateData.description = description?.trim() || null

      await tagRepository.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData },
      )

      const updated = await tagRepository.findById(id)
      this.sendSuccess(res, updated, 'Tag atualizada com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Remove uma tag
   */
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params

      // Verificar se a tag existe
      const existing = await tagRepository.findById(id)
      if (!existing) {
        this.sendError(res, 'Tag não encontrada', 404)
        return
      }

      await tagRepository.deleteOne({ _id: new ObjectId(id) } as any)
      this.sendSuccess(res, null, 'Tag removida com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }
}

export default new TagController()
