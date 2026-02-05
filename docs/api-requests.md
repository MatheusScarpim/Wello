# welloChat API Request Reference

Base URL defaults to `http://localhost:8081`. Override the port through the `HTTP_PORT` environment variable.

---

## Health & Status
- **GET `/health`** — Returns uptime, timestamp, and memory usage for the running process.
- **GET `/status`** — Lightweight service status with API version metadata.

---

## Auth API (`/api/auth`)
- **POST `/token/generate`** — Body requires `userId`; optional `email`, `role`, `expiresIn`, `description`. Responds with a JWT plus usage hints.
- **POST `/token/validate`** — Body requires `token`. Validates/decodes a JWT using the same middleware used for protected routes.
- **GET `/info`** — Describes the authentication scheme, expected headers, and default expiration.
- **GET `/test`** — Protected sample endpoint; requires `Authorization: Bearer <token>`.

---

## Conversations API (`/api/conversations`)
- **GET `/`**, **POST `/`**, **POST `/list`** — List conversations with pagination. Accepts `page`, `limit`, optional `status`, `search`. Returns `{ items, pagination }`.
- **GET `/:id`** — Fetch conversation by Mongo `_id`.
- **POST `/create`** — Body requires `identifier` and `provider`; optional `name`, `photo`. Creates a new record or returns the existing one.
- **PUT `/:id`** — Partial update; payload keys are applied with `$set`.
- **POST `/paginate`** — Body filters: `status`, `provider`, `operatorId`, `archived`, `search` plus `page`, `limit`. Returns `{ items, pagination }`.
- **PATCH `/:id/archive`** — Archives the conversation.
- **PATCH `/:id/assign-operator`** — Body requires `operatorId`, optional `operatorName`. Empty `operatorId` is not supported (use `PUT` to clear).

---

## Messages API (`/api/messages`)
- **GET `/`** — Requires `conversationId`. Optional `page`, `limit`. Returns `{ items, pagination }` sorted by `createdAt` descending.
- **GET `/:id`** — Message detail lookup.
- **POST `/send`** — Requires `to`. Supports WhatsApp and Meta payloads (`message`, `type`, `mediaUrl`, `mediaBase64`, `caption`, `filename`, `quotedMessageId`, list/button payloads, location, contacts, Meta credentials). Persists the outgoing message on success. Examples:

  ```bash
  # JSON text message (WhatsApp default)
  curl -X POST http://localhost:8081/api/messages/send \
       -H "Content-Type: application/json" \
       -d '{
         "to": "5511999999999",
         "message": "Olá, tudo bem?",
         "provider": "whatsapp",
         "type": "text"
       }'
  ```

  ```bash
  # Image message with caption
  curl -X POST http://localhost:8081/api/messages/send \
       -H "Content-Type: application/json" \
       -d '{
         "to": "5511999999999",
         "provider": "whatsapp",
         "type": "image",
         "mediaUrl": "https://example.com/imagem.jpg",
         "caption": "Confira a imagem!"
       }'
  ```

  ```bash
  # Meta WhatsApp message (send through Meta cloud API credentials)
  curl -X POST http://localhost:8081/api/messages/send \
       -H "Content-Type: application/json" \
       -d '{
         "to": "5511999999999",
         "provider": "meta_whatsapp",
         "type": "text",
         "message": "Mensagem via Meta",
         "metaAccessToken": "EAAG...",
         "metaPhoneNumberId": "1234567890",
         "metaApiVersion": "v20.0"
       }'
  ```

- Supports multipart form data for media uploads when hosting files locally (send `mediaBase64` or convert to file upload using `FormData`).
- **PATCH `/:id/read`** — Sets `isRead = true` and `status = 'read'`.
- **GET `/:id/media`** — Returns media metadata (`url`, `type`, `messageId`) when available.
- **DELETE `/:id`** — Deletes the message document.

---

## Bots API (`/api/bots`)
- **GET `/list`** — Lists registered bots, active bots, and totals.
- **POST `/activate`** — Body requires `conversationId`, `botId`. Starts a bot session at stage `0`.
- **POST `/deactivate`** — Body requires `conversationId`. Ends the active session.
- **GET `/session/:conversationId`** — Returns the active bot session, if any.
- **POST `/reset`** — Body requires `conversationId`. Resets stage to `0` and clears session data.
- **POST `/reload/:botId`** — Reloads a bot implementation from disk.

---

## WhatsApp API (`/api/whatsapp`)
- **GET `/status`** — Connection flag (`connected`) and status string.
- **GET `/qrcode`** — Indicates whether WhatsApp is already connected; QR retrieval currently logged to the console.
- **POST `/reconnect`** — Forces a disconnect/reconnect cycle.
- **POST `/disconnect`** — Terminates the WhatsApp session.

---

## Meta API (`/api/meta`)
- **GET `/webhook`** — Verification handler. Query params: `hub.mode`, `hub.verify_token`, `hub.challenge`. Responds with the challenge when the token matches `META_VERIFY_TOKEN`.
- **POST `/webhook`** — Receives Meta webhook events (always respond `200` if processing succeeds).
- **GET `/status`** — Reports provider enablement and core configuration values.
- **POST `/send-test`** — Body requires `to`, `message`. Sends a test text message via Meta.

---

## Storage API (`/api/storage`)

### Configuration Management
- **GET `/config`** — Lists all storage configurations (without sensitive credentials).
- **GET `/config/active`** — Returns the currently active storage configuration.
- **POST `/config`** — Creates a new storage configuration. Body requires:
  - `accountName`: Azure Storage account name
  - `accountKey`: Azure Storage account key
  - `containerName`: Container name (default: `nxzap-media`)
  - `connectionString`: (optional) Full Azure connection string
  - `endpoint`: (optional) Custom endpoint URL
  - `isActive`: Boolean to set as active configuration

  Example:
  ```bash
  curl -X POST http://localhost:8081/api/storage/config \
       -H "Content-Type: application/json" \
       -d '{
         "accountName": "mystorageaccount",
         "accountKey": "key123...",
         "containerName": "nxzap-media",
         "isActive": true
       }'
  ```

- **PUT `/config/:id`** — Updates an existing configuration. Accepts same fields as POST.
- **DELETE `/config/:id`** — Deletes a storage configuration.

### File Upload
- **POST `/upload/file`** — Uploads a file using multipart/form-data. Form fields:
  - `file`: The file to upload (required)
  - `userId`: User ID for metadata (optional)

  Example:
  ```bash
  curl -X POST http://localhost:8081/api/storage/upload/file \
       -F "file=@image.jpg" \
       -F "userId=user123"
  ```

- **POST `/upload/base64`** — Uploads a file from base64 string. Body:
  - `base64Data`: Base64-encoded file data (with or without data URI prefix)
  - `fileName`: Original filename (optional)
  - `contentType`: MIME type (optional)

  Example:
  ```bash
  curl -X POST http://localhost:8081/api/storage/upload/base64 \
       -H "Content-Type: application/json" \
       -d '{
         "base64Data": "data:image/jpeg;base64,/9j/4AAQ...",
         "fileName": "photo.jpg",
         "contentType": "image/jpeg"
       }'
  ```

- **POST `/upload/url`** — Downloads and uploads a file from an external URL. Body:
  - `url`: Source URL (required)
  - `fileName`: Target filename (optional)
  - `contentType`: MIME type override (optional)

  Example:
  ```bash
  curl -X POST http://localhost:8081/api/storage/upload/url \
       -H "Content-Type: application/json" \
       -d '{
         "url": "https://example.com/image.jpg",
         "fileName": "downloaded-image.jpg"
       }'
  ```

### Blob Management
- **DELETE `/blob/:blobName`** — Deletes a blob from storage.
- **GET `/blobs`** — Lists all blobs in the container. Query params:
  - `prefix`: Filter blobs by name prefix (optional)
- **GET `/status`** — Returns storage service status and configuration summary.

### Media Upload Middleware
When sending messages via `/api/messages/send`, media files (`mediaBase64` or `mediaUrl`) are automatically uploaded to Azure Blob Storage if:
- Message `type` is one of: `image`, `video`, `audio`, `document`, `sticker`
- Azure Storage is configured and initialized
- The middleware processes the upload and replaces the URL with the Azure blob URL

---

## Webhook + System Utilities
- **POST `/api/auth/token/validate`** (listed above) allows indirect verification without touching real endpoints.
- Internal modules such as `WebhookManager` emit events (`message`, `connection`, `status`, `error`) when WhatsApp events occur.

