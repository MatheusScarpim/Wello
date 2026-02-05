import { Request, Response } from 'express'
import { ObjectId } from 'mongodb'

import WhatsAppMultiManager from '../../core/whatsapp/WhatsAppMultiManager'
import whatsappInstanceRepository from '../repositories/WhatsAppInstanceRepository'
import { BaseController } from './BaseController'

class WhatsAppInstanceController extends BaseController {
  /**
   * Lista todas as instâncias
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const instances = await WhatsAppMultiManager.listInstances()
      this.sendSuccess(res, instances, 'Instâncias listadas com sucesso')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Obtém uma instância específica
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      if (!ObjectId.isValid(id)) {
        this.sendError(res, 'ID inválido', 400)
        return
      }

      const instance = await whatsappInstanceRepository.findById(id)
      if (!instance) {
        this.sendError(res, 'Instância não encontrada', 404)
        return
      }

      const info = await WhatsAppMultiManager.getInstanceInfo(
        instance.sessionName,
      )
      this.sendSuccess(res, info)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Cria nova instância
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const {
        name,
        isDefault,
        autoConnect,
        webhookUrl,
        departmentIds,
        fairDistributionEnabled,
      } = req.body

      if (!name) {
        this.sendError(res, 'Nome é obrigatório', 400)
        return
      }

      const instance = await WhatsAppMultiManager.createInstance({
        name,
        isDefault,
        autoConnect,
        webhookUrl,
        departmentIds,
        fairDistributionEnabled,
      })

      this.sendSuccess(res, instance, 'Instância criada com sucesso', 201)
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Atualiza uma instância
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const {
        name,
        autoConnect,
        webhookUrl,
        departmentIds,
        fairDistributionEnabled,
        botEnabled,
        botId,
        automaticMessages,
      } = req.body

      if (!ObjectId.isValid(id)) {
        this.sendError(res, 'ID inválido', 400)
        return
      }

      const instance = await whatsappInstanceRepository.findById(id)
      if (!instance) {
        this.sendError(res, 'Instância não encontrada', 404)
        return
      }

      const updated = await whatsappInstanceRepository.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            ...(name && { name }),
            ...(autoConnect !== undefined && { autoConnect }),
            ...(webhookUrl !== undefined && { webhookUrl }),
            ...(departmentIds && { departmentIds }),
            ...(fairDistributionEnabled !== undefined && { fairDistributionEnabled }),
            ...(botEnabled !== undefined && { botEnabled }),
            ...(botId !== undefined && { botId }),
            ...(automaticMessages !== undefined && { automaticMessages }),
            updatedAt: new Date(),
          },
        },
      )

      if (updated) {
        const updatedInstance = await whatsappInstanceRepository.findById(id)
        this.sendSuccess(
          res,
          updatedInstance,
          'Instância atualizada com sucesso',
        )
      } else {
        this.sendError(res, 'Falha ao atualizar instância', 500)
      }
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Remove uma instância
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      if (!ObjectId.isValid(id)) {
        this.sendError(res, 'ID inválido', 400)
        return
      }

      const deleted = await WhatsAppMultiManager.deleteInstance(id)

      if (deleted) {
        this.sendSuccess(res, null, 'Instância removida com sucesso')
      } else {
        this.sendError(res, 'Instância não encontrada', 404)
      }
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Conecta uma instância
   */
  async connect(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      if (!ObjectId.isValid(id)) {
        this.sendError(res, 'ID inválido', 400)
        return
      }

      const instance = await whatsappInstanceRepository.findById(id)
      if (!instance) {
        this.sendError(res, 'Instância não encontrada', 404)
        return
      }

      // Primeiro tenta desconectar/limpar sessao existente
      try {
        await WhatsAppMultiManager.disconnectInstance(instance.sessionName)
      } catch (e) {
        // Ignora erros de desconexao
      }

      // Aguarda um pouco para garantir cleanup
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Agora tenta conectar
      // Não bloqueia - inicia a conexao em background
      WhatsAppMultiManager.connectInstance(instance.sessionName).catch(
        (err) => {
          console.error(`❌ Erro ao conectar ${instance.name}:`, err.message)
        },
      )

      // Retorna sucesso imediato - frontend deve fazer polling para status
      this.sendSuccess(
        res,
        {
          id: instance._id?.toString(),
          name: instance.name,
          sessionName: instance.sessionName,
          status: 'connecting',
        },
        'Conexão iniciada',
      )
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Desconecta uma instância
   */
  async disconnect(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      if (!ObjectId.isValid(id)) {
        this.sendError(res, 'ID inválido', 400)
        return
      }

      const instance = await whatsappInstanceRepository.findById(id)
      if (!instance) {
        this.sendError(res, 'Instância não encontrada', 404)
        return
      }

      await WhatsAppMultiManager.disconnectInstance(instance.sessionName)

      this.sendSuccess(res, null, 'Instância desconectada')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Obtém QR Code de uma instância
   */
  async getQrCode(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      if (!ObjectId.isValid(id)) {
        this.sendError(res, 'ID inválido', 400)
        return
      }

      const instance = await whatsappInstanceRepository.findById(id)
      if (!instance) {
        this.sendError(res, 'Instância não encontrada', 404)
        return
      }

      console.log(
        `📱 API getQrCode - Instance ID: ${id}, SessionName: ${instance.sessionName}`,
      )

      const qrCode = WhatsAppMultiManager.getQrCode(instance.sessionName)

      console.log(
        `📱 API getQrCode - QR Code encontrado: ${qrCode ? 'SIM' : 'NAO'}`,
      )

      this.sendSuccess(res, {
        qrCode,
        sessionName: instance.sessionName,
        status: instance.status,
      })
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Define instância como padrão
   */
  async setDefault(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      if (!ObjectId.isValid(id)) {
        this.sendError(res, 'ID inválido', 400)
        return
      }

      const updated = await WhatsAppMultiManager.setDefault(id)

      if (updated) {
        this.sendSuccess(res, null, 'Instância definida como padrão')
      } else {
        this.sendError(res, 'Falha ao definir como padrão', 500)
      }
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Obtém status de todas as instâncias (resumo)
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const instances = await WhatsAppMultiManager.listInstances()

      const connected = instances.filter((i) => i.connected).length
      const total = instances.length

      this.sendSuccess(res, {
        total,
        connected,
        disconnected: total - connected,
        instances: instances.map((i) => ({
          id: i.id,
          name: i.name,
          status: i.status,
          connected: i.connected,
          phoneNumber: i.phoneNumber,
          isDefault: i.isDefault,
        })),
      })
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }
}

export default new WhatsAppInstanceController()
