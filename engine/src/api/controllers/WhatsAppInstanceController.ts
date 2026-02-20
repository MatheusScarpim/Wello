import { Request, Response } from 'express'
import { ObjectId } from 'mongodb'

import InstagramManager from '../../core/providers/InstagramManager'
import MetaManager from '../../core/providers/MetaManager'
import WhatsAppMultiManager from '../../core/whatsapp/WhatsAppMultiManager'
import whatsappInstanceRepository from '../repositories/WhatsAppInstanceRepository'
import { ConversationService } from '../services/ConversationService'
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
        connectionType,
        metaConfig,
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
        connectionType,
        metaConfig,
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
        connectionType,
        metaConfig,
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
            ...(connectionType !== undefined && { connectionType }),
            ...(metaConfig !== undefined && {
              metaConfig: {
                enabled: !!metaConfig?.enabled,
                accessToken: metaConfig?.accessToken,
                phoneNumberId: metaConfig?.phoneNumberId,
                instagramAccountId: metaConfig?.instagramAccountId,
                apiVersion: metaConfig?.apiVersion || process.env.META_API_VERSION || 'v17.0',
                baseUrl:
                  metaConfig?.baseUrl || process.env.URL_META || 'https://graph.facebook.com',
              },
            }),
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

      if (instance.connectionType === 'meta_official') {
        const hasAccessToken = !!instance.metaConfig?.accessToken
        const hasWhatsAppId = !!instance.metaConfig?.phoneNumberId
        const hasInstagramId = !!instance.metaConfig?.instagramAccountId
        const configured =
          !!instance.metaConfig?.enabled &&
          hasAccessToken &&
          (hasWhatsAppId || hasInstagramId)

        if (!configured) {
          this.sendError(
            res,
            'Instancia Meta oficial sem configuracao completa (token e phoneNumberId ou instagramAccountId)',
            400,
          )
          return
        }

        let profileName = instance.profileName
        let phoneNumber = instance.phoneNumber
        let validationError: string | undefined

        if (hasWhatsAppId) {
          const validation = await MetaManager.validateCredentials({
            accessToken: instance.metaConfig?.accessToken,
            phoneNumberId: instance.metaConfig?.phoneNumberId,
            apiVersion: instance.metaConfig?.apiVersion,
            baseUrl: instance.metaConfig?.baseUrl,
          })
          if (!validation.valid) {
            validationError = validation.error || 'erro desconhecido'
          } else {
            profileName = validation.verifiedName || profileName
            phoneNumber = validation.displayPhoneNumber || phoneNumber
          }
        } else if (hasInstagramId) {
          const validation = await InstagramManager.validateCredentials({
            accessToken: instance.metaConfig?.accessToken,
            instagramAccountId: instance.metaConfig?.instagramAccountId,
            apiVersion: instance.metaConfig?.apiVersion,
            baseUrl: instance.metaConfig?.baseUrl,
          })
          if (!validation.valid) {
            validationError = validation.error || 'erro desconhecido'
          } else {
            profileName = validation.username || profileName
          }
        }

        if (validationError) {
          this.sendError(
            res,
            `Falha ao validar credenciais da Meta: ${validationError}`,
            400,
          )
          return
        }

        await whatsappInstanceRepository.updateStatus(instance.sessionName, 'connected', {
          phoneNumber,
          profileName,
        })
        this.sendSuccess(
          res,
          {
            id: instance._id?.toString(),
            name: instance.name,
            sessionName: instance.sessionName,
            status: 'connected',
          },
          'Instancia Meta oficial configurada',
        )
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
        this.sendError(res, 'ID invalido', 400)
        return
      }

      const instance = await whatsappInstanceRepository.findById(id)
      if (!instance) {
        this.sendError(res, 'Instancia nao encontrada', 404)
        return
      }

      if (instance.connectionType === 'meta_official') {
        await whatsappInstanceRepository.updateStatus(instance.sessionName, 'disconnected')
        this.sendSuccess(res, null, 'Instancia Meta oficial marcada como desconectada')
        return
      }

      await WhatsAppMultiManager.disconnectInstance(instance.sessionName)

      this.sendSuccess(res, null, 'Instancia desconectada')
    } catch (error) {
      this.sendInternalError(res, error as Error)
    }
  }

  /**
   * Obtem QR Code de uma instancia
   */
  async getQrCode(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      if (!ObjectId.isValid(id)) {
        this.sendError(res, 'ID invalido', 400)
        return
      }

      const instance = await whatsappInstanceRepository.findById(id)
      if (!instance) {
        this.sendError(res, 'Instancia nao encontrada', 404)
        return
      }

      if (instance.connectionType === 'meta_official') {
        this.sendSuccess(res, {
          qrCode: null,
          sessionName: instance.sessionName,
          status: instance.status,
        })
        return
      }

      console.log('API getQrCode - Instance ID: ' + id + ', SessionName: ' + instance.sessionName)

      const qrCode = WhatsAppMultiManager.getQrCode(instance.sessionName)

      console.log('API getQrCode - QR Code encontrado: ' + (qrCode ? 'SIM' : 'NAO'))

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
   * Transfere conversas de uma instância para outra
   */
  async transferConversations(req: Request, res: Response): Promise<void> {
    try {
      const { sourceInstanceId, targetInstanceId, filter } = req.body

      if (!sourceInstanceId || !targetInstanceId) {
        this.sendError(
          res,
          'sourceInstanceId e targetInstanceId são obrigatórios',
          400,
        )
        return
      }

      if (sourceInstanceId === targetInstanceId) {
        this.sendError(
          res,
          'Instância de origem e destino não podem ser iguais',
          400,
        )
        return
      }

      if (
        !ObjectId.isValid(sourceInstanceId) ||
        !ObjectId.isValid(targetInstanceId)
      ) {
        this.sendError(res, 'IDs inválidos', 400)
        return
      }

      const conversationService = new ConversationService()
      const result =
        await conversationService.transferConversationsToInstance({
          sourceInstanceId,
          targetInstanceId,
          filter: filter || { mode: 'all' },
        })

      this.sendSuccess(
        res,
        result,
        `${result.transferred} conversas transferidas com sucesso`,
      )
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
