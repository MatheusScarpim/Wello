# Configuração do Azure Blob Storage

Este guia explica como configurar o Azure Blob Storage para armazenar arquivos de mídia (imagens, vídeos, documentos, etc.) enviados através do sistema.

## Instalação

Primeiro, instale a dependência necessária:

```bash
npm install @azure/storage-blob
# ou
pnpm add @azure/storage-blob
```

## Criando uma conta no Azure Storage

1. Acesse o [Portal do Azure](https://portal.azure.com)
2. Crie uma nova Storage Account:
   - Vá em "Storage accounts" > "Create"
   - Escolha um nome único (ex: `nxzapstorage`)
   - Selecione a região mais próxima
   - Performance: Standard
   - Redundancy: LRS (Locally Redundant Storage) para desenvolvimento

3. Após criar, vá em "Access keys" para obter:
   - **Account name**: Nome da conta
   - **Key**: Uma das chaves de acesso (key1 ou key2)

## Configuração via API

### 1. Criar configuração

Faça uma requisição POST para criar a configuração:

```bash
curl -X POST http://20.109.17.147:8091/api/storage/config \
     -H "Content-Type: application/json" \
     -d '{
       "accountName": "nxzapstorage",
       "accountKey": "sua-chave-aqui==",
       "containerName": "nxzap-media",
       "isActive": true
     }'
```

### 2. Verificar status

```bash
curl http://20.109.17.147:8091/api/storage/status
```

Deve retornar:
```json
{
  "success": true,
  "configured": true,
  "provider": "azure_blob",
  "containerName": "nxzap-media"
}
```

## Uso Automático

Após configurado, o sistema automaticamente faz upload de mídias para o Azure em **duas situações**:

### 1. Ao ENVIAR mensagens (via API)

Quando você envia mensagens via `/api/messages/send` com mídia:

#### Exemplo com base64

```bash
curl -X POST http://20.109.17.147:8091/api/messages/send \
     -H "Content-Type: application/json" \
     -d '{
       "to": "5511999999999",
       "type": "image",
       "mediaBase64": "data:image/jpeg;base64,/9j/4AAQ...",
       "caption": "Imagem enviada automaticamente para Azure!"
     }'
```

O middleware automaticamente:
1. Detecta que é uma mídia (type: image)
2. Faz upload para o Azure Blob Storage
3. Substitui o `mediaBase64` por `mediaUrl` do Azure
4. Envia a mensagem com a URL pública

### Exemplo com URL externa

```bash
curl -X POST http://20.109.17.147:8091/api/messages/send \
     -H "Content-Type: application/json" \
     -d '{
       "to": "5511999999999",
       "type": "image",
       "mediaUrl": "https://example.com/image.jpg",
       "caption": "Imagem baixada e enviada para Azure!"
     }'
```

O middleware automaticamente:
1. Baixa a imagem da URL externa
2. Faz upload para o Azure Blob Storage
3. Substitui a URL externa pela URL do Azure
4. Envia a mensagem

### 2. Ao RECEBER mensagens (WhatsApp e Meta)

Quando alguém **envia uma mídia para o bot** via WhatsApp (wppconnect) ou Meta:

#### WhatsApp (WPPConnect)

Quando um usuário envia uma imagem/vídeo/documento via WhatsApp:

1. O sistema detecta que é uma mídia
2. Faz download da mídia usando wppconnect
3. Faz upload automático para o Azure Blob Storage
4. Salva a mensagem no banco com a URL do Azure
5. A mídia fica disponível publicamente via URL do Azure

#### Meta WhatsApp

Quando um usuário envia uma mídia via Meta API:

1. O sistema detecta que é uma mídia
2. Obtém a URL temporária da mídia da Meta
3. Baixa a mídia usando o access token
4. Faz upload automático para o Azure Blob Storage
5. Salva a mensagem no banco com a URL do Azure
6. A mídia fica disponível permanentemente (Meta URLs expiram em 24h)

**Tipos de mídia suportados:**
- `image` - Imagens (JPG, PNG, etc.)
- `video` - Vídeos (MP4, etc.)
- `audio` / `ptt` - Áudios e mensagens de voz
- `document` - Documentos (PDF, DOCX, etc.)
- `sticker` - Figurinhas

**Estrutura da mensagem salva:**

```json
{
  "_id": "...",
  "conversationId": "...",
  "message": "Legenda da mídia",
  "type": "image",
  "mediaUrl": "https://nxzapstorage.blob.core.windows.net/nxzap-media/1234567890-abc.jpg",
  "mediaStorage": {
    "provider": "azure_blob",
    "blobName": "1234567890-abc.jpg",
    "container": "nxzap-media",
    "size": 245678,
    "originalUrl": "https://example.com/original.jpg" // Apenas para Meta
  },
  "direction": "incoming",
  "status": "sent",
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

## Upload Manual de Arquivos

### Upload de arquivo (multipart)

```bash
curl -X POST http://20.109.17.147:8091/api/storage/upload/file \
     -F "file=@/caminho/para/imagem.jpg" \
     -F "userId=user123"
```

### Upload de base64

```bash
curl -X POST http://20.109.17.147:8091/api/storage/upload/base64 \
     -H "Content-Type: application/json" \
     -d '{
       "base64Data": "data:image/jpeg;base64,/9j/4AAQ...",
       "fileName": "foto.jpg",
       "contentType": "image/jpeg"
     }'
```

### Upload de URL

```bash
curl -X POST http://20.109.17.147:8091/api/storage/upload/url \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://example.com/image.jpg",
       "fileName": "download.jpg"
     }'
```

## Gerenciamento de Blobs

### Listar blobs

```bash
curl http://20.109.17.147:8091/api/storage/blobs
```

### Deletar blob

```bash
curl -X DELETE http://20.109.17.147:8091/api/storage/blob/1234567890-abc123.jpg
```

## Múltiplas Configurações

Você pode ter múltiplas configurações salvas, mas apenas uma ativa por vez:

```bash
# Criar segunda configuração (inativa)
curl -X POST http://20.109.17.147:8091/api/storage/config \
     -H "Content-Type: application/json" \
     -d '{
       "accountName": "nxzapstorage2",
       "accountKey": "outra-chave==",
       "containerName": "backup-media",
       "isActive": false
     }'

# Ativar a segunda configuração
curl -X PUT http://20.109.17.147:8091/api/storage/config/ID_DA_CONFIG \
     -H "Content-Type: application/json" \
     -d '{"isActive": true}'
```

## Segurança

- As chaves de acesso (`accountKey`, `connectionString`) nunca são retornadas nas APIs GET
- Configure CORS no Azure Storage se necessário para acesso direto do frontend
- Use SAS tokens para acesso temporário se necessário
- O container é criado com acesso público aos blobs (não à listagem)

## Troubleshooting

### Erro: "Nenhuma configuração de storage ativa encontrada"

Execute:
```bash
curl http://20.109.17.147:8091/api/storage/config/active
```

Se não houver configuração ativa, crie uma nova ou ative uma existente.

### Erro: "Azure Storage Service não está inicializado"

Reinicie a aplicação após criar a configuração. O serviço é inicializado no boot.

### Mídia não está sendo enviada para o Azure

Verifique:
1. Se a configuração está ativa: `GET /api/storage/status`
2. Se o tipo da mensagem requer mídia: `image`, `video`, `audio`, `document`, `sticker`
3. Se há erros nos logs do servidor

### URLs do Azure não estão acessíveis

Verifique as configurações de rede e firewall da Storage Account no Portal do Azure.

## Custo

O Azure Blob Storage tem custo baseado em:
- Armazenamento usado (GB/mês)
- Operações (uploads, downloads, listagens)
- Transferência de dados

Para desenvolvimento/testes, o custo é geralmente muito baixo (< $1/mês).

## Alternativas

Se não quiser usar Azure Blob Storage, você pode:
1. Usar armazenamento local (não recomendado para produção)
2. Implementar outros provedores (S3, Google Cloud Storage, etc.)
3. Usar CDNs especializadas para mídia

