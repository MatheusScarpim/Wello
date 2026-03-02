import { ObjectId } from 'mongodb'
import { Server as SocketIOServer } from 'socket.io'

import campaignRepository, { CampaignDocument } from '@/api/repositories/CampaignRepository'
import campaignContactRepository, { CampaignContactDocument } from '@/api/repositories/CampaignContactRepository'
import hsmTemplateRepository from '@/api/repositories/HsmTemplateRepository'
import whatsappInstanceRepository from '@/api/repositories/WhatsAppInstanceRepository'
import MessagingService from '@/core/messaging/MessagingService'
import MetaManager from '@/core/providers/MetaManager'

interface CampaignRunner {
  campaignId: string
  isRunning: boolean
  isPaused: boolean
  isCancelled: boolean
}

/**
 * Motor de disparo de campanhas
 * Gerencia execução, pausa, retomada e cancelamento
 */
export class CampaignEngine {
  private activeCampaigns: Map<string, CampaignRunner> = new Map()
  private schedulerInterval: NodeJS.Timeout | null = null
  private io: SocketIOServer | null = null

  setSocketIO(io: SocketIOServer) {
    this.io = io
  }

  /**
   * Inicia o scheduler que verifica campanhas agendadas
   */
  startScheduler(): void {
    if (this.schedulerInterval) return

    console.log('📅 Campaign scheduler iniciado')

    this.schedulerInterval = setInterval(async () => {
      try {
        const scheduledCampaigns = await campaignRepository.findScheduled()
        for (const campaign of scheduledCampaigns) {
          const id = campaign._id!.toString()
          if (!this.activeCampaigns.has(id)) {
            console.log(`📅 Iniciando campanha agendada: ${campaign.name}`)
            await campaignRepository.updateOne(
              { _id: campaign._id } as any,
              { $set: { status: 'running', startedAt: new Date(), updatedAt: new Date() } },
            )
            this.startCampaign(id)
          }
        }
      } catch (error) {
        console.error('❌ Erro no scheduler de campanhas:', error)
      }
    }, 30000) // Verifica a cada 30 segundos
  }

  /**
   * Para o scheduler
   */
  stopScheduler(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval)
      this.schedulerInterval = null
      console.log('📅 Campaign scheduler parado')
    }
  }

  /**
   * Inicia o disparo de uma campanha
   */
  async startCampaign(campaignId: string): Promise<void> {
    if (this.activeCampaigns.has(campaignId)) {
      const runner = this.activeCampaigns.get(campaignId)!
      if (runner.isPaused) {
        runner.isPaused = false
        return
      }
      console.warn(`⚠️ Campanha ${campaignId} já está em execução`)
      return
    }

    const runner: CampaignRunner = {
      campaignId,
      isRunning: true,
      isPaused: false,
      isCancelled: false,
    }

    this.activeCampaigns.set(campaignId, runner)

    // Executa em background sem bloquear
    this.runCampaign(runner).catch((error) => {
      console.error(`❌ Erro na campanha ${campaignId}:`, error)
    })
  }

  /**
   * Pausa uma campanha
   */
  pauseCampaign(campaignId: string): void {
    const runner = this.activeCampaigns.get(campaignId)
    if (runner) {
      runner.isPaused = true
      console.log(`⏸️ Campanha ${campaignId} pausada`)
    }
  }

  /**
   * Retoma uma campanha pausada
   */
  resumeCampaign(campaignId: string): void {
    const runner = this.activeCampaigns.get(campaignId)
    if (runner && runner.isPaused) {
      runner.isPaused = false
      console.log(`▶️ Campanha ${campaignId} retomada`)
      // Re-inicia o loop de execução
      this.runCampaign(runner).catch((error) => {
        console.error(`❌ Erro ao retomar campanha ${campaignId}:`, error)
      })
    } else {
      // Campanha não está no map, re-inicia do zero
      this.startCampaign(campaignId)
    }
  }

  /**
   * Cancela uma campanha
   */
  cancelCampaign(campaignId: string): void {
    const runner = this.activeCampaigns.get(campaignId)
    if (runner) {
      runner.isCancelled = true
      runner.isRunning = false
      this.activeCampaigns.delete(campaignId)
      console.log(`🚫 Campanha ${campaignId} cancelada`)
    }
  }

  /**
   * Loop principal de execução de uma campanha
   */
  private async runCampaign(runner: CampaignRunner): Promise<void> {
    const { campaignId } = runner

    try {
      const campaign = await campaignRepository.findById(campaignId)
      if (!campaign) {
        console.error(`❌ Campanha ${campaignId} não encontrada`)
        this.activeCampaigns.delete(campaignId)
        return
      }

      console.log(`🚀 Executando campanha: ${campaign.name} (${campaign.type})`)

      // Busca configuração da instância
      const instance = await whatsappInstanceRepository.findById(campaign.instanceId)

      // Loop de envio em batches
      while (runner.isRunning && !runner.isCancelled) {
        // Verifica pausa
        if (runner.isPaused) {
          console.log(`⏸️ Campanha ${campaignId} aguardando retomada...`)
          return // Sai do loop, será re-invocado no resume
        }

        // Busca próximo lote de contatos pendentes
        const pendingContacts = await campaignContactRepository.getPendingByCampaign(campaignId, 10)

        if (pendingContacts.length === 0) {
          // Todos enviados — campanha concluída
          await campaignRepository.updateOne(
            { _id: campaign._id } as any,
            { $set: { status: 'completed', completedAt: new Date(), updatedAt: new Date() } },
          )
          this.emitCampaignUpdate(campaignId, 'completed')
          console.log(`✅ Campanha concluída: ${campaign.name}`)
          break
        }

        // Envia para cada contato do lote
        for (const contact of pendingContacts) {
          if (runner.isPaused || runner.isCancelled) break

          try {
            if (campaign.type === 'official') {
              await this.sendOfficialMessage(campaign, contact, instance)
            } else {
              await this.sendUnofficialMessage(campaign, contact, instance)
            }

            // Marca como enviado
            await campaignContactRepository.updateStatus(contact._id!.toString(), 'sent', { sentAt: new Date() })
            await campaignRepository.incrementMetric(campaignId, 'sent')
          } catch (error: any) {
            console.error(`❌ Erro ao enviar para ${contact.phone}:`, error.message)
            await campaignContactRepository.updateStatus(contact._id!.toString(), 'failed', { errorMessage: error.message })
            await campaignRepository.incrementMetric(campaignId, 'failed')
          }

          // Emite progresso
          this.emitCampaignProgress(campaignId)

          // Delay entre mensagens
          if (!runner.isPaused && !runner.isCancelled) {
            await this.delay(campaign.delayMs || 3000)
          }
        }
      }
    } catch (error) {
      console.error(`❌ Erro fatal na campanha ${campaignId}:`, error)
      await campaignRepository.updateOne(
        { _id: new ObjectId(campaignId) } as any,
        { $set: { status: 'failed', completedAt: new Date(), updatedAt: new Date() } },
      )
    } finally {
      runner.isRunning = false
      this.activeCampaigns.delete(campaignId)
    }
  }

  /**
   * Envia mensagem oficial via Meta API (HSM template)
   */
  private async sendOfficialMessage(
    campaign: CampaignDocument,
    contact: CampaignContactDocument,
    instance: any,
  ): Promise<void> {
    if (!campaign.templateId) {
      throw new Error('Template HSM não definido para campanha oficial')
    }

    const template = await hsmTemplateRepository.findById(campaign.templateId)
    if (!template) {
      throw new Error(`Template ${campaign.templateId} não encontrado`)
    }

    // Monta components com variáveis substituídas
    const components: any[] = []
    const bodyComponent = template.components.find((c) => c.type === 'BODY')

    if (bodyComponent && template.variables.length > 0) {
      const parameters = template.variables.map((v) => {
        const value = contact.variables?.[v.key] || contact.variables?.[String(v.position)] || v.example || ''
        return { type: 'text', text: value }
      })

      components.push({
        type: 'body',
        parameters,
      })
    }

    const headerComponent = template.components.find((c) => c.type === 'HEADER')
    if (headerComponent?.format === 'IMAGE' && campaign.mediaUrl) {
      components.push({
        type: 'header',
        parameters: [{ type: 'image', image: { link: campaign.mediaUrl } }],
      })
    }

    // Monta config customizada para a instância
    const customConfig = instance?.metaConfig?.enabled
      ? {
          accessToken: instance.metaConfig.accessToken,
          phoneNumberId: instance.metaConfig.phoneNumberId,
          apiVersion: instance.metaConfig.apiVersion,
          baseUrl: instance.metaConfig.baseUrl,
        }
      : undefined

    await MetaManager.sendTemplate(
      contact.phone,
      template.metaTemplateName || template.name,
      components.length > 0 ? components : undefined,
      customConfig,
    )
  }

  /**
   * Envia mensagem não-oficial via WPPConnect
   */
  private async sendUnofficialMessage(
    campaign: CampaignDocument,
    contact: CampaignContactDocument,
    instance: any,
  ): Promise<void> {
    let messageText = campaign.message || ''

    // Substitui variáveis conhecidas pelos valores do contato
    if (contact.variables) {
      for (const [key, value] of Object.entries(contact.variables)) {
        messageText = messageText.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '')
      }
    }

    // Remove variáveis restantes que não foram substituídas (contato sem o dado)
    messageText = messageText.replace(/\{\{[^}]+\}\}/g, '')

    const sessionName = instance?.sessionName

    if (campaign.mediaUrl && campaign.mediaType) {
      // Envia mídia
      await MessagingService.sendMessage({
        to: contact.phone,
        provider: 'whatsapp',
        type: campaign.mediaType as any,
        mediaUrl: campaign.mediaUrl,
        caption: messageText,
        sessionName,
      })
    } else {
      // Envia texto
      await MessagingService.sendMessage({
        to: contact.phone,
        provider: 'whatsapp',
        message: messageText,
        type: 'text',
        sessionName,
      })
    }
  }

  /**
   * Emite evento de atualização de campanha via Socket.IO
   */
  private emitCampaignUpdate(campaignId: string, status: string): void {
    if (this.io) {
      this.io.emit('campaign.updated', { campaignId, status })
    }
  }

  /**
   * Emite evento de progresso de campanha via Socket.IO
   */
  private async emitCampaignProgress(campaignId: string): Promise<void> {
    if (!this.io) return

    try {
      const metrics = await campaignContactRepository.getMetricsByCampaign(campaignId)
      this.io.emit('campaign.progress', { campaignId, ...metrics })
    } catch {
      // Ignora erros de progresso
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export default new CampaignEngine()
