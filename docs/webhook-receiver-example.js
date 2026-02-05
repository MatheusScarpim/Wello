/**
 * Exemplo de servidor para receber webhooks do NxZap
 *
 * Para usar:
 * 1. npm install express
 * 2. node webhook-receiver-example.js
 * 3. Configure o webhook no NxZap apontando para http://localhost:3001/webhook
 * 4. Use ngrok ou similar para expor publicamente em produção
 */

const express = require('express')
const crypto = require('crypto')

const app = express()
const PORT = 3001

// Configurações
const WEBHOOK_SECRET = 'meu-secret-super-seguro' // Mesmo secret configurado no NxZap
const USE_SIGNATURE_VALIDATION = true // Ativar validação de assinatura

// Armazena IDs de eventos já processados para garantir idempotência
const processedEvents = new Set()

// Middleware para capturar o body bruto (necessário para validação de assinatura)
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString()
  }
}))

/**
 * Valida a assinatura HMAC do webhook
 */
function validateSignature(payload, signature, secret) {
  const expectedSignature = 'sha256=' +
    crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

/**
 * Endpoint principal que recebe os webhooks
 */
app.post('/webhook', (req, res) => {
  console.log('\n' + '='.repeat(60))
  console.log('📥 Webhook recebido em:', new Date().toISOString())
  console.log('='.repeat(60))

  // 1. Validar assinatura (se configurado)
  if (USE_SIGNATURE_VALIDATION) {
    const signature = req.headers['x-webhook-signature']

    if (!signature) {
      console.error('❌ Assinatura não encontrada nos headers')
      return res.status(401).json({ error: 'Signature required' })
    }

    try {
      if (!validateSignature(req.rawBody, signature, WEBHOOK_SECRET)) {
        console.error('❌ Assinatura inválida')
        return res.status(401).json({ error: 'Invalid signature' })
      }
      console.log('✅ Assinatura validada com sucesso')
    } catch (error) {
      console.error('❌ Erro ao validar assinatura:', error.message)
      return res.status(401).json({ error: 'Signature validation failed' })
    }
  }

  const event = req.body

  // 2. Verificar idempotência
  if (processedEvents.has(event.id)) {
    console.log('⚠️  Evento já processado anteriormente (ID:', event.id, ')')
    return res.status(200).json({ status: 'already_processed' })
  }

  // 3. Log dos headers recebidos
  console.log('\n📋 Headers:')
  console.log('  X-Webhook-Event:', req.headers['x-webhook-event'])
  console.log('  X-Webhook-ID:', req.headers['x-webhook-id'])
  console.log('  X-Webhook-Timestamp:', req.headers['x-webhook-timestamp'])

  // 4. Log do evento
  console.log('\n📦 Payload:')
  console.log('  Evento:', event.event)
  console.log('  ID:', event.id)
  console.log('  Timestamp:', event.timestamp)
  console.log('  Dados:', JSON.stringify(event.data, null, 2))

  // 5. Responder imediatamente (importante!)
  res.status(200).json({
    status: 'received',
    eventId: event.id
  })

  // 6. Processar o evento de forma assíncrona
  processEventAsync(event)
    .catch(error => {
      console.error('❌ Erro ao processar evento:', error)
    })
})

/**
 * Processa o evento de forma assíncrona
 */
async function processEventAsync(event) {
  // Marcar como processado
  processedEvents.add(event.id)

  // Limpar eventos antigos após 1 hora (para não acumular memória)
  setTimeout(() => {
    processedEvents.delete(event.id)
  }, 3600000)

  console.log('\n⚙️  Processando evento:', event.event)

  // Processar de acordo com o tipo de evento
  try {
    switch (event.event) {
      case 'message.received':
        await handleMessageReceived(event.data)
        break

      case 'message.sent':
        await handleMessageSent(event.data)
        break

      case 'message.failed':
        await handleMessageFailed(event.data)
        break

      case 'conversation.created':
        await handleConversationCreated(event.data)
        break

      case 'conversation.updated':
        await handleConversationUpdated(event.data)
        break

      case 'conversation.archived':
        await handleConversationArchived(event.data)
        break

      case 'conversation.deleted':
        await handleConversationDeleted(event.data)
        break

      case 'operator.assigned':
        await handleOperatorAssigned(event.data)
        break

      case 'operator.removed':
        await handleOperatorRemoved(event.data)
        break

      case 'bot.started':
        await handleBotStarted(event.data)
        break

      case 'bot.stopped':
        await handleBotStopped(event.data)
        break

      case 'webhook.test':
        console.log('🧪 Webhook de teste recebido!')
        break

      default:
        console.log('⚠️  Tipo de evento desconhecido:', event.event)
    }

    console.log('✅ Evento processado com sucesso')
  } catch (error) {
    console.error('❌ Erro ao processar evento:', error)
  }

  console.log('='.repeat(60) + '\n')
}

// ============================================================================
// Handlers para cada tipo de evento
// ============================================================================

async function handleMessageReceived(data) {
  console.log('💬 Nova mensagem recebida:')
  console.log('   De:', data.from || 'Desconhecido')
  console.log('   Conteúdo:', data.content || data.message || 'N/A')

  // Exemplo: Salvar no banco de dados
  // await database.messages.insert(data)

  // Exemplo: Enviar notificação
  // await sendNotification('Nova mensagem', data.content)

  // Exemplo: Processar com IA
  // const response = await ai.processMessage(data.content)
}

async function handleMessageSent(data) {
  console.log('📤 Mensagem enviada com sucesso:')
  console.log('   Para:', data.to || 'Desconhecido')
  console.log('   Conteúdo:', data.content || data.message || 'N/A')

  // Exemplo: Atualizar status no banco
  // await database.messages.updateStatus(data.messageId, 'sent')
}

async function handleMessageFailed(data) {
  console.log('❌ Falha ao enviar mensagem:')
  console.log('   Erro:', data.error || 'Desconhecido')

  // Exemplo: Registrar erro e tentar novamente
  // await errorLogger.log(data)
  // await retryMessage(data.messageId)
}

async function handleConversationCreated(data) {
  console.log('🆕 Nova conversa criada:')
  console.log('   ID:', data.id || data._id || 'Desconhecido')
  console.log('   Nome:', data.name || 'Sem nome')

  // Exemplo: Inicializar configurações da conversa
  // await setupConversation(data.id)
}

async function handleConversationUpdated(data) {
  console.log('🔄 Conversa atualizada:')
  console.log('   ID:', data.id || data._id || 'Desconhecido')

  // Exemplo: Sincronizar com sistema externo
  // await syncConversation(data)
}

async function handleConversationArchived(data) {
  console.log('📁 Conversa arquivada:')
  console.log('   ID:', data.id || data._id || 'Desconhecido')

  // Exemplo: Gerar relatório da conversa
  // await generateConversationReport(data.id)
}

async function handleConversationDeleted(data) {
  console.log('🗑️  Conversa deletada:')
  console.log('   ID:', data.id || data._id || 'Desconhecido')

  // Exemplo: Limpar dados relacionados
  // await cleanupConversationData(data.id)
}

async function handleOperatorAssigned(data) {
  console.log('👤 Operador atribuído:')
  console.log('   Operador:', data.operatorName || 'Desconhecido')
  console.log('   Conversa:', data.conversationId || 'Desconhecido')

  // Exemplo: Notificar operador
  // await notifyOperator(data.operatorId, data.conversationId)
}

async function handleOperatorRemoved(data) {
  console.log('👤 Operador removido:')
  console.log('   Conversa:', data.conversationId || 'Desconhecido')

  // Exemplo: Reatribuir conversa
  // await reassignConversation(data.conversationId)
}

async function handleBotStarted(data) {
  console.log('🤖 Bot iniciado:')
  console.log('   Bot:', data.botName || 'Desconhecido')

  // Exemplo: Registrar evento
  // await logBotEvent('started', data)
}

async function handleBotStopped(data) {
  console.log('🤖 Bot parado:')
  console.log('   Bot:', data.botName || 'Desconhecido')

  // Exemplo: Registrar evento
  // await logBotEvent('stopped', data)
}

// ============================================================================
// Health check endpoint
// ============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    processedEvents: processedEvents.size
  })
})

// ============================================================================
// Iniciar servidor
// ============================================================================

app.listen(PORT, () => {
  console.log('🚀 Servidor de webhooks iniciado!')
  console.log('📍 Endpoint:', `http://localhost:${PORT}/webhook`)
  console.log('🔒 Validação de assinatura:', USE_SIGNATURE_VALIDATION ? 'ATIVADA' : 'DESATIVADA')
  console.log('\n💡 Para expor publicamente, use:')
  console.log('   ngrok http', PORT)
  console.log('\n')
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Encerrando servidor...')
  process.exit(0)
})
