# Guia de Testes - Sistema de Webhooks

Este guia mostra como testar o sistema de webhooks do NxZap e verificar se os eventos estão sendo disparados corretamente.

## Pré-requisitos

1. Sistema NxZap rodando
2. Banco de dados MongoDB conectado
3. (Opcional) Ferramenta de testes de API (Postman, Insomnia, curl, etc.)

## Passo 1: Configurar Servidor Receptor

Você precisa de um endpoint para receber os webhooks. Use uma das opções abaixo:

### Opção A: Usar o exemplo fornecido

```bash
cd docs
node webhook-receiver-example.js
```

O servidor estará rodando em `http://localhost:3001/webhook`

### Opção B: Usar webhook.site (temporário)

1. Acesse https://webhook.site
2. Copie a URL única gerada
3. Use essa URL para cadastrar o webhook

### Opção C: Usar ngrok para expor localhost

```bash
# Primeiro, inicie o servidor de exemplo
cd docs
node webhook-receiver-example.js

# Em outro terminal, exponha com ngrok
ngrok http 3001

# Use a URL do ngrok para cadastrar o webhook
```

## Passo 2: Cadastrar um Webhook

### Via curl:

```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teste Webhook",
    "url": "http://localhost:3001/webhook",
    "events": ["message.received", "conversation.created"],
    "secret": "meu-secret-123",
    "enabled": true
  }'
```

### Via Arquivo HTTP (VSCode REST Client):

Use o arquivo [webhook-examples.http](./webhook-examples.http) exemplo #4 ou #5.

### Resposta Esperada:

```json
{
  "success": true,
  "data": {
    "_id": "672a...",
    "name": "Teste Webhook",
    "url": "http://localhost:3001/webhook",
    "events": ["message.received", "conversation.created"],
    "enabled": true,
    "totalSent": 0,
    "totalFailed": 0,
    ...
  },
  "message": "Webhook criado com sucesso",
  "timestamp": "2025-10-22T..."
}
```

Salve o `_id` retornado para os próximos passos.

## Passo 3: Testar o Webhook

### 3.1. Teste Manual (Recomendado)

```bash
curl -X POST http://localhost:3000/api/webhooks/{WEBHOOK_ID}/test
```

Substitua `{WEBHOOK_ID}` pelo ID recebido no passo anterior.

### Resposta Esperada:

```json
{
  "success": true,
  "data": {
    "webhookId": "672a...",
    "success": true,
    "statusCode": 200,
    "attempt": 1,
    "duration": 45
  },
  "message": "Webhook testado com sucesso"
}
```

### 3.2. Verificar Logs

Se você estiver usando o servidor de exemplo, verá algo como:

```
============================================================
📥 Webhook recebido em: 2025-10-22T12:34:56.789Z
============================================================

✅ Assinatura validada com sucesso

📋 Headers:
  X-Webhook-Event: webhook.test
  X-Webhook-ID: uuid-123
  X-Webhook-Timestamp: 2025-10-22T12:34:56.789Z

📦 Payload:
  Evento: webhook.test
  ID: uuid-123
  Timestamp: 2025-10-22T12:34:56.789Z
  Dados: {
    "message": "Este é um teste de webhook",
    "webhookId": "672a...",
    "webhookName": "Teste Webhook"
  }

🧪 Webhook de teste recebido!
✅ Evento processado com sucesso
============================================================
```

## Passo 4: Testar Eventos Reais

Agora vamos testar com eventos reais do sistema.

### 4.1. Testar `conversation.created`

Crie uma nova conversa via API:

```bash
curl -X POST http://localhost:3000/api/conversations/create \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "5511999999999",
    "provider": "whatsapp",
    "name": "Teste Webhook",
    "photo": ""
  }'
```

**Webhook Esperado:**

```json
{
  "event": "conversation.created",
  "data": {
    "conversationId": "672a...",
    "identifier": "5511999999999",
    "provider": "whatsapp",
    "name": "Teste Webhook",
    "status": "active",
    "createdAt": "2025-10-22T12:34:56.789Z"
  },
  "timestamp": "2025-10-22T12:34:56.789Z",
  "id": "uuid-123"
}
```

### 4.2. Testar `message.received`

Envie uma mensagem no WhatsApp para o número conectado no NxZap.

**Webhook Esperado:**

```json
{
  "event": "message.received",
  "data": {
    "messageId": "672a...",
    "conversationId": "672b...",
    "content": "Olá, teste!",
    "type": "text",
    "direction": "incoming",
    "status": "sent",
    "from": "5511999999999",
    "to": "5511888888888",
    "timestamp": "2025-10-22T12:34:56.789Z"
  },
  "timestamp": "2025-10-22T12:34:56.789Z",
  "id": "uuid-456"
}
```

### 4.3. Testar `queue.updated`

As operações de fila (assumir, liberar, transferir ou finalizar) disparam `queue.updated`. Você pode executar os endpoints da fila (`/api/queue/assume`, `/api/queue/:id/release`, `/api/queue/:id/resolve`) e observar o evento com o campo `reason` indicando a ação (`assigned`, `released`, `requeued`, `transferred`, `transferred_department`, `resolved`).

**Webhook Esperado:**

```json
{
  "event": "queue.updated",
  "data": {
    "status": "in_progress",
    "reason": "assigned",
    "waitTime": 12,
    "conversation": {
      "identifier": "5511999999999",
      "provider": "whatsapp"
    },
    "operator": {
      "_id": "5f8b8b8b8b8b8b8b8b8b8b8",
      "name": "Operador Teste"
    }
  },
  "timestamp": "2026-02-05T10:15:00.000Z",
  "id": "uuid-789"
}
```

### 4.3. Testar `conversation.updated`

Atualize uma conversa:

```bash
curl -X PUT http://localhost:3000/api/conversations/{CONVERSATION_ID} \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Novo Nome",
    "status": "active"
  }'
```

### 4.4. Testar `conversation.archived`

Arquive uma conversa:

```bash
curl -X PATCH http://localhost:3000/api/conversations/{CONVERSATION_ID}/archive
```

### 4.5. Testar `operator.assigned`

Atribua um operador:

```bash
curl -X PATCH http://localhost:3000/api/conversations/{CONVERSATION_ID}/assign-operator \
  -H "Content-Type: application/json" \
  -d '{
    "operatorId": "op123",
    "operatorName": "João Silva"
  }'
```

## Passo 5: Verificar Estatísticas

Consulte as estatísticas do webhook:

```bash
curl http://localhost:3000/api/webhooks/{WEBHOOK_ID}
```

Você verá quantos webhooks foram enviados com sucesso (`totalSent`) e quantos falharam (`totalFailed`).

## Passo 6: Testar Retry em Caso de Falha

### 6.1. Simular Falha

Pare o servidor receptor (Ctrl+C) e tente disparar um evento.

### 6.2. Verificar Tentativas

O sistema tentará enviar o webhook 3 vezes (por padrão) com delay de 1 segundo entre cada tentativa.

Você verá nos logs do NxZap:

```
⚠️  Webhook 672a... falhou (tentativa 1/3). Tentando novamente em 1000ms...
⚠️  Webhook 672a... falhou (tentativa 2/3). Tentando novamente em 1000ms...
⚠️  Webhook 672a... falhou (tentativa 3/3). Tentando novamente em 1000ms...
```

### 6.3. Verificar Estatísticas de Falha

```bash
curl http://localhost:3000/api/webhooks/{WEBHOOK_ID}
```

O campo `totalFailed` será incrementado.

## Troubleshooting

### Webhook não está sendo disparado

1. **Verifique se o webhook está ativo:**
   ```bash
   curl http://localhost:3000/api/webhooks/{WEBHOOK_ID}
   ```
   O campo `enabled` deve ser `true`.

2. **Verifique os eventos configurados:**
   Certifique-se de que o evento que você está testando está na lista de `events` do webhook.

3. **Verifique os logs do NxZap:**
   Procure por mensagens de erro relacionadas a webhooks:
   ```
   ❌ Erro ao disparar webhooks
   ```

4. **Teste manualmente:**
   Use o endpoint de teste para verificar se a URL está acessível:
   ```bash
   curl -X POST http://localhost:3000/api/webhooks/{WEBHOOK_ID}/test
   ```

### Recebendo erro 401 "Invalid signature"

1. **Verifique o secret:**
   Certifique-se de que está usando o mesmo `secret` configurado no webhook.

2. **Verifique a validação:**
   No servidor receptor, certifique-se de que está validando o payload bruto (string), não o JSON parseado.

### URL não está acessível

1. **Para localhost:**
   Use ngrok para expor: `ngrok http 3001`

2. **Para produção:**
   Certifique-se de que:
   - A URL é HTTPS
   - Não há firewall bloqueando
   - O servidor está rodando

### Eventos duplicados

Isso é normal e esperado em caso de retry. Implemente verificação de idempotência usando o campo `id` do evento.

## Checklist de Testes

- [ ] Webhook cadastrado com sucesso
- [ ] Teste manual funciona (`/test` endpoint)
- [ ] `conversation.created` dispara ao criar conversa
- [ ] `message.received` dispara ao receber mensagem
- [ ] `conversation.updated` dispara ao atualizar conversa
- [ ] `conversation.archived` dispara ao arquivar conversa
- [ ] `operator.assigned` dispara ao atribuir operador
- [ ] Retry funciona quando servidor está offline
- [ ] Assinatura HMAC valida corretamente
- [ ] Estatísticas (`totalSent`, `totalFailed`) são atualizadas
- [ ] Múltiplos webhooks podem ser cadastrados
- [ ] Filtro por eventos funciona corretamente

## Exemplos de Integração

### Node.js + Express
Veja [webhook-receiver-example.js](./webhook-receiver-example.js)

### Python + Flask
```python
from flask import Flask, request
import hmac
import hashlib

app = Flask(__name__)
SECRET = 'meu-secret-123'

@app.route('/webhook', methods=['POST'])
def webhook():
    # Validar assinatura
    signature = request.headers.get('X-Webhook-Signature')
    payload = request.data.decode()

    expected = 'sha256=' + hmac.new(
        SECRET.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(signature, expected):
        return 'Invalid signature', 401

    # Processar evento
    event = request.json
    print(f"Evento: {event['event']}")
    print(f"Dados: {event['data']}")

    return '', 200

if __name__ == '__main__':
    app.run(port=3001)
```

### PHP
```php
<?php
define('SECRET', 'meu-secret-123');

$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'];

$expected = 'sha256=' . hash_hmac('sha256', $payload, SECRET);

if (!hash_equals($signature, $expected)) {
    http_response_code(401);
    die('Invalid signature');
}

$event = json_decode($payload, true);
error_log("Evento: " . $event['event']);
error_log("Dados: " . print_r($event['data'], true));

http_response_code(200);
?>
```

## Próximos Passos

Após confirmar que os webhooks estão funcionando:

1. Configure webhooks em produção com URLs HTTPS
2. Implemente processamento assíncrono dos eventos
3. Configure monitoramento das estatísticas
4. Implemente retry manual para webhooks falhados
5. Configure alertas para webhooks com alta taxa de falha
