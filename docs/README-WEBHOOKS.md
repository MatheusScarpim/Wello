# Sistema de Webhooks - Guia Rápido

Sistema completo de webhooks para receber notificações em tempo real de eventos do NxZap.

## Início Rápido

### 1. Criar um Webhook

```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Meu Webhook",
    "url": "https://meusite.com/webhook",
    "events": ["message.received", "conversation.created"],
    "secret": "meu-secret-seguro"
  }'
```

### 2. Listar Webhooks

```bash
curl http://localhost:3000/api/webhooks
```

### 3. Testar Webhook

```bash
curl -X POST http://localhost:3000/api/webhooks/{ID}/test
```

## Eventos Disponíveis

- `message.received` - Mensagem recebida
- `message.sent` - Mensagem enviada
- `message.failed` - Falha ao enviar
- `conversation.created` - Conversa criada
- `conversation.updated` - Conversa atualizada
- `conversation.archived` - Conversa arquivada
- `conversation.deleted` - Conversa deletada
- `operator.assigned` - Operador atribuído
- `operator.removed` - Operador removido
- `bot.started` - Bot iniciado
- `bot.stopped` - Bot parado
- `queue.updated` - Mudança de estado na fila (reencaminho, atribuição, liberação, transferência ou resolução)

### Evento `queue.updated`

Sempre que uma conversa muda de status na fila, o webhook dispara `queue.updated`. O payload contém o item completo da fila, incluindo `status`, `reason` (`requeued`, `assigned`, `released`, `transferred`, `transferred_department` ou `resolved`), `waitTime`, `operator`, `departmentId` e a conversa associada.

## Endpoints da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/webhooks` | Lista webhooks |
| GET | `/api/webhooks/:id` | Busca webhook por ID |
| POST | `/api/webhooks` | Cria webhook |
| PUT | `/api/webhooks/:id` | Atualiza webhook |
| DELETE | `/api/webhooks/:id` | Deleta webhook |
| POST | `/api/webhooks/:id/enable` | Ativa webhook |
| POST | `/api/webhooks/:id/disable` | Desativa webhook |
| POST | `/api/webhooks/:id/test` | Testa webhook |
| GET | `/api/webhooks/events` | Lista eventos disponíveis |
| GET | `/api/webhooks/stats` | Obtém estatísticas |

## Formato do Payload

```json
{
  "event": "message.received",
  "data": {
    // Dados do evento
  },
  "timestamp": "2025-10-22T12:34:56.789Z",
  "id": "uuid-do-evento"
}
```

## Headers Enviados

- `Content-Type: application/json`
- `X-Webhook-Event: message.received`
- `X-Webhook-ID: uuid-do-evento`
- `X-Webhook-Timestamp: 2025-10-22T12:34:56.789Z`
- `X-Webhook-Signature: sha256=hash` (se secret configurado)
- `User-Agent: NxZap-Webhook/1.0`

## Validação de Assinatura (Recomendado)

### Node.js
```javascript
const crypto = require('crypto')

function validateSignature(payload, signature, secret) {
  const expectedSignature = 'sha256=' +
    crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return signature === expectedSignature
}
```

### Python
```python
import hmac
import hashlib

def validate_signature(payload: str, signature: str, secret: str) -> bool:
    expected = 'sha256=' + hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)
```

### PHP
```php
function validateSignature($payload, $signature, $secret) {
    $expected = 'sha256=' . hash_hmac('sha256', $payload, $secret);
    return hash_equals($signature, $expected);
}
```

## Exemplo de Receptor

Veja o arquivo [webhook-receiver-example.js](./webhook-receiver-example.js) para um exemplo completo de servidor Node.js que recebe webhooks.

Para executar o exemplo:

```bash
cd docs
npm install express
node webhook-receiver-example.js
```

## Recursos

- **Retry Automático**: Tenta novamente em caso de falha
- **Múltiplos Webhooks**: Cadastre quantos quiser
- **Filtro de Eventos**: Escolha quais eventos receber
- **Headers Customizados**: Adicione seus próprios headers
- **Assinatura HMAC**: Segurança com validação de assinatura
- **Estatísticas**: Monitore envios e falhas

## Disparar Webhooks Programaticamente

No código do NxZap, você pode disparar webhooks assim:

```typescript
import { webhookDispatcher } from '@/api/services/WebhookDispatcher'

// Disparar um evento
await webhookDispatcher.dispatch('message.received', {
  messageId: '123',
  content: 'Olá!',
  from: '5511999999999'
})
```

## Documentação Completa

Para documentação detalhada, veja:
- [WEBHOOKS.md](./WEBHOOKS.md) - Documentação completa
- [webhook-examples.http](./webhook-examples.http) - Exemplos de requisições HTTP

## Suporte

Para problemas ou dúvidas, consulte a seção de Troubleshooting na documentação completa.
