/**
 * Exemplo de como integrar o sistema de webhooks no código do NxZap
 *
 * Este arquivo mostra como disparar webhooks quando eventos ocorrem
 * no sistema (mensagens recebidas, conversas criadas, etc.)
 */

import { webhookDispatcher } from '@/api/services/WebhookDispatcher'

// ============================================================================
// Exemplo 1: Disparar webhook quando mensagem é recebida
// ============================================================================

export async function onMessageReceived(message: any) {
  console.log('📨 Mensagem recebida, disparando webhooks...')

  // Dispara webhook para todos os webhooks cadastrados que escutam este evento
  const results = await webhookDispatcher.dispatch('message.received', {
    messageId: message._id?.toString(),
    conversationId: message.conversationId,
    content: message.content,
    from: message.from,
    to: message.to,
    timestamp: message.createdAt,
    type: message.type,
    metadata: message.metadata,
  })

  // Log dos resultados
  console.log(`✅ Webhooks disparados: ${results.filter(r => r.success).length} sucesso(s)`)
  console.log(`❌ Webhooks falhados: ${results.filter(r => !r.success).length} falha(s)`)
}

// ============================================================================
// Exemplo 2: Disparar webhook quando mensagem é enviada
// ============================================================================

export async function onMessageSent(message: any) {
  await webhookDispatcher.dispatch('message.sent', {
    messageId: message._id?.toString(),
    conversationId: message.conversationId,
    content: message.content,
    to: message.to,
    timestamp: new Date().toISOString(),
    status: 'sent',
  })
}

// ============================================================================
// Exemplo 3: Disparar webhook quando mensagem falha
// ============================================================================

export async function onMessageFailed(message: any, error: Error) {
  await webhookDispatcher.dispatch('message.failed', {
    messageId: message._id?.toString(),
    conversationId: message.conversationId,
    content: message.content,
    to: message.to,
    error: error.message,
    timestamp: new Date().toISOString(),
  })
}

// ============================================================================
// Exemplo 4: Disparar webhook quando conversa é criada
// ============================================================================

export async function onConversationCreated(conversation: any) {
  await webhookDispatcher.dispatch('conversation.created', {
    conversationId: conversation._id?.toString(),
    identifier: conversation.identifier,
    provider: conversation.provider,
    name: conversation.name,
    photo: conversation.photo,
    status: conversation.status,
    createdAt: conversation.createdAt,
  })
}

// ============================================================================
// Exemplo 5: Disparar webhook quando conversa é atualizada
// ============================================================================

export async function onConversationUpdated(conversation: any, changes: any) {
  await webhookDispatcher.dispatch('conversation.updated', {
    conversationId: conversation._id?.toString(),
    identifier: conversation.identifier,
    changes: changes,
    updatedAt: conversation.updatedAt,
  })
}

// ============================================================================
// Exemplo 6: Disparar webhook quando conversa é arquivada
// ============================================================================

export async function onConversationArchived(conversationId: string) {
  await webhookDispatcher.dispatch('conversation.archived', {
    conversationId,
    archivedAt: new Date().toISOString(),
  })
}

// ============================================================================
// Exemplo 7: Disparar webhook quando conversa é deletada
// ============================================================================

export async function onConversationDeleted(conversationId: string) {
  await webhookDispatcher.dispatch('conversation.deleted', {
    conversationId,
    deletedAt: new Date().toISOString(),
  })
}

// ============================================================================
// Exemplo 8: Disparar webhook quando operador é atribuído
// ============================================================================

export async function onOperatorAssigned(
  conversationId: string,
  operatorId: string,
  operatorName: string
) {
  await webhookDispatcher.dispatch('operator.assigned', {
    conversationId,
    operatorId,
    operatorName,
    assignedAt: new Date().toISOString(),
  })
}

// ============================================================================
// Exemplo 9: Disparar webhook quando operador é removido
// ============================================================================

export async function onOperatorRemoved(conversationId: string, operatorId: string) {
  await webhookDispatcher.dispatch('operator.removed', {
    conversationId,
    operatorId,
    removedAt: new Date().toISOString(),
  })
}

// ============================================================================
// Exemplo 10: Disparar webhook quando bot é iniciado
// ============================================================================

export async function onBotStarted(botId: string, botName: string) {
  await webhookDispatcher.dispatch('bot.started', {
    botId,
    botName,
    startedAt: new Date().toISOString(),
  })
}

// ============================================================================
// Exemplo 11: Disparar webhook quando bot é parado
// ============================================================================

export async function onBotStopped(botId: string, botName: string) {
  await webhookDispatcher.dispatch('bot.stopped', {
    botId,
    botName,
    stoppedAt: new Date().toISOString(),
  })
}

// ============================================================================
// Exemplo 12: Disparar múltiplos webhooks em lote
// ============================================================================

export async function processMessageBatch(messages: any[]) {
  console.log(`📦 Processando lote de ${messages.length} mensagens...`)

  // Cria array de eventos
  const events = messages.map(message => ({
    event: 'message.received',
    data: {
      messageId: message._id?.toString(),
      content: message.content,
      from: message.from,
      timestamp: message.createdAt,
    },
  }))

  // Dispara todos em lote
  const results = await webhookDispatcher.dispatchBatch(events)

  console.log(`✅ Lote processado: ${results.size} eventos`)
}

// ============================================================================
// Exemplo 13: Integração em serviço de mensagens
// ============================================================================

export class MessageServiceWithWebhooks {
  async sendMessage(conversationId: string, content: string) {
    try {
      // Envia mensagem (lógica fictícia)
      const message = await this.doSendMessage(conversationId, content)

      // Dispara webhook de sucesso
      await onMessageSent(message)

      return message
    } catch (error) {
      // Dispara webhook de falha
      await onMessageFailed({ conversationId, content }, error as Error)
      throw error
    }
  }

  private async doSendMessage(conversationId: string, content: string) {
    // Lógica de envio aqui
    return {
      _id: '123',
      conversationId,
      content,
      to: '5511999999999',
      createdAt: new Date(),
    }
  }
}

// ============================================================================
// Exemplo 14: Integração em serviço de conversas
// ============================================================================

export class ConversationServiceWithWebhooks {
  async createConversation(data: any) {
    // Cria conversa
    const conversation = await this.doCreateConversation(data)

    // Dispara webhook
    await onConversationCreated(conversation)

    return conversation
  }

  async updateConversation(id: string, updates: any) {
    // Atualiza conversa
    const conversation = await this.doUpdateConversation(id, updates)

    // Dispara webhook com as mudanças
    await onConversationUpdated(conversation, updates)

    return conversation
  }

  async archiveConversation(id: string) {
    // Arquiva conversa
    await this.doArchiveConversation(id)

    // Dispara webhook
    await onConversationArchived(id)
  }

  async assignOperator(conversationId: string, operatorId: string, operatorName: string) {
    // Atribui operador
    await this.doAssignOperator(conversationId, operatorId, operatorName)

    // Dispara webhook
    await onOperatorAssigned(conversationId, operatorId, operatorName)
  }

  // Métodos fictícios
  private async doCreateConversation(data: any) {
    return { _id: '123', ...data, createdAt: new Date() }
  }

  private async doUpdateConversation(id: string, updates: any) {
    return { _id: id, ...updates, updatedAt: new Date() }
  }

  private async doArchiveConversation(id: string) {
    // Lógica de arquivamento
  }

  private async doAssignOperator(
    conversationId: string,
    operatorId: string,
    operatorName: string
  ) {
    // Lógica de atribuição
  }
}

// ============================================================================
// Exemplo 15: Tratamento de erros ao disparar webhooks
// ============================================================================

export async function safelyDispatchWebhook(event: string, data: any) {
  try {
    const results = await webhookDispatcher.dispatch(event, data)

    // Verifica se todos falharam
    const allFailed = results.every(r => !r.success)
    if (allFailed && results.length > 0) {
      console.error(`⚠️  Todos os webhooks falharam para o evento: ${event}`)
      // Você pode implementar lógica de fallback aqui
      // Por exemplo: salvar em fila para retry posterior
    }

    return results
  } catch (error) {
    console.error('❌ Erro crítico ao disparar webhooks:', error)
    // Importante: não deixe o erro quebrar o fluxo principal
    return []
  }
}

// ============================================================================
// Exemplo 16: Disparar webhook com retry manual
// ============================================================================

export async function dispatchWithCustomRetry(
  event: string,
  data: any,
  maxRetries: number = 3
) {
  let attempt = 0
  let lastError: Error | null = null

  while (attempt < maxRetries) {
    try {
      const results = await webhookDispatcher.dispatch(event, data)

      // Verifica se algum teve sucesso
      const hasSuccess = results.some(r => r.success)
      if (hasSuccess) {
        return results
      }

      lastError = new Error('Todos os webhooks falharam')
    } catch (error) {
      lastError = error as Error
    }

    attempt++
    if (attempt < maxRetries) {
      console.log(`⚠️  Tentativa ${attempt} falhou, tentando novamente...`)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
    }
  }

  throw lastError
}

// ============================================================================
// Exemplo 17: Disparar webhook de forma não-bloqueante
// ============================================================================

export function dispatchWebhookAsync(event: string, data: any) {
  // Dispara de forma assíncrona sem esperar
  // Útil quando você não quer que webhooks atrasem a resposta da API
  webhookDispatcher
    .dispatch(event, data)
    .then(results => {
      console.log(`✅ Webhook ${event} disparado: ${results.length} destinatário(s)`)
    })
    .catch(error => {
      console.error(`❌ Erro ao disparar webhook ${event}:`, error)
    })
}

// ============================================================================
// Exemplo 18: Wrapper para logger de eventos com webhooks
// ============================================================================

export class EventLogger {
  async logAndDispatch(event: string, data: any, logToDatabase: boolean = true) {
    // 1. Log no console
    console.log(`📝 Evento: ${event}`, data)

    // 2. Salva no banco (opcional)
    if (logToDatabase) {
      // await database.events.insert({ event, data, timestamp: new Date() })
    }

    // 3. Dispara webhooks
    await dispatchWebhookAsync(event, data)
  }
}

// ============================================================================
// Como usar no seu código
// ============================================================================

/*
// No seu MessageService:
import { onMessageReceived } from './webhook-integration-example'

class MessageService {
  async handleIncomingMessage(message: any) {
    // Salva mensagem no banco
    await this.saveMessage(message)

    // Dispara webhooks
    await onMessageReceived(message)

    // Continua processamento...
  }
}

// No seu ConversationController:
import { onConversationCreated } from './webhook-integration-example'

class ConversationController {
  async createConversation(req, res) {
    const conversation = await this.service.createConversation(req.body)

    // Dispara webhooks
    await onConversationCreated(conversation)

    res.json(conversation)
  }
}

// Forma não-bloqueante (recomendado):
import { dispatchWebhookAsync } from './webhook-integration-example'

class MessageService {
  async handleIncomingMessage(message: any) {
    await this.saveMessage(message)

    // Dispara sem bloquear
    dispatchWebhookAsync('message.received', {
      messageId: message._id.toString(),
      content: message.content,
      from: message.from
    })

    // Responde imediatamente
    return message
  }
}
*/
