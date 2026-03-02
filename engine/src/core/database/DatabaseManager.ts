import { Db, MongoClient, ServerApiVersion } from 'mongodb'

/**
 * Gerenciador centralizado de conexões com o banco de dados
 * Implementa padrão Singleton para garantir uma única instância
 */
class DatabaseManager {
  private static instance: DatabaseManager
  private mongoClient: MongoClient | null = null
  private database: Db | null = null
  private readonly dbName: string
  private readonly connectionString: string

  private readonly collections = [
    'conversations',
    'messages',
    'bot_sessions',
    'user_profiles',
    'analytics',
    'expenses',
    'contacts',
    'whatsapp_sessions',
    'whatsapp_instances',
    'canned_responses',
    'visual_bot_definitions',
    'pipeline_stages',
    'appointments',
    'availability_settings',
    'services',
    'professionals',
    'hsm_templates',
    'campaigns',
    'campaign_contacts',
  ]

  private constructor() {
    this.dbName = process.env.DB_NAME || 'nxzap_db'
    this.connectionString = process.env.DB_URL || 'mongodb://localhost:27018'
  }

  /**
   * Retorna a instância única do DatabaseManager
   */
  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager()
    }
    return DatabaseManager.instance
  }

  /**
   * Estabelece conexão com o MongoDB
   */
  public async connect(): Promise<void> {
    if (this.mongoClient) {
      console.log('✅ Conexão com banco já estabelecida')
      return
    }

    try {
      this.mongoClient = await MongoClient.connect(this.connectionString, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        },
        maxPoolSize: 10,
        minPoolSize: 2,
        retryWrites: true,
        retryReads: true,
      })

      this.database = this.mongoClient.db(this.dbName)

      await this.initializeCollections()

      console.log(`✅ Conectado ao banco de dados: ${this.dbName}`)
    } catch (error) {
      console.error('❌ Erro ao conectar ao banco de dados:', error)
      throw error
    }
  }

  /**
   * Inicializa as coleções necessárias
   */
  private async initializeCollections(): Promise<void> {
    if (!this.database) {
      throw new Error('Database não inicializado')
    }

    const existingCollections = await this.database
      .listCollections()
      .toArray()
      .then((cols) => cols.map((c) => c.name))

    for (const collectionName of this.collections) {
      if (!existingCollections.includes(collectionName)) {
        await this.database.createCollection(collectionName)
        console.log(`📦 Coleção criada: ${collectionName}`)
      }
    }

    await this.createIndexes()
  }

  /**
   * Cria índices para otimização de queries
   */
  private async createIndexes(): Promise<void> {
    if (!this.database) return

    try {
      // Índices para conversations
      const conversationIndexes = await this.database
        .collection('conversations')
        .indexes()
      const existingConversationIndex = conversationIndexes.find(
        (index) => index.name === 'identifier_1_provider_1',
      )
      if (existingConversationIndex) {
        try {
          await this.database
            .collection('conversations')
            .dropIndex('identifier_1_provider_1')
        } catch (error) {
          console.warn(
            '⚠️ Falha ao remover índice existente identifier_1_provider_1:',
            error,
          )
        }
      }

      await this.database
        .collection('conversations')
        .createIndex(
          { identifier: 1, provider: 1 },
          { unique: true, partialFilterExpression: { archived: false } },
        )
      await this.database
        .collection('conversations')
        .createIndex({ updatedAt: -1 })

      // Índices para messages
      await this.database
        .collection('messages')
        .createIndex({ conversationId: 1, createdAt: -1 })

      // Remove índice antigo de messageId se existir e recria com sparse
      try {
        const indexes = await this.database.collection('messages').indexes()
        const messageIdIndex = indexes.find((idx) => idx.name === 'messageId_1')

        if (messageIdIndex && !messageIdIndex.sparse) {
          console.log(
            '🔄 Removendo índice antigo messageId_1 para recriar com sparse...',
          )
          await this.database.collection('messages').dropIndex('messageId_1')
        }
      } catch (error) {
        // Ignora erro se o índice não existir
      }

      // Cria índice único apenas para messageId quando não for null/undefined
      await this.database.collection('messages').createIndex(
        { messageId: 1 },
        { unique: true, sparse: true }, // sparse: true permite múltiplos null/undefined
      )

      await this.database
        .collection('contacts')
        .createIndex(
          { identifier: 1, provider: 1 },
          { unique: true, name: 'contacts_identifier_provider' },
        )
      await this.database
        .collection('contacts')
        .createIndex({ lastMessageAt: -1 })

      // Índices para bot_sessions
      await this.database
        .collection('bot_sessions')
        .createIndex({ conversationId: 1 })
      await this.database.collection('bot_sessions').createIndex({ botId: 1 })
      await this.database
        .collection('bot_sessions')
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })

      // Índices para expenses
      await this.database
        .collection('expenses')
        .createIndex({ dataVencimento: 1 })
      await this.database
        .collection('expenses')
        .createIndex({ cliente: 1, obra: 1 })

      await this.database
        .collection('whatsapp_sessions')
        .createIndex(
          { sessionName: 1 },
          { unique: true, name: 'whatsapp_sessions_sessionName' },
        )
      await this.database
        .collection('whatsapp_sessions')
        .createIndex({ phoneNumber: 1 })

      // Índices para whatsapp_instances
      await this.database
        .collection('whatsapp_instances')
        .createIndex(
          { sessionName: 1 },
          { unique: true, name: 'whatsapp_instances_sessionName' },
        )
      await this.database
        .collection('whatsapp_instances')
        .createIndex({ isDefault: 1 })
      await this.database
        .collection('whatsapp_instances')
        .createIndex({ autoConnect: 1 })

      // Indices para visual_bot_definitions
      await this.database
        .collection('visual_bot_definitions')
        .createIndex(
          { botId: 1 },
          { unique: true, name: 'visual_bot_definitions_botId' },
        )
      await this.database
        .collection('visual_bot_definitions')
        .createIndex({ status: 1 })
      await this.database
        .collection('visual_bot_definitions')
        .createIndex({ updatedAt: -1 })

      // Índice para pipeline no conversations
      await this.database
        .collection('conversations')
        .createIndex({ pipelineStageId: 1 })

      // Índices para appointments
      await this.database
        .collection('appointments')
        .createIndex({ date: 1 })
      await this.database
        .collection('appointments')
        .createIndex({ contactId: 1 })
      await this.database
        .collection('appointments')
        .createIndex({ operatorId: 1, date: 1 })

      // Índices para hsm_templates
      await this.database
        .collection('hsm_templates')
        .createIndex({ instanceId: 1 })
      await this.database
        .collection('hsm_templates')
        .createIndex({ status: 1 })
      await this.database
        .collection('hsm_templates')
        .createIndex({ metaTemplateId: 1 }, { sparse: true })

      // Índices para campaigns
      await this.database
        .collection('campaigns')
        .createIndex({ status: 1 })
      await this.database
        .collection('campaigns')
        .createIndex({ scheduledAt: 1 }, { sparse: true })
      await this.database
        .collection('campaigns')
        .createIndex({ createdBy: 1 })

      // Índices para campaign_contacts
      await this.database
        .collection('campaign_contacts')
        .createIndex({ campaignId: 1, status: 1 })
      await this.database
        .collection('campaign_contacts')
        .createIndex(
          { campaignId: 1, phone: 1 },
          { name: 'campaign_contacts_campaign_phone' },
        )

      console.log('🔍 Índices criados com sucesso')
    } catch (error: any) {
      console.error('❌ Erro ao criar índices:', error.message)
      throw error
    }
  }

  /**
   * Retorna a instância do banco de dados
   */
  public getDatabase(): Db {
    if (!this.database) {
      throw new Error('Database não conectado. Execute connect() primeiro.')
    }
    return this.database
  }

  /**
   * Retorna uma coleção específica
   */
  public getCollection<T = any>(name: string) {
    return this.getDatabase().collection<T>(name)
  }

  /**
   * Cria uma coleção dinâmica (para bots específicos)
   */
  public async createDynamicCollection(name: string): Promise<void> {
    if (!this.database) {
      throw new Error('Database não conectado')
    }

    const exists = await this.database.listCollections({ name }).hasNext()

    if (!exists) {
      await this.database.createCollection(name)
      console.log(`📦 Coleção dinâmica criada: ${name}`)
    }
  }

  /**
   * Fecha a conexão com o banco
   */
  public async disconnect(): Promise<void> {
    if (this.mongoClient) {
      await this.mongoClient.close()
      this.mongoClient = null
      this.database = null
      console.log('🔌 Desconectado do banco de dados')
    }
  }

  /**
   * Verifica se está conectado
   */
  public isConnected(): boolean {
    return this.mongoClient !== null && this.database !== null
  }
}

export default DatabaseManager.getInstance()
