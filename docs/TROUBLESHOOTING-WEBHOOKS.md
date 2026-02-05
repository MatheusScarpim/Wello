# Troubleshooting - Webhooks Causando Lentidão

## Problema: Mensagens não estão sendo enviadas após ativar webhooks

### Sintoma
Após configurar webhooks, o envio de mensagens fica lento ou para de funcionar, causando timeouts de 30 segundos.

### Causa
Os webhooks podem estar demorando muito para responder (ou não respondendo), e isso está bloqueando o envio de mensagens porque o sistema está aguardando os webhooks completarem.

### Solução Rápida

#### Opção 1: Desativar Todos os Webhooks Temporariamente

```bash
# Liste todos os webhooks
curl http://localhost:3000/api/webhooks

# Desative cada webhook (substitua {ID} pelo ID do webhook)
curl -X POST http://localhost:3000/api/webhooks/{ID}/disable
```

#### Opção 2: Deletar Webhooks Problemáticos

```bash
# Delete o webhook (substitua {ID} pelo ID do webhook)
curl -X DELETE http://localhost:3000/api/webhooks/{ID}
```

#### Opção 3: Verificar URLs dos Webhooks

Certifique-se de que as URLs dos webhooks estão respondendo rapidamente:

```bash
# Teste manualmente a URL
curl -X POST https://sua-url-webhook.com/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

Se a URL não responder em menos de 5 segundos, ela provavelmente está causando o problema.

### Verificações

1. **Liste webhooks ativos:**
   ```bash
   curl http://localhost:3000/api/webhooks?enabled=true
   ```

2. **Verifique estatísticas:**
   ```bash
   curl http://localhost:3000/api/webhooks/{ID}
   ```

   Se `totalFailed` está alto, esse webhook está problemático.

3. **Teste individualmente:**
   ```bash
   curl -X POST http://localhost:3000/api/webhooks/{ID}/test
   ```

   Se demorar mais de 5 segundos, desative-o.

### Configuração Recomendada

Para webhooks que podem ser lentos, configure timeouts menores:

```bash
curl -X PUT http://localhost:3000/api/webhooks/{ID} \
  -H "Content-Type: application/json" \
  -d '{
    "retryAttempts": 1,
    "retryDelay": 500
  }'
```

### Prevenção

1. **Use URLs HTTPS confiáveis**: Sempre use endpoints que respondem rapidamente
2. **Teste antes de ativar**: Use o endpoint `/test` antes de ativar em produção
3. **Monitore estatísticas**: Verifique `totalFailed` regularmente
4. **Desative webhooks inativos**: Se um webhook falha consistentemente, desative-o

### Modo Assíncrono para Envio de Mensagens

Se você precisa enviar mensagens sem esperar, use o modo assíncrono:

```bash
curl -X POST http://localhost:3000/api/messages/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "5511999999999",
    "message": "Olá!",
    "async": true
  }'
```

Com `"async": true`, a API responde imediatamente sem aguardar o envio completar.

### Logs Úteis

Verifique os logs do NxZap para identificar webhooks lentos:

```
⚠️  Webhook 672a... falhou (tentativa 1/3). Tentando novamente em 1000ms...
❌ Erro ao disparar webhooks: timeout
```

### Comandos de Emergência

**Desabilitar TODOS os webhooks (emergência):**

```bash
# Via MongoDB (se tiver acesso direto)
db.webhooks.updateMany({}, {$set: {enabled: false}})
```

**Verificar se há webhooks cadastrados:**

```bash
curl http://localhost:3000/api/webhooks/stats
```

Se `total` > 0, há webhooks cadastrados que podem estar causando o problema.

## Como os Webhooks Devem Funcionar

Os webhooks são disparados de forma **assíncrona** após salvar a mensagem:

1. Mensagem é salva no banco ✅
2. Resposta é enviada ao cliente ✅
3. Webhooks são disparados em background (não deveria bloquear)

Se os webhooks estão bloqueando o envio, pode ser um bug. Neste caso:

1. Desative todos os webhooks
2. Teste o envio de mensagens
3. Se funcionar, o problema é com os webhooks
4. Reative um por um testando cada um

## Suporte

Se o problema persistir mesmo sem webhooks ativos, o problema pode estar em outro lugar. Verifique:

- Conexão com WhatsApp
- Conexão com banco de dados MongoDB
- Logs de erro no console do NxZap
