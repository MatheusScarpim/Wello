# welloChat API - Requests and Responses

Base URL: `http://<host>:<port>` (default `HTTP_PORT=8081`)

Standard success response:
```json
{
  "success": true,
  "data": {},
  "message": "optional",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

Standard error response:
```json
{
  "success": false,
  "error": "message",
  "details": {},
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

Pagination (query or body): `page`, `limit`. Typical response:
```json
{
  "items": [],
  "pagination": {
    "total": 0,
    "page": 1,
    "pageSize": 10,
    "totalPages": 0
  }
}
```

## Health

GET `/health`
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "memory": {}
}
```

GET `/status`
```json
{
  "status": "operational",
  "version": "2.0.0",
  "service": "welloChat API"
}
```

## Auth

POST `/api/auth/token/generate`
```json
{
  "userId": "user_1",
  "email": "user@x.com",
  "role": "admin",
  "expiresIn": "365d",
  "description": "optional"
}
```
```json
{
  "success": true,
  "data": {
    "token": "jwt",
    "userId": "user_1",
    "email": "user@x.com",
    "role": "admin",
    "expiresIn": "365d",
    "description": "optional",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "usage": "Authorization: Bearer <token>"
  },
  "message": "Token gerado com sucesso"
}
```

POST `/api/auth/token/validate`
```json
{ "token": "jwt" }
```
```json
{
  "success": true,
  "data": { "userId": "user_1", "email": "user@x.com", "role": "user" },
  "message": "Token valido"
}
```

GET `/api/auth/info`
```json
{
  "success": true,
  "data": {
    "type": "JWT (JSON Web Token)",
    "algorithm": "HS256",
    "header": "Authorization: Bearer <token>",
    "defaultExpiration": "365d",
    "endpoints": {
      "generate": "POST /api/auth/token/generate",
      "validate": "POST /api/auth/token/validate",
      "info": "GET /api/auth/info"
    }
  }
}
```

GET `/api/auth/test` (requires `Authorization: Bearer <token>`)
```json
{
  "success": true,
  "message": "Autenticacao bem-sucedida!",
  "data": { "authenticatedUser": {}, "timestamp": "2025-01-01T00:00:00.000Z" }
}
```

## Conversations

GET `/api/conversations?status=active&search=joao&page=1&limit=10`
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "_id": "65f4c9a4c20a2f2c312a9b1e",
        "identifier": "5511999999999",
        "provider": "whatsapp",
        "name": "Joao Silva",
        "status": "active",
        "archived": false
      }
    ],
    "pagination": { "total": 1, "page": 1, "pageSize": 10, "totalPages": 1 }
  },
  "message": "Conversas recuperadas com sucesso"
}
```

POST `/api/conversations` or `/api/conversations/list`
```json
{ "page": 1, "limit": 10, "status": "active", "search": "joao" }
```
```json
{ "success": true, "data": { "items": [], "pagination": {} } }
```

GET `/api/conversations/:id`
```json
{
  "success": true,
  "data": {
    "_id": "65f4c9a4c20a2f2c312a9b1e",
    "identifier": "5511999999999",
    "provider": "whatsapp",
    "name": "Joao Silva",
    "status": "active",
    "archived": false
  }
}
```

POST `/api/conversations/create`
```json
{ "identifier": "5511999999999", "provider": "whatsapp", "name": "Joao", "photo": null }
```
```json
{ "success": true, "data": { "_id": "...", "identifier": "5511999999999" }, "message": "Conversa criada com sucesso" }
```

PUT `/api/conversations/:id`
```json
{ "name": "Novo nome", "status": "inactive" }
```
```json
{ "success": true, "data": null, "message": "Conversa atualizada com sucesso" }
```

POST `/api/conversations/paginate`
```json
{ "status": "active", "page": 1, "limit": 10 }
```
```json
{ "success": true, "data": { "items": [], "pagination": {} } }
```

PATCH `/api/conversations/:id/archive`
```json
{}
```
```json
{ "success": true, "data": null, "message": "Conversa arquivada com sucesso" }
```

PATCH `/api/conversations/:id/assign-operator`
```json
{ "operatorId": "op_1", "operatorName": "Maria" }
```
```json
{ "success": true, "data": null, "message": "Operador atribuido com sucesso" }
```

## Messages

GET `/api/messages?conversationId=<id>&page=1&limit=20`
```json
{
  "success": true,
  "data": {
    "items": [
      { "_id": "...", "message": "Oi", "type": "text", "direction": "incoming", "status": "sent" }
    ],
    "pagination": { "total": 1, "page": 1, "pageSize": 20, "totalPages": 1 }
  },
  "message": "Mensagens recuperadas com sucesso"
}
```

GET `/api/messages?identifier=5511999999999&provider=whatsapp`
```json
{ "success": true, "data": { "items": [], "pagination": {} } }
```

GET `/api/messages/:id`
```json
{ "success": true, "data": { "_id": "...", "message": "Oi" }, "message": "Mensagem encontrada" }
```

POST `/api/messages/send` (text)
```json
{ "to": "5511999999999", "provider": "whatsapp", "type": "text", "message": "Ola!" }
```
```json
{ "success": true, "data": { "success": true, "messageId": "abc123", "provider": "whatsapp" }, "message": "Mensagem enviada com sucesso" }
```

POST `/api/messages/send` (image by URL)
```json
{
  "to": "5511999999999",
  "provider": "whatsapp",
  "type": "image",
  "mediaUrl": "https://...",
  "caption": "foto"
}
```

POST `/api/messages/send` (list)
```json
{
  "to": "5511999999999",
  "provider": "whatsapp",
  "type": "list",
  "listTitle": "Opcoes",
  "listDescription": "Escolha",
  "listButtonText": "Abrir",
  "listSections": [
    { "title": "A", "rows": [ { "rowId": "1", "title": "Item 1", "description": "desc" } ] }
  ]
}
```

POST `/api/messages/send` (buttons)
```json
{
  "to": "5511999999999",
  "provider": "whatsapp",
  "type": "buttons",
  "buttonsTitle": "Menu",
  "buttonsDescription": "Selecione",
  "buttonsFooter": "Rodape",
  "buttons": [ { "id": "1", "text": "Opcao 1" } ]
}
```

POST `/api/messages/send` (location)
```json
{
  "to": "5511999999999",
  "provider": "whatsapp",
  "type": "location",
  "latitude": -23.55,
  "longitude": -46.63,
  "locationTitle": "Local",
  "locationAddress": "Endereco"
}
```

POST `/api/messages/send` (contact)
```json
{ "to": "5511999999999", "provider": "whatsapp", "type": "contact", "contactId": "contact_1" }
```

PATCH `/api/messages/:id/read`
```json
{}
```
```json
{ "success": true, "data": null, "message": "Mensagem marcada como lida" }
```

GET `/api/messages/:id/media`
```json
{ "success": true, "data": { "mediaUrl": "https://..." }, "message": "Midia recuperada" }
```

DELETE `/api/messages/:id`
```json
{ "success": true, "data": null, "message": "Mensagem deletada com sucesso" }
```

## Bots

GET `/api/bots/list`
```json
{
  "success": true,
  "data": {
    "registered": ["chat", "coopluiza"],
    "active": ["chat"],
    "total": 2,
    "totalActive": 1
  }
}
```

POST `/api/bots/activate`
```json
{ "conversationId": "conv_1", "botId": "chat" }
```
```json
{ "success": true, "message": "Bot chat ativado para conversa conv_1" }
```

POST `/api/bots/deactivate`
```json
{ "conversationId": "conv_1" }
```
```json
{ "success": true, "message": "Bot desativado para conversa conv_1" }
```

GET `/api/bots/session/:conversationId`
```json
{ "success": true, "data": { "conversationId": "conv_1", "botId": "chat", "stage": 0 } }
```

POST `/api/bots/reset`
```json
{ "conversationId": "conv_1" }
```
```json
{ "success": true, "message": "Sessao resetada com sucesso" }
```

POST `/api/bots/reload/:botId`
```json
{}
```
```json
{ "success": true, "message": "Bot chat recarregado com sucesso" }
```

## Bot Export/Import

POST `/api/bots/:botId/export`
```json
{ "exportedBy": "admin", "metadata": { "note": "v1" } }
```
```json
{ "success": true, "data": { "filename": "bot.jn" }, "message": "Bot exportado com sucesso" }
```

POST `/api/bots/import` (multipart/form-data)
```
file: <bot.jn>
```
```json
{ "success": true, "data": { "botId": "chat" }, "message": "Bot importado com sucesso" }
```

GET `/api/bots/exports`
```json
{ "success": true, "exports": [ { "filename": "bot.jn", "filepath": "..." } ] }
```

GET `/api/bots/export/:filename/download`
```json
<binary>
```

GET `/api/bots/export/:filename/info`
```json
{ "success": true, "data": { "filename": "bot.jn", "bot": {} } }
```

DELETE `/api/bots/export/:filename`
```json
{ "success": true, "message": "Arquivo deletado com sucesso" }
```

## WhatsApp

GET `/api/whatsapp/status`
```json
{ "success": true, "data": { "connected": true, "status": "connected" } }
```

GET `/api/whatsapp/qrcode`
```json
{ "success": false, "message": "Consulte os logs do servidor para ver o QR Code" }
```

POST `/api/whatsapp/reconnect`
```json
{}
```
```json
{ "success": true, "message": "Reconexao iniciada" }
```

POST `/api/whatsapp/disconnect`
```json
{}
```
```json
{ "success": true, "message": "WhatsApp desconectado" }
```

## Meta (WhatsApp Business)

GET `/api/meta/webhook` (verification)
Query: `hub.mode`, `hub.verify_token`, `hub.challenge`
Response: `200` with body `hub.challenge` or `403`.

POST `/api/meta/webhook`
```json
{ "entry": [] }
```
```json
200
```

GET `/api/meta/status`
```json
{ "success": true, "data": { "enabled": true, "config": { "phoneNumberId": "...", "apiVersion": "v17.0" } } }
```

POST `/api/meta/send-test`
```json
{ "to": "5511999999999", "message": "teste" }
```
```json
{ "success": true, "data": {}, "message": "Mensagem enviada com sucesso" }
```

## Webhooks

GET `/api/webhooks/events`
```json
{
  "success": true,
  "data": {
    "events": [
      "message.received",
      "message.sent",
      "message.failed",
      "conversation.created",
      "conversation.updated",
      "conversation.archived",
      "conversation.deleted",
      "operator.assigned",
      "operator.removed",
      "bot.started",
      "bot.stopped",
      "queue.updated"
    ]
  }
}
```

GET `/api/webhooks/stats`
```json
{ "success": true, "data": { "totalSent": 0, "totalFailed": 0 } }
```

GET `/api/webhooks?enabled=true&event=message&search=crm&page=1&limit=10`
```json
{ "success": true, "data": { "items": [], "pagination": {} } }
```

GET `/api/webhooks/:id`
```json
{ "success": true, "data": { "_id": "...", "name": "Webhook", "url": "https://..." } }
```

POST `/api/webhooks`
```json
{
  "name": "CRM",
  "url": "https://...",
  "events": ["message"],
  "enabled": true,
  "secret": "optional",
  "headers": { "x-api-key": "123" },
  "retryAttempts": 3,
  "retryDelay": 1000
}
```
```json
{ "success": true, "data": { "_id": "...", "name": "CRM" }, "message": "Webhook criado com sucesso" }
```

PUT `/api/webhooks/:id`
```json
{ "name": "CRM 2", "enabled": false }
```
```json
{ "success": true, "data": null, "message": "Webhook atualizado com sucesso" }
```

DELETE `/api/webhooks/:id`
```json
{ "success": true, "data": null, "message": "Webhook deletado com sucesso" }
```

POST `/api/webhooks/:id/enable`
```json
{}
```
```json
{ "success": true, "data": null, "message": "Webhook ativado com sucesso" }
```

POST `/api/webhooks/:id/disable`
```json
{}
```
```json
{ "success": true, "data": null, "message": "Webhook desativado com sucesso" }
```

POST `/api/webhooks/:id/test`
```json
{}
```
```json
{ "success": true, "data": { "success": true }, "message": "Webhook testado com sucesso" }
```

## Storage (Azure)

GET `/api/storage/config`
```json
{ "success": true, "configs": [ { "_id": "...", "accountName": "acc", "containerName": "nxzap-media" } ] }
```

GET `/api/storage/config/active`
```json
{ "success": true, "config": { "_id": "...", "accountName": "acc", "containerName": "nxzap-media" } }
```

POST `/api/storage/config`
```json
{
  "accountName": "acc",
  "accountKey": "key",
  "containerName": "nxzap-media",
  "connectionString": "...",
  "endpoint": "https://...",
  "isActive": true
}
```
```json
{ "success": true, "config": { "_id": "...", "accountName": "acc", "containerName": "nxzap-media" } }
```

PUT `/api/storage/config/:id`
```json
{ "isActive": true }
```
```json
{ "success": true, "config": { "_id": "...", "accountName": "acc", "containerName": "nxzap-media" } }
```

DELETE `/api/storage/config/:id`
```json
{ "success": true, "message": "Configuracao deletada com sucesso" }
```

POST `/api/storage/upload/file` (multipart/form-data)
```
file: <binary>
userId: "system"
```
```json
{ "success": true, "result": { "url": "...", "blobName": "...", "container": "...", "size": 123 } }
```

POST `/api/storage/upload/base64`
```json
{ "base64Data": "data:...base64,...", "fileName": "img.png", "contentType": "image/png" }
```
```json
{ "success": true, "result": { "url": "...", "blobName": "...", "container": "...", "size": 123 } }
```

POST `/api/storage/upload/url`
```json
{ "url": "https://...", "fileName": "img.png", "contentType": "image/png" }
```
```json
{ "success": true, "result": { "url": "...", "blobName": "...", "container": "...", "size": 123 } }
```

DELETE `/api/storage/blob/:blobName`
```json
{ "success": true, "message": "Blob deletado com sucesso" }
```

GET `/api/storage/blobs?prefix=2025/`
```json
{ "success": true, "blobs": ["a.png", "b.png"], "count": 2 }
```

GET `/api/storage/status`
```json
{ "success": true, "configured": true, "provider": "azure_blob", "containerName": "nxzap-media" }
```

## Expenses

GET `/api/expenses?cliente=ABC&search=x&page=1&limit=10`
```json
{
  "success": true,
  "data": {
    "items": [
      { "_id": "...", "cliente": "ABC", "obra": "Obra 1", "valor": 123.45 }
    ],
    "pagination": { "total": 1, "page": 1, "pageSize": 10, "totalPages": 1 }
  }
}
```

POST `/api/expenses/list`
```json
{ "cliente": "ABC", "page": 1, "limit": 10 }
```
```json
{ "success": true, "data": { "items": [], "pagination": {} } }
```

GET `/api/expenses/weekly-sheet?cliente=ABC&data=2025-01-01`
```json
{
  "success": true,
  "data": {
    "periodo": { "inicio": "2025-01-03", "fim": "2025-01-09" },
    "totalItens": 0,
    "totalValor": 0,
    "itens": []
  }
}
```

GET `/api/expenses/clients?search=AB`
```json
{ "success": true, "data": ["ABC", "ABD"] }
```

GET `/api/expenses/:id`
```json
{ "success": true, "data": { "_id": "...", "cliente": "ABC", "valor": 123.45 } }
```

POST `/api/expenses`
```json
{
  "obra": "Obra 1",
  "cliente": "ABC",
  "documentoVinculado": "NF123",
  "dataVencimento": "2025-01-01",
  "descricao": "Material",
  "tipoDespesa": "Compra",
  "centroCusto": "CC1",
  "valor": 123.45,
  "semNotaEmitida": false,
  "dependeFechamentoLoja": false
}
```
```json
{ "success": true, "data": { "_id": "...", "cliente": "ABC" }, "message": "Despesa criada com sucesso" }
```

PUT `/api/expenses/:id`
```json
{ "descricao": "Atualizada", "valor": 200.0 }
```
```json
{ "success": true, "data": null, "message": "Despesa atualizada com sucesso" }
```

