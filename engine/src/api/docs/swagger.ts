const port = Number(process.env.HTTP_PORT || 8081)
const host = process.env.HTTP_HOST || 'localhost'

const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'welloChat API',
    version: '2.0.0',
    description:
      'Documentacao dos endpoints HTTP utilizados pelo welloChat (bots, mensagens, webhooks, storage e despesas).',
  },
  servers: [
    {
      url: `http://localhost:${port}`,
      description: 'Ambiente local (porta configurada em HTTP_PORT)',
    },
    {
      url: '{scheme}://{host}:{port}',
      description: 'Ambiente customizado',
      variables: {
        scheme: {
          default: 'http',
          enum: ['http', 'https'],
        },
        host: {
          default: host,
        },
        port: {
          default: String(port),
        },
      },
    },
  ],
  tags: [
    { name: 'Health', description: 'Status do servidor' },
    { name: 'Auth', description: 'Autenticacao e validacao de token' },
    { name: 'Conversations', description: 'Gestao de conversas' },
    { name: 'Messages', description: 'Envio e leitura de mensagens' },
    { name: 'Bots', description: 'Gerenciamento de bots e sessoes' },
    {
      name: 'Bot Export/Import',
      description: 'Exportacao e importacao de bots (.jn)',
    },
    { name: 'WhatsApp', description: 'Controle de conexao com o WhatsApp' },
    { name: 'Meta', description: 'Webhook e envio via Meta WhatsApp Business' },
    { name: 'Webhooks', description: 'Cadastro e teste de webhooks' },
    {
      name: 'Storage',
      description: 'Uploads e configuracoes de armazenamento',
    },
    { name: 'Expenses', description: 'Gestao de despesas' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Pagination: {
        type: 'object',
        properties: {
          total: { type: 'integer', example: 120 },
          page: { type: 'integer', example: 1 },
          pageSize: { type: 'integer', example: 20 },
          totalPages: { type: 'integer', example: 6 },
        },
      },
      Conversation: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '65f4c9a4c20a2f2c312a9b1e' },
          identifier: { type: 'string', example: '5511999999999' },
          provider: { type: 'string', example: 'whatsapp' },
          name: { type: 'string', example: 'Joao Silva' },
          photo: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['active', 'waiting', 'inactive', 'blocked', 'finalized'] },
          archived: { type: 'boolean' },
          unreadCount: { type: 'integer' },
          operatorId: { type: 'string', nullable: true },
          operatorName: { type: 'string', nullable: true },
          lastMessageAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          lastMessage: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Message: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          conversationId: { type: 'string' },
          message: { type: 'string' },
          type: { type: 'string', example: 'text' },
          direction: { type: 'string', enum: ['incoming', 'outgoing'] },
          status: {
            type: 'string',
            enum: ['sent', 'delivered', 'read', 'failed'],
          },
          messageId: { type: 'string', nullable: true },
          quotedMessageId: { type: 'string', nullable: true },
          mediaUrl: { type: 'string', nullable: true },
          mediaStorage: {
            type: 'object',
            nullable: true,
            properties: {
              provider: { type: 'string', example: 'azure_blob' },
              blobName: { type: 'string' },
              container: { type: 'string' },
              size: { type: 'integer' },
              originalUrl: { type: 'string' },
            },
          },
          isRead: { type: 'boolean' },
          readAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      SendMessageRequest: {
        type: 'object',
        required: ['to'],
        properties: {
          to: {
            type: 'string',
            description: 'Destino (numero, id etc)',
            example: '5511999999999',
          },
          message: { type: 'string', example: 'Ola!' },
          provider: {
            type: 'string',
            enum: ['whatsapp', 'meta_whatsapp', 'telegram'],
            default: 'whatsapp',
          },
          type: {
            type: 'string',
            enum: [
              'text',
              'image',
              'document',
              'audio',
              'video',
              'list',
              'buttons',
              'location',
              'contact',
            ],
            default: 'text',
          },
          async: {
            type: 'boolean',
            description:
              'Se true, responde imediatamente e envia em background',
            default: false,
          },
          mediaUrl: { type: 'string' },
          mediaBase64: { type: 'string' },
          caption: { type: 'string' },
          filename: { type: 'string' },
          quotedMessageId: { type: 'string' },
          listTitle: { type: 'string' },
          listDescription: { type: 'string' },
          listButtonText: { type: 'string' },
          listSections: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                rows: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      rowId: { type: 'string' },
                      title: { type: 'string' },
                      description: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
          buttonsTitle: { type: 'string' },
          buttonsDescription: { type: 'string' },
          buttonsFooter: { type: 'string' },
          buttons: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                text: { type: 'string' },
              },
            },
          },
          latitude: { type: 'number', format: 'double' },
          longitude: { type: 'number', format: 'double' },
          locationTitle: { type: 'string' },
          locationAddress: { type: 'string' },
          contactId: { type: 'string' },
          metaAccessToken: { type: 'string' },
          metaPhoneNumberId: { type: 'string' },
          metaApiVersion: { type: 'string' },
          metaBaseUrl: { type: 'string' },
        },
      },
      SendMessageResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          messageId: { type: 'string', nullable: true },
          mediaId: { type: 'string', nullable: true },
          provider: { type: 'string' },
          error: { type: 'string', nullable: true },
        },
      },
      Webhook: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          url: { type: 'string' },
          events: { type: 'array', items: { type: 'string' } },
          enabled: { type: 'boolean' },
          secret: { type: 'string', nullable: true },
          headers: { type: 'object', additionalProperties: { type: 'string' } },
          retryAttempts: { type: 'integer', example: 3 },
          retryDelay: { type: 'integer', example: 1000 },
          lastTriggeredAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          totalSent: { type: 'integer' },
          totalFailed: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      StorageConfig: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          provider: { type: 'string', example: 'azure_blob' },
          accountName: { type: 'string' },
          containerName: { type: 'string' },
          endpoint: { type: 'string', nullable: true },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      StorageUploadResult: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          blobName: { type: 'string' },
          container: { type: 'string' },
          size: { type: 'integer' },
        },
      },
      Expense: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          obra: { type: 'string' },
          cliente: { type: 'string' },
          documentoVinculado: { type: 'string' },
          dataVencimento: { type: 'string', format: 'date' },
          descricao: { type: 'string' },
          tipoDespesa: { type: 'string' },
          centroCusto: { type: 'string' },
          valor: { type: 'number', format: 'double' },
          semNotaEmitida: { type: 'boolean' },
          dependeFechamentoLoja: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      WeeklySheet: {
        type: 'object',
        properties: {
          periodo: {
            type: 'object',
            properties: {
              inicio: { type: 'string', format: 'date' },
              fim: { type: 'string', format: 'date' },
            },
          },
          totalItens: { type: 'integer' },
          totalValor: { type: 'number', format: 'double' },
          itens: {
            type: 'array',
            items: { $ref: '#/components/schemas/Expense' },
          },
        },
      },
      DefaultSuccess: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {},
          message: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      DefaultError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string' },
          details: {},
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Token ausente ou invalido',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/DefaultError' },
          },
        },
      },
      NotFound: {
        description: 'Recurso não encontrado',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/DefaultError' },
          },
        },
      },
      ValidationError: {
        description: 'Erro de validacao ou campos obrigatorios ausentes',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/DefaultError' },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          200: {
            description: 'Servidor saudavel',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'healthy' },
                    timestamp: { type: 'string', format: 'date-time' },
                    uptime: { type: 'number' },
                    memory: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/status': {
      get: {
        tags: ['Health'],
        summary: 'Status basico da API',
        responses: {
          200: {
            description: 'Status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'operational' },
                    version: { type: 'string', example: '2.0.0' },
                    service: { type: 'string', example: 'welloChat API' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/auth/token/generate': {
      post: {
        tags: ['Auth'],
        summary: 'Gera token JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId'],
                properties: {
                  userId: { type: 'string' },
                  email: { type: 'string' },
                  role: { type: 'string', default: 'user' },
                  expiresIn: { type: 'string', default: '365d' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Token criado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DefaultSuccess' },
              },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
        },
      },
    },
    '/api/auth/token/validate': {
      post: {
        tags: ['Auth'],
        summary: 'Valida token JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token'],
                properties: { token: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Token valido',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DefaultSuccess' },
              },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
        },
      },
    },
    '/api/auth/info': {
      get: {
        tags: ['Auth'],
        summary: 'Informacoes sobre o esquema de autenticacao',
        responses: {
          200: {
            description: 'Detalhes',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DefaultSuccess' },
              },
            },
          },
        },
      },
    },
    '/api/auth/test': {
      get: {
        tags: ['Auth'],
        summary: 'Endpoint protegido para teste',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Token aceito',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DefaultSuccess' },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
  },
  '/api/conversations': {
    get: {
      tags: ['Conversations'],
      summary: 'Lista conversas com filtros',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', default: 10 },
        },
        {
          name: 'status',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['active', 'waiting', 'inactive', 'blocked', 'finalized'],
          },
        },
        { name: 'search', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        200: {
          description: 'Lista paginada',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: {
                    type: 'object',
                    properties: {
                      items: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Conversation' },
                      },
                      pagination: { $ref: '#/components/schemas/Pagination' },
                    },
                  },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ['Conversations'],
      summary: 'Lista conversas (POST com filtros no corpo)',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                page: { type: 'integer', default: 1 },
                limit: { type: 'integer', default: 10 },
                status: { type: 'string' },
                search: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Lista paginada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
      },
    },
  },
  '/api/conversations/list': {
    post: {
      tags: ['Conversations'],
      summary: 'Alias para listagem de conversas',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                page: { type: 'integer', default: 1 },
                limit: { type: 'integer', default: 10 },
                status: { type: 'string' },
                search: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Lista paginada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
      },
    },
  },
  '/api/conversations/create': {
    post: {
      tags: ['Conversations'],
      summary: 'Cria nova conversa (se não existir)',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['identifier', 'provider'],
              properties: {
                identifier: { type: 'string', example: '5511999999999' },
                provider: { type: 'string', example: 'whatsapp' },
                name: { type: 'string' },
                photo: { type: 'object' },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Conversa criada ou retornada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationError' },
      },
    },
  },
  '/api/conversations/{id}': {
    get: {
      tags: ['Conversations'],
      summary: 'Busca conversa por ID',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: {
          description: 'Conversa encontrada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
    put: {
      tags: ['Conversations'],
      summary: 'Atualiza campos da conversa',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: { type: 'object', additionalProperties: true },
          },
        },
      },
      responses: {
        200: {
          description: 'Atualizado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/conversations/paginate': {
    post: {
      tags: ['Conversations'],
      summary: 'Paginacao com filtros avancados',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                page: { type: 'integer', default: 1 },
                limit: { type: 'integer', default: 10 },
                status: { type: 'string' },
                provider: { type: 'string' },
                operatorId: { type: 'string' },
                archived: { type: 'boolean' },
                search: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Lista paginada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
      },
    },
  },
  '/api/conversations/{id}/archive': {
    patch: {
      tags: ['Conversations'],
      summary: 'Arquiva uma conversa',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: {
          description: 'Arquivada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/conversations/{id}/assign-operator': {
    patch: {
      tags: ['Conversations'],
      summary: 'Atribui operador',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['operatorId'],
              properties: {
                operatorId: { type: 'string' },
                operatorName: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Operador atribuido',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationError' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/messages': {
    get: {
      tags: ['Messages'],
      summary: 'Lista mensagens de uma conversa',
      parameters: [
        { name: 'conversationId', in: 'query', schema: { type: 'string' } },
        {
          name: 'identifier',
          in: 'query',
          schema: { type: 'string' },
          description: 'Alternativa para conversationId',
        },
        {
          name: 'provider',
          in: 'query',
          schema: { type: 'string', default: 'whatsapp' },
        },
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', default: 50 },
        },
      ],
      responses: {
        200: {
          description: 'Mensagens',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Message' },
                      },
                      total: { type: 'integer' },
                      page: { type: 'integer' },
                      pageSize: { type: 'integer' },
                      totalPages: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationError' },
      },
    },
  },
  '/api/messages/{id}': {
    get: {
      tags: ['Messages'],
      summary: 'Busca mensagem por ID',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: {
          description: 'Mensagem encontrada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
    delete: {
      tags: ['Messages'],
      summary: 'Deleta mensagem',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: {
          description: 'Mensagem removida',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/messages/send': {
    post: {
      tags: ['Messages'],
      summary: 'Envia mensagem (sincrono ou assincrono)',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/SendMessageRequest' },
          },
        },
      },
      responses: {
        200: {
          description: 'Mensagem enviada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SendMessageResponse' },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationError' },
      },
    },
  },
  '/api/messages/{id}/read': {
    patch: {
      tags: ['Messages'],
      summary: 'Marca mensagem como lida',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: {
          description: 'Marcada como lida',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/messages/{id}/media': {
    get: {
      tags: ['Messages'],
      summary: 'Retorna informacoes de midia',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: {
          description: 'Midia localizada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/bots/list': {
    get: {
      tags: ['Bots'],
      summary: 'Lista bots registrados e ativos',
      responses: {
        200: {
          description: 'Bots listados',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
      },
    },
  },
  '/api/bots/activate': {
    post: {
      tags: ['Bots'],
      summary: 'Ativa bot para uma conversa',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['conversationId', 'botId'],
              properties: {
                conversationId: { type: 'string' },
                botId: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Bot ativado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/bots/deactivate': {
    post: {
      tags: ['Bots'],
      summary: 'Desativa bot de uma conversa',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['conversationId'],
              properties: {
                conversationId: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Bot desativado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
      },
    },
  },
  '/api/bots/session/{conversationId}': {
    get: {
      tags: ['Bots'],
      summary: 'Busca sessao ativa de bot',
      parameters: [
        {
          name: 'conversationId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Sessao retornada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
      },
    },
  },
  '/api/bots/reset': {
    post: {
      tags: ['Bots'],
      summary: 'Reseta sessao de bot (estagio 0)',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['conversationId'],
              properties: {
                conversationId: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Sessao resetada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/bots/reload/{botId}': {
    post: {
      tags: ['Bots'],
      summary: 'Recarrega bot em memoria',
      parameters: [
        {
          name: 'botId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Bot recarregado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/bots/{botId}/export': {
    post: {
      tags: ['Bot Export/Import'],
      summary: 'Exporta bot para .jn',
      parameters: [
        {
          name: 'botId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                exportedBy: { type: 'string' },
                metadata: { type: 'object' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Export gerado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/bots/import': {
    post: {
      tags: ['Bot Export/Import'],
      summary: 'Importa bot via arquivo .jn',
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                file: { type: 'string', format: 'binary' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Bot importado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationError' },
      },
    },
  },
  '/api/bots/exports': {
    get: {
      tags: ['Bot Export/Import'],
      summary: 'Lista exports existentes',
      responses: {
        200: {
          description: 'Lista de arquivos',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
      },
    },
  },
  '/api/bots/export/{filename}/download': {
    get: {
      tags: ['Bot Export/Import'],
      summary: 'Download de arquivo exportado',
      parameters: [
        {
          name: 'filename',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: { description: 'Arquivo retornado' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/bots/export/{filename}/info': {
    get: {
      tags: ['Bot Export/Import'],
      summary: 'Info sobre um export',
      parameters: [
        {
          name: 'filename',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Info retornada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/bots/export/{filename}': {
    delete: {
      tags: ['Bot Export/Import'],
      summary: 'Remove um export .jn',
      parameters: [
        {
          name: 'filename',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Arquivo deletado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/whatsapp/status': {
    get: {
      tags: ['WhatsApp'],
      summary: 'Status da conexao do WhatsApp',
      responses: {
        200: {
          description: 'Status',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
      },
    },
  },
  '/api/whatsapp/qrcode': {
    get: {
      tags: ['WhatsApp'],
      summary: 'Retorna instrucao para ler QR Code (simplificado)',
      responses: {
        200: {
          description: 'Mensagem sobre QR Code',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
      },
    },
  },
  '/api/whatsapp/reconnect': {
    post: {
      tags: ['WhatsApp'],
      summary: 'Forca reconexao',
      responses: {
        200: {
          description: 'Reconexao iniciada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
      },
    },
  },
  '/api/whatsapp/disconnect': {
    post: {
      tags: ['WhatsApp'],
      summary: 'Desconecta',
      responses: {
        200: {
          description: 'Desconectado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
      },
    },
  },
  '/api/meta/webhook': {
    get: {
      tags: ['Meta'],
      summary: 'Verificacao do webhook pelo Meta (hub.challenge)',
      parameters: [
        { name: 'hub.mode', in: 'query', schema: { type: 'string' } },
        { name: 'hub.verify_token', in: 'query', schema: { type: 'string' } },
        { name: 'hub.challenge', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        200: { description: 'Desafio retornado em caso de sucesso' },
        403: { description: 'Falha na verificacao' },
      },
    },
    post: {
      tags: ['Meta'],
      summary: 'Recebe eventos do Meta (mensagens)',
      requestBody: {
        content: {
          'application/json': { schema: { type: 'object' } },
        },
      },
      responses: {
        200: { description: 'Evento aceito' },
        500: { description: 'Erro ao processar webhook' },
      },
    },
  },
  '/api/meta/status': {
    get: {
      tags: ['Meta'],
      summary: 'Status da configuracao Meta',
      responses: {
        200: {
          description: 'Status',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
      },
    },
  },
  '/api/meta/send-test': {
    post: {
      tags: ['Meta'],
      summary: 'Envia mensagem de teste via Meta',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['to', 'message'],
              properties: {
                to: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Mensagem enviada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationError' },
      },
    },
  },
  '/api/webhooks/events': {
    get: {
      tags: ['Webhooks'],
      summary: 'Lista eventos disponiveis',
      responses: {
        200: {
          description: 'Eventos listados',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
      },
    },
  },
  '/api/webhooks/stats': {
    get: {
      tags: ['Webhooks'],
      summary: 'Estatisticas basicas',
      responses: {
        200: {
          description: 'Totais',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
      },
    },
  },
  '/api/webhooks': {
    get: {
      tags: ['Webhooks'],
      summary: 'Lista webhooks com filtros',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', default: 10 },
        },
        { name: 'enabled', in: 'query', schema: { type: 'boolean' } },
        { name: 'event', in: 'query', schema: { type: 'string' } },
        { name: 'search', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        200: {
          description: 'Lista paginada',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: {
                    type: 'object',
                    properties: {
                      items: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Webhook' },
                      },
                      pagination: { $ref: '#/components/schemas/Pagination' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ['Webhooks'],
      summary: 'Cria novo webhook',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'url', 'events'],
              properties: {
                name: { type: 'string' },
                url: { type: 'string' },
                events: { type: 'array', items: { type: 'string' } },
                enabled: { type: 'boolean', default: true },
                secret: { type: 'string' },
                headers: {
                  type: 'object',
                  additionalProperties: { type: 'string' },
                },
                retryAttempts: { type: 'integer', default: 3 },
                retryDelay: { type: 'integer', default: 1000 },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Webhook criado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Webhook' },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationError' },
      },
    },
  },
  '/api/webhooks/{id}': {
    get: {
      tags: ['Webhooks'],
      summary: 'Busca webhook por ID',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: {
          description: 'Webhook',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Webhook' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
    put: {
      tags: ['Webhooks'],
      summary: 'Atualiza webhook',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                url: { type: 'string' },
                events: { type: 'array', items: { type: 'string' } },
                enabled: { type: 'boolean' },
                secret: { type: 'string' },
                headers: {
                  type: 'object',
                  additionalProperties: { type: 'string' },
                },
                retryAttempts: { type: 'integer' },
                retryDelay: { type: 'integer' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Atualizado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
    delete: {
      tags: ['Webhooks'],
      summary: 'Remove webhook',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: {
          description: 'Removido',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/webhooks/{id}/enable': {
    post: {
      tags: ['Webhooks'],
      summary: 'Ativa webhook',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: {
          description: 'Ativado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/webhooks/{id}/disable': {
    post: {
      tags: ['Webhooks'],
      summary: 'Desativa webhook',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: {
          description: 'Desativado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/webhooks/{id}/test': {
    post: {
      tags: ['Webhooks'],
      summary: 'Dispara teste para um webhook',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: {
          description: 'Teste enviado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationError' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/storage/config': {
    get: {
      tags: ['Storage'],
      summary: 'Lista configuracoes de storage',
      responses: {
        200: {
          description: 'Lista de configs',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  configs: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/StorageConfig' },
                  },
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ['Storage'],
      summary: 'Cria configuracao de storage',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['accountName', 'accountKey'],
              properties: {
                accountName: { type: 'string' },
                accountKey: { type: 'string' },
                containerName: { type: 'string', default: 'nxzap-media' },
                connectionString: { type: 'string' },
                endpoint: { type: 'string' },
                isActive: { type: 'boolean', default: true },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Configuracao criada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationError' },
      },
    },
  },
  '/api/storage/config/active': {
    get: {
      tags: ['Storage'],
      summary: 'Busca configuracao ativa',
      responses: {
        200: {
          description: 'Configuracao ativa',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/storage/config/{id}': {
    put: {
      tags: ['Storage'],
      summary: 'Atualiza configuracao de storage',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                accountName: { type: 'string' },
                accountKey: { type: 'string' },
                containerName: { type: 'string' },
                connectionString: { type: 'string' },
                endpoint: { type: 'string' },
                isActive: { type: 'boolean' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Configuracao atualizada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
    delete: {
      tags: ['Storage'],
      summary: 'Remove configuracao de storage',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: {
          description: 'Configuracao removida',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/storage/upload/file': {
    post: {
      tags: ['Storage'],
      summary: 'Upload de arquivo (multipart/form-data)',
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                file: { type: 'string', format: 'binary' },
                userId: {
                  type: 'string',
                  description: 'Opcional, para metadados',
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Upload concluido',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StorageUploadResult' },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationError' },
      },
    },
  },
  '/api/storage/upload/base64': {
    post: {
      tags: ['Storage'],
      summary: 'Upload a partir de base64',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['base64Data'],
              properties: {
                base64Data: { type: 'string' },
                fileName: { type: 'string' },
                contentType: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Upload concluido',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StorageUploadResult' },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationError' },
      },
    },
  },
  '/api/storage/upload/url': {
    post: {
      tags: ['Storage'],
      summary: 'Upload puxando de uma URL',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['url'],
              properties: {
                url: { type: 'string' },
                fileName: { type: 'string' },
                contentType: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Upload concluido',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StorageUploadResult' },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationError' },
      },
    },
  },
  '/api/storage/blob/{blobName}': {
    delete: {
      tags: ['Storage'],
      summary: 'Deleta blob',
      parameters: [
        {
          name: 'blobName',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Blob deletado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/storage/blobs': {
    get: {
      tags: ['Storage'],
      summary: 'Lista blobs no container',
      parameters: [{ name: 'prefix', in: 'query', schema: { type: 'string' } }],
      responses: {
        200: {
          description: 'Lista de blobs',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
      },
    },
  },
  '/api/storage/status': {
    get: {
      tags: ['Storage'],
      summary: 'Status do servico de storage',
      responses: {
        200: {
          description: 'Status',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
      },
    },
  },
  '/api/expenses': {
    get: {
      tags: ['Expenses'],
      summary: 'Lista despesas com filtros',
      parameters: [
        { name: 'obra', in: 'query', schema: { type: 'string' } },
        { name: 'cliente', in: 'query', schema: { type: 'string' } },
        { name: 'tipoDespesa', in: 'query', schema: { type: 'string' } },
        { name: 'centroCusto', in: 'query', schema: { type: 'string' } },
        { name: 'documentoVinculado', in: 'query', schema: { type: 'string' } },
        {
          name: 'vencimentoDe',
          in: 'query',
          schema: { type: 'string', format: 'date' },
        },
        {
          name: 'vencimentoAte',
          in: 'query',
          schema: { type: 'string', format: 'date' },
        },
        { name: 'search', in: 'query', schema: { type: 'string' } },
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', default: 10 },
        },
      ],
      responses: {
        200: {
          description: 'Despesas paginadas',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: {
                    type: 'object',
                    properties: {
                      items: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Expense' },
                      },
                      pagination: { $ref: '#/components/schemas/Pagination' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ['Expenses'],
      summary: 'Cria nova despesa',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: [
                'obra',
                'cliente',
                'documentoVinculado',
                'dataVencimento',
                'descricao',
                'tipoDespesa',
                'centroCusto',
                'valor',
              ],
              properties: {
                obra: { type: 'string' },
                cliente: { type: 'string' },
                documentoVinculado: { type: 'string' },
                dataVencimento: { type: 'string', format: 'date' },
                descricao: { type: 'string' },
                tipoDespesa: { type: 'string' },
                centroCusto: { type: 'string' },
                valor: { type: 'number', format: 'double' },
                semNotaEmitida: { type: 'boolean' },
                dependeFechamentoLoja: { type: 'boolean' },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Despesa criada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Expense' },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationError' },
      },
    },
  },
  '/api/expenses/list': {
    post: {
      tags: ['Expenses'],
      summary: 'Lista despesas (POST com filtros no corpo)',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                obra: { type: 'string' },
                cliente: { type: 'string' },
                tipoDespesa: { type: 'string' },
                centroCusto: { type: 'string' },
                documentoVinculado: { type: 'string' },
                vencimentoDe: { type: 'string', format: 'date' },
                vencimentoAte: { type: 'string', format: 'date' },
                search: { type: 'string' },
                page: { type: 'integer', default: 1 },
                limit: { type: 'integer', default: 10 },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Despesas paginadas',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
      },
    },
  },
  '/api/expenses/weekly-sheet': {
    get: {
      tags: ['Expenses'],
      summary: 'Retorna planilha semanal (sexta a quinta)',
      parameters: [
        { name: 'cliente', in: 'query', schema: { type: 'string' } },
        {
          name: 'data',
          in: 'query',
          schema: { type: 'string', format: 'date' },
        },
        {
          name: 'referenceDate',
          in: 'query',
          schema: { type: 'string', format: 'date' },
        },
      ],
      responses: {
        200: {
          description: 'Planilha semanal',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/WeeklySheet' },
            },
          },
        },
      },
    },
  },
  '/api/expenses/clients': {
    get: {
      tags: ['Expenses'],
      summary: 'Lista clientes distintos',
      parameters: [{ name: 'search', in: 'query', schema: { type: 'string' } }],
      responses: {
        200: {
          description: 'Clientes',
          content: {
            'application/json': {
              schema: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
  },
  '/api/expenses/{id}': {
    get: {
      tags: ['Expenses'],
      summary: 'Busca despesa por ID',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: {
          description: 'Despesa',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Expense' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
    put: {
      tags: ['Expenses'],
      summary: 'Atualiza despesa',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                obra: { type: 'string' },
                cliente: { type: 'string' },
                documentoVinculado: { type: 'string' },
                dataVencimento: { type: 'string', format: 'date' },
                descricao: { type: 'string' },
                tipoDespesa: { type: 'string' },
                centroCusto: { type: 'string' },
                valor: { type: 'number', format: 'double' },
                semNotaEmitida: { type: 'boolean' },
                dependeFechamentoLoja: { type: 'boolean' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Despesa atualizada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DefaultSuccess' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
}

export default swaggerDocument
