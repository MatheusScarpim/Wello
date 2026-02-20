import { Router } from 'express'

import authRoutes from './auth.routes'
import botRoutes from './bot.routes'
import botExportRoutes from './bot-export.routes'
import contactRoutes from './contact.routes'
import conversationRoutes from './conversation.routes'
import dashboardRoutes from './dashboard.routes'
import departmentRoutes from './department.routes'
import expenseRoutes from './expense.routes'
import finalizationRoutes from './finalization.routes'
import finalizationMetricsRoutes from './finalization-metrics.routes'
import iaRoutes from './ia.routes'
import instagramRoutes from './instagram.routes'
import messageRoutes from './message.routes'
import messageMetricsRoutes from './message-metrics.routes'
import metaRoutes from './meta.routes'
import operatorRoutes from './operator.routes'
import queueRoutes from './queue.routes'
import storageRoutes from './storage.routes'
import cannedResponseRoutes from './canned-response.routes'
import tagRoutes from './tag.routes'
import webhookRoutes from './webhook.routes'
import whatsappRoutes from './whatsapp.routes'
import whatsappInstanceRoutes from './whatsapp-instance.routes'
import visualBotRoutes from './visual-bot.routes'
import whitelabelRoutes from './whitelabel.routes'
import pipelineStageRoutes from './pipeline-stage.routes'
import pipelineRoutes from './pipeline.routes'
import appointmentRoutes from './appointment.routes'
import availabilityRoutes from './availability.routes'
import serviceRoutes from './service.routes'
import professionalRoutes from './professional.routes'
import googleCalendarRoutes from './google-calendar.routes'
import whatsappFeaturesRoutes from './whatsapp-features.routes'

/**
 * Configurador central de rotas
 */
export function setupRoutes(): Array<{ path: string; router: Router }> {
  return [
    { path: '/api/auth', router: authRoutes },
    { path: '/api/conversations', router: conversationRoutes },
    { path: '/api/messages', router: messageRoutes },
    { path: '/api/bots', router: botRoutes },
    { path: '/api/bots', router: botExportRoutes },
    { path: '/api/whatsapp', router: whatsappRoutes },
    { path: '/api/whatsapp/instances', router: whatsappInstanceRoutes },
    { path: '/api/meta', router: metaRoutes },
    { path: '/api/instagram', router: instagramRoutes },
    { path: '/api/webhooks', router: webhookRoutes },
    { path: '/api/storage', router: storageRoutes },
    { path: '/api/expenses', router: expenseRoutes },
    { path: '/api/departments', router: departmentRoutes },
    { path: '/api/operators', router: operatorRoutes },
    { path: '/api/queue', router: queueRoutes },
    { path: '/api/finalizations', router: finalizationRoutes },
    { path: '/api/settings/whitelabel', router: whitelabelRoutes },
    { path: '/api/dashboard', router: dashboardRoutes },
    { path: '/api/finalization-metrics', router: finalizationMetricsRoutes },
    { path: '/api/message-metrics', router: messageMetricsRoutes },
    { path: '/api/contacts', router: contactRoutes },
    { path: '/api/ia', router: iaRoutes },
    { path: '/api/tags', router: tagRoutes },
    { path: '/api/canned-responses', router: cannedResponseRoutes },
    { path: '/api/visual-bots', router: visualBotRoutes },
    { path: '/api/pipeline-stages', router: pipelineStageRoutes },
    { path: '/api/pipeline', router: pipelineRoutes },
    { path: '/api/appointments', router: appointmentRoutes },
    { path: '/api/availability', router: availabilityRoutes },
    { path: '/api/services', router: serviceRoutes },
    { path: '/api/professionals', router: professionalRoutes },
    { path: '/api/google-calendar', router: googleCalendarRoutes },
    { path: '/api/whatsapp/features', router: whatsappFeaturesRoutes },
  ]
}

export default setupRoutes
