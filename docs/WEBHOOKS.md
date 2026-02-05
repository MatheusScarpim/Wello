# Sistema de Webhooks - NxZap

Este documento descreve como usar o sistema de webhooks do NxZap para receber notificações de eventos em tempo real.

## Visão Geral

O sistema de webhooks permite que você cadastre URLs que receberão notificações HTTP POST sempre que determinados eventos ocorrerem no sistema (mensagens recebidas, conversas criadas, etc.).

## Características

- Suporte a múltiplos webhooks
- Filtro por eventos específicos
- Sistema de retry automático
- Assinatura HMAC para segurança
- Headers customizados
- Estatísticas de envio

## Eventos Disponíveis

- `message.received` - Mensagem recebida
- `message.sent` - Mensagem enviada
- `message.failed` - Falha ao enviar mensagem
- `conversation.created` - Conversa criada
- `conversation.updated` - Conversa atualizada
- `conversation.archived` - Conversa arquivada
- `conversation.deleted` - Conversa deletada
- `operator.assigned` - Operador atribuído
- `operator.removed` - Operador removido
- `bot.started` - Bot iniciado
- `bot.stopped` - Bot parado
- `queue.updated` - Mudança de estado na fila (nova conversa, atribuição, liberação, transferência ou resolução)

### Evento `queue.updated`

Disparado sempre que uma conversa muda de status na fila de atendimento (por exemplo: é reencaminhada para espera, assumida por um operador, liberada novamente, transferida ou resolvida). O payload inclui o item completo da fila (mesmo formato retornado pela API `/queue`), além de um campo `reason` que indica a ação que motivou o disparo (`requeued`, `assigned`, `released`, `transferred`, `transferred_department` ou `resolved`).

Exemplo de payload:

```json
{
  "event": "queue.updated",
  "data": {
    "_id": "6503c4...",
    "conversation": {
      "_id": "6503c4...",
      "identifier": "5511999999999",
      "provider": "whatsapp",
      "status": "active",
      "archived": false
    },
    "status": "waiting",
    "priority": 1,
    "waitTime": 34,
    "departmentId": "62af...",
    "operatorId": null,
    "operator": null,
    "reason": "requeued",
    "tags": ["crm", "vip"],
    "timestamp": "2026-02-05T10:12:00.000Z"
  },
  "timestamp": "2026-02-05T10:12:00.000Z",
  "id": "uuid-do-evento"
}
```

Essa separação deixa claro que `conversation.created` e os eventos `message.*` continuam cobrindo a criação e o tráfego de mensagens, enquanto `queue.updated` informa apenas as mudanças de status dentro da fila (sem duplicar mensagens).

## API Endpoints

### Listar Webhooks

```http
GET /api/webhooks
```

Parâmetros de query:
- `page` (número, padrão: 1)
- `limit` (número, padrão: 10)
- `enabled` (boolean) - Filtrar por status
- `event` (string) - Filtrar por evento
- `search` (string) - Buscar por nome ou URL

Resposta:
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "total": 10,
      "page": 1,
      "pageSize": 10,
      "totalPages": 1
    }
  }
}
```

### Criar Webhook

```http
POST /api/webhooks
```

Body:
```json
{
  "name": "Meu Webhook",
  "url": "https://meusite.com/webhook",
  "events": ["message.received", "conversation.created", "queue.updated"],
  "enabled": true,
  "secret": "meu-secret-opcional",
  "headers": {
    "Authorization": "Bearer token123",
    "Custom-Header": "value"
  },
  "retryAttempts": 3,
  "retryDelay": 1000
}
```

Campos:
- `name` (obrigatório) - Nome identificador do webhook
- `url` (obrigatório) - URL que receberá os eventos
- `events` (obrigatório) - Array de eventos para escutar
- `enabled` (opcional, padrão: true) - Se o webhook está ativo
- `secret` (opcional) - Secret para gerar assinatura HMAC
- `headers` (opcional) - Headers customizados para incluir na requisição
- `retryAttempts` (opcional, padrão: 3) - Número de tentativas em caso de falha
- `retryDelay` (opcional, padrão: 1000) - Delay entre tentativas em ms

### Buscar Webhook por ID

```http
GET /api/webhooks/:id
```

### Atualizar Webhook

```http
PUT /api/webhooks/:id
```

Body: Mesmos campos do criar (todos opcionais)

### Deletar Webhook

```http
DELETE /api/webhooks/:id
```

### Ativar Webhook

```http
POST /api/webhooks/:id/enable
```

### Desativar Webhook

```http
POST /api/webhooks/:id/disable
```

### Testar Webhook

```http
POST /api/webhooks/:id/test
```

Envia um evento de teste para o webhook.

### Listar Eventos Disponíveis

```http
GET /api/webhooks/events
```

### Obter Estatísticas

```http
GET /api/webhooks/stats
```

## Payload dos Webhooks

Quando um evento ocorre, o sistema enviará uma requisição HTTP POST para as URLs cadastradas com o seguinte formato:

```json
{
  "event": "message.received",
  "data": {
    // Dados do evento (varia conforme o tipo)
  },
  "timestamp": "2025-10-22T12:34:56.789Z",
  "id": "uuid-do-evento"
}
```

### Headers Enviados

```
Content-Type: application/json
X-Webhook-Event: message.received
X-Webhook-ID: uuid-do-evento
X-Webhook-Timestamp: 2025-10-22T12:34:56.789Z
X-Webhook-Signature: sha256=hash (se secret configurado)
User-Agent: NxZap-Webhook/1.0
```

## Validação de Assinatura

Se você configurou um `secret` no webhook, cada requisição incluirá o header `X-Webhook-Signature` com uma assinatura HMAC-SHA256.

Para validar:

### Node.js
```javascript
const crypto = require('crypto')

function validateSignature(payload, signature, secret) {
  const expectedSignature = 'sha256=' +
    crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')

  return signature === expectedSignature
}

// No seu endpoint
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature']
  const payload = JSON.stringify(req.body)
  const secret = 'seu-secret'

  if (!validateSignature(payload, signature, secret)) {
    return res.status(401).send('Invalid signature')
  }

  // Processar evento...
  res.sendStatus(200)
})
```

### PHP
```php
function validateSignature($payload, $signature, $secret) {
    $expectedSignature = 'sha256=' . hash_hmac('sha256', $payload, $secret);
    return hash_equals($signature, $expectedSignature);
}

$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'];
$secret = 'seu-secret';

if (!validateSignature($payload, $signature, $secret)) {
    http_response_code(401);
    die('Invalid signature');
}

$event = json_decode($payload, true);
// Processar evento...
```

### Python
```python
import hmac
import hashlib

def validate_signature(payload: str, signature: str, secret: str) -> bool:
    expected_signature = 'sha256=' + hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(signature, expected_signature)

@app.route('/webhook', methods=['POST'])
def webhook():
    payload = request.data.decode()
    signature = request.headers.get('X-Webhook-Signature')
    secret = 'seu-secret'

    if not validate_signature(payload, signature, secret):
        return 'Invalid signature', 401

    event = request.json
    # Processar evento...
    return '', 200
```

## Sistema de Retry

Se o webhook falhar (erro de rede, timeout, código HTTP não-2xx), o sistema tentará novamente:

1. Aguarda o `retryDelay` configurado (padrão: 1000ms)
2. Faz nova tentativa
3. Repete até atingir `retryAttempts` (padrão: 3 tentativas)

O sistema considera sucesso apenas respostas HTTP 2xx (200-299).

## Boas Práticas

1. **Responda Rapidamente**: Seu endpoint deve responder com status 200 rapidamente. Processe os dados de forma assíncrona.

2. **Use HTTPS**: Sempre use URLs HTTPS em produção para segurança.

3. **Valide Assinaturas**: Configure um `secret` e valide as assinaturas para garantir que as requisições vieram do NxZap.

4. **Idempotência**: O mesmo evento pode ser enviado múltiplas vezes (devido a retries). Use o `id` do evento para evitar processamento duplicado.

5. **Timeout**: Configure um timeout adequado no seu servidor (recomendado: 30 segundos ou menos).

6. **Monitoramento**: Monitore as estatísticas dos webhooks para identificar problemas.

## Exemplo de Implementação Completa

### Express.js (Node.js)
```javascript
const express = require('express')
const crypto = require('crypto')

const app = express()
app.use(express.json())

const SECRET = 'seu-secret'
const processedEvents = new Set() // Para idempotência

function validateSignature(payload, signature, secret) {
  const expectedSignature = 'sha256=' +
    crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return signature === expectedSignature
}

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature']
  const payload = JSON.stringify(req.body)

  // Validar assinatura
  if (!validateSignature(payload, signature, SECRET)) {
    return res.status(401).send('Invalid signature')
  }

  const event = req.body

  // Verificar se já processamos este evento (idempotência)
  if (processedEvents.has(event.id)) {
    return res.sendStatus(200) // Já processado
  }

  // Responder imediatamente
  res.sendStatus(200)

  // Processar de forma assíncrona
  processEvent(event).catch(console.error)
})

async function processEvent(event) {
  // Marcar como processado
  processedEvents.add(event.id)

  // Limpar eventos antigos (após 1 hora)
  setTimeout(() => processedEvents.delete(event.id), 3600000)

  console.log('Evento recebido:', event.event)

  switch (event.event) {
    case 'message.received':
      console.log('Nova mensagem:', event.data)
      // Processar mensagem...
      break

    case 'conversation.created':
      console.log('Nova conversa:', event.data)
      // Processar conversa...
      break

    // Outros eventos...
  }
}

app.listen(3000, () => {
  console.log('Webhook listener rodando na porta 3000')
})
```

## Troubleshooting

### Webhook não está recebendo eventos
- Verifique se o webhook está ativo (`enabled: true`)
- Confirme que os eventos estão configurados corretamente
- Verifique se a URL está acessível publicamente
- Consulte as estatísticas do webhook para ver erros

### Recebendo erro 401 "Invalid signature"
- Confirme que está usando o mesmo `secret` configurado
- Verifique se está validando a assinatura corretamente
- Certifique-se de usar o payload bruto (string) para validação

### Timeout ou erros de rede
- Verifique se seu servidor está respondendo em menos de 30 segundos
- Confirme que a URL está acessível
- Verifique firewalls e configurações de rede

### Recebendo eventos duplicados
- Isso pode acontecer devido ao sistema de retry
- Implemente verificação de idempotência usando o `event.id`

## Disparando Webhooks Manualmente (Desenvolvimento)

Para disparar webhooks no seu código:

```typescript
import { webhookDispatcher } from '@/api/services/WebhookDispatcher'

// Disparar evento único
await webhookDispatcher.dispatch('message.received', {
  messageId: '123',
  content: 'Olá!',
  from: '5511999999999'
})

// Disparar múltiplos eventos
await webhookDispatcher.dispatchBatch([
  { event: 'message.received', data: { ... } },
  { event: 'conversation.created', data: { ... } }
])
```
