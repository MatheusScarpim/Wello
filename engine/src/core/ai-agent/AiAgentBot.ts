import { MessageRepository } from '@/api/repositories/MessageRepository'
import { ConversationRepository } from '@/api/repositories/ConversationRepository'
import { IaRepository } from '@/api/repositories/IaRepository'
import { CampaignContactRepository } from '@/api/repositories/CampaignContactRepository'
import { CampaignRepository } from '@/api/repositories/CampaignRepository'
import { HsmTemplateRepository } from '@/api/repositories/HsmTemplateRepository'
import { WhitelabelRepository } from '@/api/repositories/WhitelabelRepository'
import { IaService } from '@/api/services/IaService'
import BotSessionRepository from '@/core/repositories/BotSessionRepository'
import { IBot, BotConfig } from '@/core/bot/interfaces/IBot'
import { IBotStage, MessageContext, StageResponse } from '@/core/bot/interfaces/IBotStage'

/**
 * Configuração do AI Agent
 */
export interface AiAgentConfig {
  /** Prompt do sistema - personalidade e instruções */
  systemPrompt: string
  /** Modelo OpenAI a usar */
  model: string
  /** Temperatura (criatividade) */
  temperature: number
  /** Max tokens por resposta */
  maxTokens: number
  /** Quantas mensagens de histórico enviar para a IA */
  historyLimit: number
  /** Palavras/frases que forçam transferência para humano */
  transferKeywords: string[]
  /** Instrução extra sobre quando transferir */
  transferInstructions: string
  /** Se deve responder com áudio quando o cliente envia áudio */
  replyWithAudio: boolean
}

const DEFAULT_AGENT_CONFIG: AiAgentConfig = {
  systemPrompt: '',
  model: 'gpt-4o-mini',
  temperature: 0.8,
  maxTokens: 400,
  historyLimit: 30,
  transferKeywords: [],
  transferInstructions: '',
  replyWithAudio: false,
}

/**
 * AI Agent Bot - Conversa naturalmente com o cliente usando IA generativa.
 *
 * Diferente dos bots baseados em estágios, este bot mantém uma conversa
 * livre e contínua. Ele usa o histórico real de mensagens do banco de dados
 * para manter contexto, e decide autonomamente quando transferir para um humano.
 */
export class AiAgentBot implements IBot {
  readonly config: BotConfig = {
    id: 'ai-agent',
    name: 'Agente IA',
    description: 'Agente conversacional com inteligência artificial',
    initialStage: 0,
    sessionTimeout: 1440,
    enableAnalytics: true,
  }

  readonly stages: Map<number, IBotStage> = new Map()

  private messageRepository: MessageRepository
  private conversationRepository: ConversationRepository
  private iaRepository: IaRepository
  private campaignContactRepository: CampaignContactRepository
  private campaignRepository: CampaignRepository
  private hsmTemplateRepository: HsmTemplateRepository
  private whitelabelRepository: WhitelabelRepository
  private iaService: IaService
  private agentConfigCache: { config: AiAgentConfig | null; lastFetch: number } = {
    config: null,
    lastFetch: 0,
  }
  private campaignContextCache: Map<string, { context: string | null; fetchedAt: number }> = new Map()

  constructor() {
    this.messageRepository = new MessageRepository()
    this.conversationRepository = new ConversationRepository()
    this.iaRepository = new IaRepository()
    this.campaignContactRepository = new CampaignContactRepository()
    this.campaignRepository = new CampaignRepository()
    this.hsmTemplateRepository = new HsmTemplateRepository()
    this.whitelabelRepository = new WhitelabelRepository()
    this.iaService = new IaService()
  }

  async initialize(): Promise<void> {
    console.log('🤖 AI Agent Bot inicializado')
  }

  /**
   * Processa mensagem do cliente usando IA conversacional
   */
  async processMessage(context: MessageContext): Promise<StageResponse> {
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY
      if (!openaiApiKey) {
        console.warn('⚠️ OPENAI_API_KEY não configurada para AI Agent')
        return {
          message: 'Desculpe, nosso sistema está temporariamente indisponível. Um atendente irá te ajudar em breve.',
          transferToHuman: true,
        }
      }

      // Buscar config do agente
      const agentConfig = await this.getAgentConfig()

      // Guardar se a mensagem original era áudio (antes de transcrever)
      const wasAudioMessage = context.type === 'audio' || context.type === 'ptt'

      // Se for áudio/ptt, verificar se já foi transcrito pelo Application.ts
      if (wasAudioMessage) {
        if (context.message && context.message.startsWith('🎤 ')) {
          // Já transcrito — remover prefixo para processar com IA
          context.message = context.message.substring(3)
        } else if (context.mediaUrl || context.mediaStorage) {
          // Fallback: transcrever aqui se não foi transcrito antes
          const transcription = await this.transcribeAudio(context, openaiApiKey)
          if (transcription) {
            context.message = transcription
            console.log(`🎤 AI Agent transcreveu áudio: "${transcription.substring(0, 80)}..."`)
          } else {
            return {
              message: 'Opa, não consegui ouvir direito esse áudio. Pode mandar por texto, por favor?',
            }
          }
        }
      }

      // Se for imagem/vídeo/documento sem texto, adicionar contexto
      if (['image', 'video', 'document', 'sticker'].includes(context.type) && !context.message) {
        const mediaLabels: Record<string, string> = {
          image: 'uma imagem',
          video: 'um vídeo',
          document: 'um documento',
          sticker: 'um sticker/figurinha',
        }
        context.message = `[O cliente enviou ${mediaLabels[context.type] || 'uma mídia'}]`
      }

      // Verificar se mensagem contém keyword de transferência
      if (this.shouldForceTransfer(context.message, agentConfig)) {
        return {
          message: 'Claro! Vou te transferir para um de nossos atendentes agora mesmo. Um momento, por favor.',
          transferToHuman: true,
        }
      }

      // O conversationId real (MongoDB _id) vem via sessionData._mongoConversationId
      // que é setado pelo Application.ts ao chamar o bot
      const mongoConversationId = context.sessionData?._mongoConversationId || context.conversationId

      // Montar histórico de mensagens reais do banco
      const messages = await this.buildConversationHistory(
        mongoConversationId,
        agentConfig.historyLimit,
      )

      // Buscar contexto de campanha (se o cliente recebeu alguma campanha recente)
      const campaignContext = await this.getCampaignContext(context.identifier)
      if (campaignContext) {
        console.log(`📢 AI Agent detectou contexto de campanha para ${context.identifier}`)
      }

      // Montar system prompt completo
      const systemPrompt = await this.buildSystemPrompt(agentConfig, campaignContext)

      // Chamar OpenAI
      const aiResponse = await this.callOpenAI(
        systemPrompt,
        messages,
        context,
        agentConfig,
        openaiApiKey,
      )

      // Gerenciar sessão
      await this.ensureSession(context)

      // Gerar resumo da conversa para o quadro (async, não bloqueia resposta)
      this.updateConversationSummary(mongoConversationId, messages, context, agentConfig, openaiApiKey)
        .catch((err) => console.warn('⚠️ Erro ao gerar resumo:', err.message))

      // Analisar se a IA quer transferir
      if (aiResponse.shouldTransfer) {
        return {
          message: aiResponse.message,
          transferToHuman: true,
          transferDepartmentId: aiResponse.departmentId,
        }
      }

      // Se o cliente mandou áudio e a opção de responder com áudio está ativa, gerar TTS
      if (wasAudioMessage && agentConfig.replyWithAudio && aiResponse.message) {
        try {
          const audioResult = await this.textToSpeechForReply(aiResponse.message, openaiApiKey)
          if (audioResult) {
            console.log('🔊 AI Agent respondendo com áudio')
            return {
              media: {
                type: 'audio',
                base64: audioResult,
              },
            }
          }
        } catch (err: any) {
          console.warn('⚠️ Erro ao gerar áudio de resposta, enviando texto:', err.message)
        }
      }

      return {
        message: aiResponse.message,
      }
    } catch (error: any) {
      console.error('❌ Erro no AI Agent:', error.message)
      return {
        message: 'Ops, tive um probleminha aqui. Vou te passar para um atendente, tá? Um segundo!',
        transferToHuman: true,
      }
    }
  }

  /**
   * Monta o system prompt completo com contexto do negócio
   */
  private async buildSystemPrompt(agentConfig: AiAgentConfig, campaignContext?: string | null): Promise<string> {
    const companyDescription = await this.iaRepository.getCompanyDescription()
    const suggestionInstructions = await this.iaRepository.getSuggestionInstructions()

    let prompt = `Você é um atendente humano real de uma empresa. Você NUNCA deve revelar que é uma inteligência artificial, bot ou assistente virtual. Você é uma pessoa de verdade que trabalha na empresa.

REGRAS FUNDAMENTAIS DE COMPORTAMENTO:
- Fale de forma NATURAL e HUMANA, como uma pessoa real falaria no WhatsApp
- Use linguagem informal mas profissional
- Pode usar "kkk", "rs", "haha" quando apropriado
- Use abreviações naturais (vc, tbm, pq, etc) com moderação
- Varie suas respostas - não seja repetitivo
- Seja empático e atencioso
- Responda de forma concisa - ninguém gosta de textão no WhatsApp
- NUNCA diga que é um bot, IA, assistente virtual ou algo similar
- Se perguntarem se você é um robô/bot/IA, negue naturalmente
- Não use markdown, asteriscos, ou formatação de código`

    if (companyDescription) {
      prompt += `

SOBRE A EMPRESA:
${companyDescription}`
    }

    if (agentConfig.systemPrompt) {
      prompt += `

INSTRUÇÕES ESPECÍFICAS:
${agentConfig.systemPrompt}`
    }

    if (suggestionInstructions) {
      prompt += `

INSTRUÇÕES ADICIONAIS:
${suggestionInstructions}`
    }

    if (campaignContext) {
      prompt += `

CONTEXTO DE CAMPANHA:
${campaignContext}
IMPORTANTE: O cliente provavelmente está respondendo a essa campanha. Use esse contexto para dar continuidade à conversa de forma natural, sem mencionar que "recebeu uma campanha" - trate como se fosse uma conversa que você mesmo iniciou.`
    }

    prompt += `

SOBRE TRANSFERÊNCIA PARA ATENDENTE HUMANO:
Você deve decidir transferir a conversa para um atendente humano quando:
- O cliente pede explicitamente para falar com um atendente/humano/pessoa
- A situação é muito complexa e você não tem informação suficiente para resolver
- O cliente está muito insatisfeito ou irritado e precisa de atenção especial
- Envolve questões financeiras sensíveis (reembolso, cancelamento, pagamento)
- Você não sabe a resposta e não quer inventar informações
- O assunto requer acesso a sistemas internos que você não tem`

    if (agentConfig.transferInstructions) {
      prompt += `
- ${agentConfig.transferInstructions}`
    }

    prompt += `

FORMATO DE RESPOSTA:
Responda SEMPRE em JSON válido com este formato exato:
{"message": "sua resposta aqui", "shouldTransfer": false}

Se precisar transferir para humano:
{"message": "mensagem de despedida antes de transferir", "shouldTransfer": true}

Retorne APENAS o JSON, sem nenhum texto adicional antes ou depois.`

    return prompt
  }

  /**
   * Busca histórico real de mensagens do banco de dados
   */
  private async buildConversationHistory(
    conversationId: string,
    limit: number,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    try {
      const result = await this.messageRepository.findMessagesByConversation(
        conversationId,
        1,
        limit,
      )

      const dbMessages = (result.data || []).reverse()
      const history: Array<{ role: 'user' | 'assistant'; content: string }> = []

      for (const msg of dbMessages) {
        if (!msg.message || msg.type === 'system') continue

        // Não incluir a mensagem atual (já vai no user prompt)
        history.push({
          role: msg.direction === 'incoming' ? 'user' : 'assistant',
          content: msg.message,
        })
      }

      return history
    } catch (error) {
      console.warn('⚠️ Erro ao buscar histórico de mensagens:', error)
      return []
    }
  }

  /**
   * Chama a API da OpenAI com histórico completo
   */
  private async callOpenAI(
    systemPrompt: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    context: MessageContext,
    agentConfig: AiAgentConfig,
    apiKey: string,
  ): Promise<{ message: string; shouldTransfer: boolean; departmentId?: string }> {
    // Montar mensagens para a API
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ]

    // Adicionar histórico (excluindo a última mensagem do usuário que veio agora)
    // O histórico do banco já inclui a mensagem atual pois foi salva antes de chegar aqui
    // Então pegamos todas menos a última incoming
    const historyWithoutCurrent = [...conversationHistory]
    if (historyWithoutCurrent.length > 0) {
      const lastMsg = historyWithoutCurrent[historyWithoutCurrent.length - 1]
      if (lastMsg.role === 'user' && lastMsg.content === context.message) {
        historyWithoutCurrent.pop()
      }
    }

    for (const msg of historyWithoutCurrent) {
      messages.push({ role: msg.role, content: msg.content })
    }

    // Adicionar mensagem atual do usuário com contexto
    let userMessage = context.message || ''
    if (context.name && conversationHistory.length <= 1) {
      // Primeira mensagem - incluir nome do cliente
      userMessage = `[Nome do cliente: ${context.name}]\n${userMessage}`
    }
    messages.push({ role: 'user', content: userMessage })

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: agentConfig.model,
        messages,
        temperature: agentConfig.temperature,
        max_tokens: agentConfig.maxTokens,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const rawContent = data.choices?.[0]?.message?.content?.trim() || ''

    // Tentar parsear JSON da resposta
    return this.parseAiResponse(rawContent)
  }

  /**
   * Parseia a resposta da IA (tenta JSON, fallback para texto puro)
   */
  private parseAiResponse(rawContent: string): {
    message: string
    shouldTransfer: boolean
    departmentId?: string
  } {
    try {
      // Tentar extrair JSON (pode vir com markdown)
      let jsonStr = rawContent
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        jsonStr = jsonMatch[0]
      }

      const parsed = JSON.parse(jsonStr)
      return {
        message: parsed.message || rawContent,
        shouldTransfer: parsed.shouldTransfer === true,
        departmentId: parsed.departmentId || undefined,
      }
    } catch {
      // Se não conseguiu parsear JSON, usa o texto direto
      return {
        message: rawContent,
        shouldTransfer: false,
      }
    }
  }

  /**
   * Gera/atualiza resumo da conversa para o quadro (pipeline).
   * Roda a cada 5 mensagens para economizar tokens.
   */
  private async updateConversationSummary(
    conversationId: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    context: MessageContext,
    agentConfig: AiAgentConfig,
    apiKey: string,
  ): Promise<void> {
    // Só gera resumo a cada 5 mensagens
    const totalMessages = history.length + 1
    if (totalMessages < 3 || totalMessages % 5 !== 0) return

    // Montar as últimas mensagens para o resumo
    const recentMessages = history.slice(-20)
    const conversationText = recentMessages
      .map((m) => `${m.role === 'user' ? 'Cliente' : 'Atendente'}: ${m.content}`)
      .join('\n')

    const summaryPrompt = `Analise a conversa abaixo e gere um RESUMO CURTO (máximo 2-3 frases) para um quadro kanban de vendas/atendimento.
O resumo deve destacar: o que o cliente quer, status da negociação, próximos passos.
Escreva em português BR, de forma objetiva e direta.

Conversa:
${conversationText}

Retorne APENAS o resumo, sem formatação especial.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: summaryPrompt },
        ],
        temperature: 0.3,
        max_tokens: 150,
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) return

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const summary = data.choices?.[0]?.message?.content?.trim()
    if (!summary) return

    // Salvar resumo no campo notes da conversa
    const { ObjectId } = await import('mongodb')
    const objectId = ObjectId.isValid(conversationId) ? new ObjectId(conversationId) : conversationId
    await this.conversationRepository.updateOne(
      { _id: objectId } as any,
      { $set: { notes: summary, updatedAt: new Date() } },
    )

    console.log(`📝 Resumo atualizado para conversa ${conversationId}: "${summary.substring(0, 60)}..."`)
  }

  /**
   * Transcreve uma mensagem de áudio usando OpenAI Whisper
   */
  private async transcribeAudio(context: MessageContext, apiKey: string): Promise<string | null> {
    try {
      let audioBuffer: Buffer | null = null
      let filename = 'audio.ogg'

      // Tentar baixar do Azure Storage primeiro
      if (context.mediaStorage?.provider === 'azure_blob' && context.mediaStorage.blobName) {
        try {
          const { azureStorageService } = await import('@/services/AzureStorageService')
          const url = azureStorageService.getBlobUrl(context.mediaStorage.blobName)
          const response = await fetch(url)
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer()
            audioBuffer = Buffer.from(arrayBuffer)
            filename = context.mediaStorage.blobName.split('/').pop() || filename
          }
        } catch (err) {
          console.warn('⚠️ Erro ao baixar áudio do Azure:', err)
        }
      }

      // Fallback: baixar da mediaUrl
      if (!audioBuffer && context.mediaUrl) {
        try {
          const response = await fetch(context.mediaUrl)
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer()
            audioBuffer = Buffer.from(arrayBuffer)
          }
        } catch (err) {
          console.warn('⚠️ Erro ao baixar áudio da mediaUrl:', err)
        }
      }

      if (!audioBuffer || audioBuffer.length === 0) {
        console.warn('⚠️ Não foi possível obter o áudio para transcrição')
        return null
      }

      // Chamar Whisper API
      const formData = new FormData()
      formData.append('file', new Blob([audioBuffer]), filename)
      formData.append('model', 'whisper-1')
      formData.append('language', 'pt')

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
        signal: AbortSignal.timeout(30000),
      })

      if (!response.ok) {
        console.error('❌ Whisper API error:', response.status)
        return null
      }

      const result = (await response.json()) as { text: string }
      return result.text?.trim() || null
    } catch (error: any) {
      console.error('❌ Erro ao transcrever áudio:', error.message)
      return null
    }
  }

  /**
   * Busca contexto de campanhas recentes enviadas para o contato
   * Retorna texto descritivo para injetar no prompt, ou null se não houver campanha
   */
  private async getCampaignContext(identifier: string): Promise<string | null> {
    try {
      // Normalizar telefone (remover @c.us, @s.whatsapp.net etc)
      const phone = identifier.replace(/@.*$/, '')
      if (!phone) return null

      // Verificar cache (5 minutos por contato)
      const cached = this.campaignContextCache.get(phone)
      if (cached && Date.now() - cached.fetchedAt < 5 * 60 * 1000) {
        return cached.context
      }

      // Buscar campanhas enviadas nas últimas 48h para esse telefone
      const recentContacts = await this.campaignContactRepository.findRecentByPhone(phone)
      if (recentContacts.length === 0) return null

      const contextParts: string[] = []

      for (const campaignContact of recentContacts) {
        try {
          const campaign = await this.campaignRepository.findById(campaignContact.campaignId)
          if (!campaign) continue

          let campaignDesc = `- Campanha "${campaign.name}"`

          if (campaign.type === 'official' && campaign.templateId) {
            // Buscar template HSM para ter o conteúdo
            const template = await this.hsmTemplateRepository.findById(campaign.templateId)
            if (template) {
              const bodyComponent = template.components.find((c) => c.type === 'BODY')
              if (bodyComponent?.text) {
                // Substituir variáveis com os valores do contato
                let bodyText = bodyComponent.text
                if (campaignContact.variables) {
                  for (const [key, value] of Object.entries(campaignContact.variables)) {
                    bodyText = bodyText.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '')
                  }
                }
                // Limpar variáveis restantes
                bodyText = bodyText.replace(/\{\{\d+\}\}/g, '').trim()
                campaignDesc += `: "${bodyText}"`
              }
            }
          } else if (campaign.message) {
            // Campanha não-oficial — incluir a mensagem
            let msg = campaign.message
            if (campaignContact.variables) {
              for (const [key, value] of Object.entries(campaignContact.variables)) {
                msg = msg.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '')
              }
            }
            msg = msg.replace(/\{\{[^}]+\}\}/g, '').trim()
            if (msg.length > 300) msg = msg.substring(0, 300) + '...'
            campaignDesc += `: "${msg}"`
          }

          contextParts.push(campaignDesc)
        } catch {
          // Ignora erro de campanha individual
        }
      }

      const result = contextParts.length === 0
        ? null
        : `Este cliente recebeu recentemente a(s) seguinte(s) mensagem(ns) da empresa:\n${contextParts.join('\n')}`

      // Salvar no cache
      this.campaignContextCache.set(phone, { context: result, fetchedAt: Date.now() })

      // Limpar cache antigo (evitar memory leak)
      if (this.campaignContextCache.size > 100) {
        const oldest = [...this.campaignContextCache.entries()]
          .sort((a, b) => a[1].fetchedAt - b[1].fetchedAt)
          .slice(0, 50)
        oldest.forEach(([key]) => this.campaignContextCache.delete(key))
      }

      return result
    } catch (error) {
      console.warn('⚠️ Erro ao buscar contexto de campanha:', error)
      return null
    }
  }

  /**
   * Gera áudio (TTS) para a resposta do agente usando as configurações de personalização (whitelabel)
   * Suporta OpenAI TTS e ElevenLabs conforme configurado em Personalização > Features
   */
  private async textToSpeechForReply(text: string, _apiKey: string): Promise<string | null> {
    try {
      if (!text || text.trim().length === 0) return null
      if (text.length > 4096) {
        text = text.substring(0, 4096)
      }

      // Buscar configurações de TTS do whitelabel (personalização)
      const settings = await this.whitelabelRepository.getSettings()
      const features = settings?.features
      const voice = (features?.defaultTtsVoice || 'nova') as any
      const model = (features?.ttsModel || 'tts-1') as 'tts-1' | 'tts-1-hd'
      const provider = (features?.ttsProvider || 'openai') as 'openai' | 'elevenlabs'
      const elevenLabsVoiceId = features?.elevenLabsVoiceId || undefined

      console.log(`🔊 AI Agent TTS usando provider: ${provider}, voice: ${provider === 'elevenlabs' ? elevenLabsVoiceId : voice}, model: ${model}`)

      const result = await this.iaService.textToSpeech(text, voice, model, provider, elevenLabsVoiceId)
      return result.audioBase64
    } catch (error: any) {
      console.error('❌ Erro ao gerar TTS:', error.message)
      return null
    }
  }

  /**
   * Verifica se a mensagem contém keywords que forçam transferência
   */
  private shouldForceTransfer(message: string, config: AiAgentConfig): boolean {
    if (!config.transferKeywords.length) return false

    const lowerMessage = message.toLowerCase().trim()
    return config.transferKeywords.some((keyword) =>
      lowerMessage.includes(keyword.toLowerCase().trim()),
    )
  }

  /**
   * Garante que existe uma sessão de bot ativa
   */
  private async ensureSession(context: MessageContext): Promise<void> {
    const session = await BotSessionRepository.getActiveSession(context.conversationId)
    if (!session) {
      await BotSessionRepository.upsertSession(
        context.conversationId,
        'ai-agent',
        0,
        { _aiAgent: true },
      )
    }
  }

  /**
   * Busca config do agente com cache de 30s
   */
  private async getAgentConfig(): Promise<AiAgentConfig> {
    const now = Date.now()
    if (this.agentConfigCache.config && now - this.agentConfigCache.lastFetch < 30000) {
      return this.agentConfigCache.config
    }

    try {
      const iaConfig = await this.iaRepository.getConfig()
      const agentConfig: AiAgentConfig = {
        systemPrompt: iaConfig?.agentSystemPrompt || DEFAULT_AGENT_CONFIG.systemPrompt,
        model: iaConfig?.agentModel || DEFAULT_AGENT_CONFIG.model,
        temperature: iaConfig?.agentTemperature ?? DEFAULT_AGENT_CONFIG.temperature,
        maxTokens: iaConfig?.agentMaxTokens ?? DEFAULT_AGENT_CONFIG.maxTokens,
        historyLimit: iaConfig?.agentHistoryLimit ?? DEFAULT_AGENT_CONFIG.historyLimit,
        transferKeywords: iaConfig?.agentTransferKeywords || DEFAULT_AGENT_CONFIG.transferKeywords,
        transferInstructions: iaConfig?.agentTransferInstructions || DEFAULT_AGENT_CONFIG.transferInstructions,
        replyWithAudio: iaConfig?.agentReplyWithAudio ?? DEFAULT_AGENT_CONFIG.replyWithAudio,
      }

      this.agentConfigCache = { config: agentConfig, lastFetch: now }
      return agentConfig
    } catch (error) {
      console.warn('⚠️ Erro ao buscar config do AI Agent, usando defaults')
      return DEFAULT_AGENT_CONFIG
    }
  }

  // Métodos obrigatórios do IBot (não usados pois não é baseado em estágios)
  getStage(_stageNumber: number): IBotStage | undefined { return undefined }
  addStage(_stage: IBotStage): void {}
  removeStage(_stageNumber: number): void {}
  hasStage(_stageNumber: number): boolean { return false }
  getAvailableStages(): number[] { return [] }
  async dispose(): Promise<void> {
    console.log('🛑 AI Agent Bot finalizado')
  }
}
