# Sistema de Exportação e Importação de Bots (.jn)

Este documento descreve como usar o sistema de exportação e importação de bots usando arquivos no formato `.jn` (JuNexum).

## O que é um arquivo .jn?

Um arquivo `.jn` é um formato personalizado de exportação de bots do welloChat. Ele contém:

- Configuração completa do bot
- Todos os estágios e fluxos de conversação
- Validações e regras de negócio
- Metadados e informações adicionais
- Checksum para validação de integridade

## Endpoints da API

### 1. Exportar um Bot

**Endpoint:** `POST /api/bots/:botId/export`

**Descrição:** Exporta um bot existente para arquivo `.jn`

**Parâmetros:**
- `botId` (path) - ID do bot a ser exportado

**Body:**
```json
{
  "exportedBy": "nome.usuario@empresa.com",
  "metadata": {
    "author": "Nome do Autor",
    "tags": ["atendimento", "coopluiza"],
    "category": "Atendimento"
  }
}
```

**Resposta de Sucesso:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "filename": "coopluiza_1234567890.jn",
    "filepath": "C:\\path\\to\\exports\\coopluiza_1234567890.jn",
    "message": "Bot \"CoopLuiza Atendimento\" exportado com sucesso!"
  }
}
```

**Exemplo de uso:**
```bash
curl -X POST http://localhost:3000/api/bots/coopluiza/export \
  -H "Content-Type: application/json" \
  -d '{
    "exportedBy": "admin@empresa.com",
    "metadata": {
      "author": "Equipe Dev",
      "tags": ["producao"]
    }
  }'
```

---

### 2. Importar um Bot

**Endpoint:** `POST /api/bots/import`

**Descrição:** Importa um bot a partir de um arquivo `.jn`

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file` - Arquivo `.jn` (máximo 5MB)

**Resposta de Sucesso:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "botId": "coopluiza",
    "message": "Bot \"CoopLuiza Atendimento\" importado com sucesso!",
    "warnings": []
  }
}
```

**Resposta de Erro:**
```json
{
  "success": false,
  "error": "Estrutura do bot inválida",
  "data": {
    "errors": [
      "Bot ID é obrigatório",
      "Estágio inicial não encontrado"
    ],
    "warnings": []
  }
}
```

**Exemplo de uso com curl:**
```bash
curl -X POST http://localhost:3000/api/bots/import \
  -F "file=@coopluiza_1234567890.jn"
```

**Exemplo de uso com Postman:**
1. Selecione método POST
2. URL: `http://localhost:3000/api/bots/import`
3. Vá para a aba "Body"
4. Selecione "form-data"
5. Adicione uma chave "file" do tipo "File"
6. Selecione o arquivo `.jn`
7. Clique em "Send"

---

### 3. Listar Arquivos Exportados

**Endpoint:** `GET /api/bots/exports`

**Descrição:** Lista todos os arquivos `.jn` exportados

**Resposta:**
```json
{
  "success": true,
  "data": {
    "exports": [
      {
        "filename": "coopluiza_1234567890.jn",
        "filepath": "C:\\path\\to\\exports\\coopluiza_1234567890.jn",
        "bot": {
          "id": "coopluiza",
          "name": "CoopLuiza Atendimento",
          "description": "Bot de atendimento da CoopLuiza",
          "version": "1.0.0"
        }
      }
    ],
    "count": 1
  }
}
```

**Exemplo de uso:**
```bash
curl http://localhost:3000/api/bots/exports
```

---

### 4. Download de Arquivo Exportado

**Endpoint:** `GET /api/bots/export/:filename/download`

**Descrição:** Faz download de um arquivo `.jn` exportado

**Parâmetros:**
- `filename` (path) - Nome do arquivo (ex: `coopluiza_1234567890.jn`)

**Resposta:** Download direto do arquivo

**Exemplo de uso:**
```bash
curl -O http://localhost:3000/api/bots/export/coopluiza_1234567890.jn/download
```

**No navegador:**
```
http://localhost:3000/api/bots/export/coopluiza_1234567890.jn/download
```

---

### 5. Informações do Arquivo

**Endpoint:** `GET /api/bots/export/:filename/info`

**Descrição:** Obtém informações sobre um arquivo `.jn` sem fazer download

**Resposta:**
```json
{
  "success": true,
  "data": {
    "filename": "coopluiza_1234567890.jn",
    "fileVersion": "1.0.0",
    "exportDate": "2025-10-29T12:00:00.000Z",
    "exportedBy": "admin@empresa.com",
    "bot": {
      "id": "coopluiza",
      "name": "CoopLuiza Atendimento",
      "description": "Bot de atendimento da CoopLuiza",
      "version": "1.0.0",
      "stageCount": 7,
      "metadata": {
        "author": "Equipe Dev",
        "tags": ["producao"]
      }
    }
  }
}
```

---

### 6. Deletar Arquivo Exportado

**Endpoint:** `DELETE /api/bots/export/:filename`

**Descrição:** Deleta um arquivo `.jn` exportado

**Parâmetros:**
- `filename` (path) - Nome do arquivo a ser deletado

**Resposta:**
```json
{
  "success": true,
  "message": "Export deletado com sucesso"
}
```

**Exemplo de uso:**
```bash
curl -X DELETE http://localhost:3000/api/bots/export/coopluiza_1234567890.jn
```

---

## Estrutura do Arquivo .jn

```json
{
  "fileVersion": "1.0.0",
  "exportDate": "2025-10-29T12:00:00.000Z",
  "exportedBy": "admin@empresa.com",
  "bot": {
    "id": "coopluiza",
    "name": "CoopLuiza Atendimento",
    "description": "Bot de atendimento da CoopLuiza",
    "version": "1.0.0",
    "createdAt": "2025-10-29T12:00:00.000Z",
    "updatedAt": "2025-10-29T12:00:00.000Z",
    "initialStage": 0,
    "sessionTimeout": 1440,
    "enableAnalytics": true,
    "stages": [
      {
        "stageNumber": 0,
        "description": "Mensagem de boas-vindas",
        "type": "message",
        "content": {
          "message": "Olá! Bem-vindo ao atendimento..."
        },
        "nextStage": 1
      }
    ],
    "metadata": {
      "author": "Equipe Dev",
      "tags": ["atendimento", "coopluiza"],
      "category": "Atendimento"
    }
  },
  "checksum": "abc123def456..."
}
```

## Fluxo de Trabalho Recomendado

### Exportar um Bot Existente

1. Liste os bots disponíveis (se necessário)
2. Exporte o bot desejado usando o endpoint de exportação
3. Baixe o arquivo `.jn` gerado
4. Guarde o arquivo em local seguro

### Importar um Bot

1. Prepare o arquivo `.jn`
2. (Opcional) Verifique as informações do arquivo antes de importar
3. Faça upload do arquivo através do endpoint de importação
4. Verifique o resultado da importação
5. Teste o bot importado

### Backup e Versionamento

1. Exporte seus bots regularmente
2. Nomeie os arquivos de forma descritiva
3. Use o campo `metadata` para adicionar informações de versão
4. Mantenha histórico de versões anteriores

## Validações

O sistema valida automaticamente:

- ✅ Extensão do arquivo (deve ser `.jn`)
- ✅ Tamanho do arquivo (máximo 5MB)
- ✅ Versão do formato do arquivo
- ✅ Checksum para integridade
- ✅ Estrutura do bot
- ✅ Campos obrigatórios
- ✅ Referências entre estágios

## Segurança

- Arquivos são validados antes da importação
- Nomes de arquivos são sanitizados
- Path traversal é bloqueado
- Limite de tamanho de arquivo
- Validação de extensão
- Checksum para garantir integridade

## Limitações Atuais

- A implementação dinâmica completa de bots importados ainda está em desenvolvimento
- Os bots importados precisam ser convertidos manualmente em classes TypeScript
- Recomenda-se usar a exportação principalmente para backup e migração entre ambientes

## Próximos Passos

Para usar totalmente um bot importado, você precisará:

1. Analisar o arquivo `.jn`
2. Criar uma classe de bot baseada na estrutura
3. Implementar os estágios conforme o arquivo
4. Registrar o bot no `BotFactory`

## Suporte

Em caso de dúvidas ou problemas:
- Verifique os logs do servidor
- Consulte a documentação da API
- Entre em contato com a equipe de desenvolvimento

