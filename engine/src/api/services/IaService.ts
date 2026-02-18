import { ConversationRepository } from '../repositories/ConversationRepository'
import { IaRepository } from '../repositories/IaRepository'
import { MessageRepository } from '../repositories/MessageRepository'

export interface SuggestionResult {
  suggestion: string
  confidence: number
}

export type TtsVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'

export interface TtsResult {
  audioBase64: string
  contentType: string
}

export class IaService {
  private iaRepository: IaRepository
  private messageRepository: MessageRepository
  private conversationRepository: ConversationRepository

  constructor() {
    this.iaRepository = new IaRepository()
    this.messageRepository = new MessageRepository()
    this.conversationRepository = new ConversationRepository()
  }

  async getCompanyDescription(): Promise<string> {
    return await this.iaRepository.getCompanyDescription()
  }

  async saveCompanyDescription(description: string): Promise<void> {
    await this.iaRepository.saveCompanyDescription(description)
  }

  async getSuggestionInstructions(): Promise<string> {
    return await this.iaRepository.getSuggestionInstructions()
  }

  async saveSuggestionInstructions(instructions: string): Promise<void> {
    await this.iaRepository.saveSuggestionInstructions(instructions)
  }

  async generateSuggestion(
    conversationId: string,
    lastMessagesCount: number = 20,
    operatorId?: string,
  ): Promise<SuggestionResult> {
    // Get conversation
    const conversation =
      await this.conversationRepository.findById(conversationId)
    if (!conversation) {
      throw new Error('Conversa não encontrada')
    }

    // Get last messages
    const messagesResult =
      await this.messageRepository.findMessagesByConversation(
        conversationId,
        1,
        lastMessagesCount,
      )
    const messages = messagesResult.data || []

    // Get company description and suggestion instructions for context
    const companyDescription = await this.getCompanyDescription()
    const suggestionInstructions = await this.getSuggestionInstructions()

    // Build context
    const conversationHistory = messages
      .reverse()
      .map(
        (m) =>
          `${m.direction === 'incoming' ? 'Cliente' : 'Operador'}: ${m.message}`,
      )
      .join('\n')

    // Generate suggestion using AI
    const suggestion = await this.callAI(
      companyDescription,
      suggestionInstructions,
      conversationHistory,
      conversation.name || conversation.identifier,
    )

    // Calculate confidence based on context availability
    let confidence = 0.75
    if (companyDescription && companyDescription.length > 100) confidence += 0.1
    if (messages.length >= 5) confidence += 0.1
    if (conversation.name) confidence += 0.05

    // Log the suggestion
    await this.iaRepository.logSuggestion({
      conversationId,
      operatorId,
      suggestion,
      confidence,
      context: {
        lastMessages: messages.length,
        conversationStatus: conversation.status,
      },
      used: false,
    })

    return {
      suggestion,
      confidence: Math.min(confidence, 0.98),
    }
  }

  private async callAI(
    companyDescription: string,
    suggestionInstructions: string,
    conversationHistory: string,
    customerName: string,
  ): Promise<string> {
    // Check for OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY

    if (openaiApiKey) {
      try {
        return await this.callOpenAI(
          companyDescription,
          suggestionInstructions,
          conversationHistory,
          customerName,
          openaiApiKey,
        )
      } catch (error) {
        console.error('Erro ao chamar OpenAI, usando fallback:', error)
      }
    }

    // Fallback: Generate simple suggestion based on context
    return this.generateFallbackSuggestion(conversationHistory, customerName)
  }

  private async callOpenAI(
    companyDescription: string,
    suggestionInstructions: string,
    conversationHistory: string,
    customerName: string,
    apiKey: string,
  ): Promise<string> {
    let systemPrompt = `Voce e um assistente que gera mensagens para atendimento ao cliente. ${companyDescription ? `Contexto da empresa: ${companyDescription}` : ''}`

    if (suggestionInstructions) {
      systemPrompt += `

Instrucoes adicionais:
${suggestionInstructions}`
    }

    systemPrompt += `

IMPORTANTE - REGRAS OBRIGATORIAS:
1. Retorne APENAS a mensagem pronta para enviar ao cliente
2. NAO inclua titulos, cabecalhos ou explicacoes
3. NAO escreva "Sugestao:", "Resposta:", "Mensagem:" ou similares
4. NAO inclua frases como "Frases prontas" ou "Para o vendedor usar"
5. A resposta deve ser EXATAMENTE o texto que o operador vai copiar e enviar
6. Seja educado, profissional e objetivo`

    const userPrompt = `Conversa com ${customerName}:
${conversationHistory}

Escreva a mensagem para enviar ao cliente (apenas a mensagem, nada mais):`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const rawResponse = data.choices?.[0]?.message?.content || ''

    // Clean the response to ensure only the message is returned
    return (
      this.cleanSuggestion(rawResponse) ||
      this.generateFallbackSuggestion(conversationHistory, customerName)
    )
  }

  private cleanSuggestion(suggestion: string): string {
    if (!suggestion) return ''

    let cleaned = suggestion.trim()

    // Remove common unwanted prefixes/headers
    const unwantedPrefixes = [
      /^(Sugest[aã]o|Resposta|Mensagem|Frase|Texto):\s*/i,
      /^(Frases? prontas?( para o vendedor usar)?):?\s*/i,
      /^(Para enviar|Envie|Mande):\s*/i,
      /^(Ol[aá],?\s*)?aqui est[aá] a sugest[aã]o:\s*/i,
      /^[-•*]\s*/,
    ]

    for (const prefix of unwantedPrefixes) {
      cleaned = cleaned.replace(prefix, '')
    }

    // Remove quotes if the entire message is wrapped in them
    if (
      (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))
    ) {
      cleaned = cleaned.slice(1, -1)
    }

    return cleaned.trim()
  }

  private generateFallbackSuggestion(
    conversationHistory: string,
    customerName: string,
  ): string {
    // Analyze last message to provide contextual response
    const lines = conversationHistory.split('\n').filter((l) => l.trim())
    const lastMessage = lines[lines.length - 1] || ''

    // Simple keyword-based suggestions
    const lowerMessage = lastMessage.toLowerCase()

    if (
      lowerMessage.includes('preco') ||
      lowerMessage.includes('valor') ||
      lowerMessage.includes('quanto custa')
    ) {
      return `Ola ${customerName}! Vou verificar os valores para voce. Poderia me informar qual produto ou servico especifico voce tem interesse?`
    }

    if (
      lowerMessage.includes('prazo') ||
      lowerMessage.includes('entrega') ||
      lowerMessage.includes('quando chega')
    ) {
      return `${customerName}, vou verificar o prazo de entrega para sua regiao. Pode me informar seu CEP, por favor?`
    }

    if (
      lowerMessage.includes('problema') ||
      lowerMessage.includes('erro') ||
      lowerMessage.includes('não funciona')
    ) {
      return `Lamento pelo inconveniente, ${customerName}. Vou ajuda-lo a resolver isso. Pode me descrever com mais detalhes o que esta acontecendo?`
    }

    if (
      lowerMessage.includes('obrigado') ||
      lowerMessage.includes('valeu') ||
      lowerMessage.includes('agradeco')
    ) {
      return `Por nada, ${customerName}! Fico feliz em ajudar. Se precisar de mais alguma coisa, estou a disposicao!`
    }

    if (
      lowerMessage.includes('oi') ||
      lowerMessage.includes('ola') ||
      lowerMessage.includes('bom dia') ||
      lowerMessage.includes('boa tarde')
    ) {
      return `Ola ${customerName}! Seja bem-vindo(a)! Como posso ajuda-lo(a) hoje?`
    }

    // Generic response
    return `${customerName}, entendi sua solicitacao. Vou verificar as informacoes e retorno em seguida. Ha mais alguma coisa que posso ajudar?`
  }

  async improveMessage(
    conversationId: string,
    message: string,
  ): Promise<string> {
    // Get conversation for context
    const conversation =
      await this.conversationRepository.findById(conversationId)
    if (!conversation) {
      throw new Error('Conversa não encontrada')
    }

    // Get last messages for context
    const messagesResult =
      await this.messageRepository.findMessagesByConversation(
        conversationId,
        1,
        10,
      )
    const messages = messagesResult.data || []

    // Build conversation context
    const conversationHistory = messages
      .reverse()
      .map(
        (m) =>
          `${m.direction === 'incoming' ? 'Cliente' : 'Operador'}: ${m.message}`,
      )
      .join('\n')

    // Get company description for tone context
    const companyDescription = await this.getCompanyDescription()

    // Check for OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY

    if (!openaiApiKey) {
      // Return original message if no API key
      return message
    }

    try {
      return await this.callOpenAIImprove(
        message,
        conversationHistory,
        conversation.name || conversation.identifier,
        companyDescription,
        openaiApiKey,
      )
    } catch (error) {
      console.error('Erro ao melhorar mensagem com OpenAI:', error)
      return message // Return original on error
    }
  }

  private async callOpenAIImprove(
    originalMessage: string,
    conversationHistory: string,
    customerName: string,
    companyDescription: string,
    apiKey: string,
  ): Promise<string> {
    const systemPrompt = `Voce e um assistente que melhora mensagens de atendimento ao cliente.
${companyDescription ? `Contexto da empresa: ${companyDescription}` : ''}

Sua tarefa e melhorar a mensagem do operador, tornando-a:
- Mais profissional e educada
- Clara e objetiva
- Com boa formatacao e pontuacao
- Mantendo o significado original
- Personalizada para o cliente quando possivel

REGRAS OBRIGATORIAS:
1. Retorne APENAS a mensagem melhorada
2. NAO adicione explicacoes ou comentarios
3. NAO mude o sentido da mensagem original
4. Mantenha um tom amigavel e profissional
5. Se a mensagem ja estiver boa, faca apenas pequenos ajustes`

    const userPrompt = `Contexto da conversa com ${customerName}:
${conversationHistory}

Mensagem original do operador para melhorar:
"${originalMessage}"

Escreva a versao melhorada (apenas a mensagem, nada mais):`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 300,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const improved = data.choices?.[0]?.message?.content || ''

    // Clean and return
    return this.cleanSuggestion(improved) || originalMessage
  }

  async textToSpeech(
    text: string,
    voice: TtsVoice = 'nova',
    model: 'tts-1' | 'tts-1-hd' = 'tts-1',
    provider: 'openai' | 'elevenlabs' = 'openai',
    elevenLabsVoiceId?: string,
  ): Promise<TtsResult> {
    if (!text || text.trim().length === 0) {
      throw new Error('Texto e obrigatorio para gerar audio')
    }

    if (text.length > 4096) {
      throw new Error('Texto muito longo. Maximo de 4096 caracteres.')
    }

    if (provider === 'elevenlabs') {
      return this.textToSpeechElevenLabs(text, elevenLabsVoiceId)
    }

    return this.textToSpeechOpenAI(text, voice, model)
  }

  private async textToSpeechOpenAI(
    text: string,
    voice: TtsVoice,
    model: 'tts-1' | 'tts-1-hd',
  ): Promise<TtsResult> {
    const openaiApiKey = process.env.OPENAI_API_KEY

    if (!openaiApiKey) {
      throw new Error('Chave da API OpenAI nao configurada')
    }

    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: model,
          voice: voice,
          input: text,
          response_format: 'mp3',
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('OpenAI TTS API error:', response.status, errorText)
        throw new Error(`OpenAI TTS API error: ${response.status}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const base64 = buffer.toString('base64')
      const audioBase64 = `data:audio/mp3;base64,${base64}`

      console.log(`TTS OpenAI gerado: ${buffer.length} bytes, voice: ${voice}, model: ${model}, texto: "${text.substring(0, 80)}..."`)


      return {
        audioBase64,
        contentType: 'audio/mp3',
      }
    } catch (error: any) {
      console.error('Erro ao gerar TTS OpenAI:', error)
      throw error
    }
  }

  private async textToSpeechElevenLabs(
    text: string,
    voiceId?: string,
  ): Promise<TtsResult> {
    const apiKey = process.env.ELEVENLABS_API_KEY

    if (!apiKey) {
      throw new Error('Chave da API ElevenLabs nao configurada')
    }

    if (!voiceId) {
      throw new Error('Voice ID da ElevenLabs nao configurado')
    }

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': apiKey,
          },
          body: JSON.stringify({
            text: text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        },
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('ElevenLabs API error:', response.status, errorText)
        throw new Error(`ElevenLabs API error: ${response.status}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const base64 = buffer.toString('base64')
      const audioBase64 = `data:audio/mpeg;base64,${base64}`

      console.log(`TTS ElevenLabs gerado: ${buffer.length} bytes, voiceId: ${voiceId}`)

      return {
        audioBase64,
        contentType: 'audio/mpeg',
      }
    } catch (error: any) {
      console.error('Erro ao gerar TTS ElevenLabs:', error)
      throw error
    }
  }

  async speechToText(audioBuffer: Buffer, filename: string): Promise<{ text: string }> {
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      throw new Error('Chave da API OpenAI nao configurada')
    }

    try {
      const formData = new FormData()
      formData.append('file', new Blob([audioBuffer]), filename)
      formData.append('model', 'whisper-1')
      formData.append('language', 'pt')

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiApiKey}` },
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('OpenAI Whisper API error:', response.status, errorText)
        throw new Error(`OpenAI Whisper API error: ${response.status}`)
      }

      const result = await response.json() as { text: string }
      console.log(`STT gerado: "${result.text.substring(0, 80)}..." from ${filename}`)
      return { text: result.text }
    } catch (error: any) {
      console.error('Erro ao transcrever audio:', error)
      throw error
    }
  }

  async cloneVoiceElevenLabs(
    name: string,
    audioBuffer: Buffer,
    audioFilename: string,
  ): Promise<{ voiceId: string }> {
    const apiKey = process.env.ELEVENLABS_API_KEY

    if (!apiKey) {
      throw new Error('Chave da API ElevenLabs nao configurada')
    }

    if (!name || name.trim().length === 0) {
      throw new Error('Nome da voz e obrigatorio')
    }

    try {
      const formData = new FormData()
      formData.append('name', name)
      formData.append(
        'files',
        new Blob([audioBuffer]),
        audioFilename,
      )
      formData.append('description', `Voz clonada via ScarlatChat - ${name}`)

      const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('ElevenLabs Clone API error:', response.status, errorText)

        // Tenta extrair mensagem amigável
        try {
          const errorData = JSON.parse(errorText)
          if (errorData?.detail?.status === 'can_not_use_instant_voice_cloning') {
            throw new Error('Seu plano da ElevenLabs nao suporta clonagem de voz. Faca upgrade para o plano Starter ou superior.')
          }
          if (errorData?.detail?.message) {
            throw new Error(errorData.detail.message)
          }
        } catch (parseError: any) {
          if (parseError.message.includes('ElevenLabs') || parseError.message.includes('plano') || parseError.message.includes('upgrade')) {
            throw parseError
          }
        }

        throw new Error(`Erro na API ElevenLabs: ${response.status}`)
      }

      const data = (await response.json()) as { voice_id: string }
      console.log(`Voz clonada com sucesso: ${data.voice_id}, nome: ${name}`)

      return { voiceId: data.voice_id }
    } catch (error: any) {
      console.error('Erro ao clonar voz:', error)
      throw error
    }
  }

  async listElevenLabsVoices(): Promise<
    Array<{ voiceId: string; name: string; category: string; previewUrl?: string }>
  > {
    const apiKey = process.env.ELEVENLABS_API_KEY

    if (!apiKey) {
      throw new Error('Chave da API ElevenLabs nao configurada')
    }

    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
        },
      })

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`)
      }

      const data = (await response.json()) as {
        voices: Array<{
          voice_id: string
          name: string
          category: string
          preview_url?: string
          labels?: Record<string, string>
        }>
      }

      return data.voices.map((v) => ({
        voiceId: v.voice_id,
        name: v.name,
        category: v.category,
        previewUrl: v.preview_url,
      }))
    } catch (error: any) {
      console.error('Erro ao listar vozes ElevenLabs:', error)
      throw error
    }
  }

  // ======================================================
  // Gerador de Bot com IA
  // ======================================================

  private readonly VALID_NODE_TYPES = new Set([
    'start', 'send_message', 'ask_question', 'buttons', 'list',
    'condition', 'set_variable', 'http_request', 'delay', 'ai_response', 'end',
  ])

  private buildGenerateBotSystemPrompt(): string {
    return `Voce e um arquiteto de bots para WhatsApp. Gere bots profissionais seguindo o schema JSON fornecido.

REGRAS DE EDGES (sourceHandle):
- Nos lineares (start, send_message, ask_question, set_variable, delay, ai_response, http_request): sourceHandle = null
- buttons: sourceHandle = id do botao (btn_1, btn_2, btn_3). Max 3 botoes.
- list: sourceHandle = rowId (row_1, row_2). Use para 4+ opcoes.
- condition: sourceHandle = id da condicao (cond_1) ou "else". SEMPRE inclua "else".
- Todo no exceto "end" DEVE ter edge saindo. Todo caminho termina em "end".

REGRAS:
- IDs: node_1, node_2... Edges: edge_X_Y. Positions: { x: 0, y: 0 } sempre.
- Campos nao usados por um tipo de no devem ser null.
- headersJson: string JSON para headers HTTP (ex: "{\\"Content-Type\\": \\"application/json\\"}").
- validation.type: "none", "email", "phone", "number" ou "options".
- Mensagens curtas (2-3 linhas), delays 1500-2000ms entre mensagens, colete nome no inicio ({{cliente_nome}}), ofereca falar com humano, emojis com moderacao, portugues BR, variaveis em snake_case.`
  }

  private buildBotJsonSchema() {
    const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] })
    const ns = nullable({ type: 'string' })
    const nn = nullable({ type: 'number' })
    const nb = nullable({ type: 'boolean' })

    return {
      name: 'bot_definition',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          nodes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                type: { type: 'string', enum: [...this.VALID_NODE_TYPES] },
                position: {
                  type: 'object',
                  properties: { x: { type: 'number' }, y: { type: 'number' } },
                  required: ['x', 'y'],
                  additionalProperties: false,
                },
                data: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    welcomeMessage: ns,
                    messageType: ns,
                    message: ns,
                    question: ns,
                    variableName: ns,
                    validation: nullable({
                      type: 'object',
                      properties: {
                        type: { type: 'string' },
                        value: ns,
                        errorMessage: ns,
                      },
                      required: ['type', 'value', 'errorMessage'],
                      additionalProperties: false,
                    }),
                    title: ns,
                    description: ns,
                    buttons: nullable({
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: { id: { type: 'string' }, text: { type: 'string' } },
                        required: ['id', 'text'],
                        additionalProperties: false,
                      },
                    }),
                    buttonText: ns,
                    sections: nullable({
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          title: { type: 'string' },
                          rows: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: { rowId: { type: 'string' }, title: { type: 'string' }, description: ns },
                              required: ['rowId', 'title', 'description'],
                              additionalProperties: false,
                            },
                          },
                        },
                        required: ['title', 'rows'],
                        additionalProperties: false,
                      },
                    }),
                    conditions: nullable({
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          label: { type: 'string' },
                          operator: { type: 'string' },
                          variable: { type: 'string' },
                          value: { type: 'string' },
                        },
                        required: ['id', 'label', 'operator', 'variable', 'value'],
                        additionalProperties: false,
                      },
                    }),
                    assignments: nullable({
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: { variable: { type: 'string' }, value: { type: 'string' } },
                        required: ['variable', 'value'],
                        additionalProperties: false,
                      },
                    }),
                    method: ns,
                    url: ns,
                    headersJson: ns,
                    body: ns,
                    responseVariable: ns,
                    timeout: nn,
                    delayMs: nn,
                    systemPrompt: ns,
                    temperature: nn,
                    maxTokens: nn,
                    includeSessionContext: nb,
                    finalMessage: ns,
                    transferToHuman: nb,
                    transferDepartmentId: ns,
                  },
                  required: [
                    'label', 'welcomeMessage', 'messageType', 'message', 'question',
                    'variableName', 'validation', 'title', 'description', 'buttons',
                    'buttonText', 'sections', 'conditions', 'assignments', 'method',
                    'url', 'headersJson', 'body', 'responseVariable', 'timeout',
                    'delayMs', 'systemPrompt', 'temperature', 'maxTokens',
                    'includeSessionContext', 'finalMessage', 'transferToHuman',
                    'transferDepartmentId',
                  ],
                  additionalProperties: false,
                },
              },
              required: ['id', 'type', 'position', 'data'],
              additionalProperties: false,
            },
          },
          edges: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                source: { type: 'string' },
                target: { type: 'string' },
                sourceHandle: ns,
              },
              required: ['id', 'source', 'target', 'sourceHandle'],
              additionalProperties: false,
            },
          },
        },
        required: ['nodes', 'edges'],
        additionalProperties: false,
      },
    }
  }

  async generateBot(prompt: string): Promise<{ nodes: any[]; edges: any[] }> {
    const openaiApiKey = process.env.OPENAI_API_KEY

    if (!openaiApiKey) {
      throw new Error('Chave da API OpenAI nao configurada')
    }

    const systemPrompt = this.buildGenerateBotSystemPrompt()

    const userPrompt = `Descricao do bot desejado:\n\n${prompt}\n\nGere o bot completo. Seja detalhado: mensagens profissionais, coleta de dados quando relevante, delays entre mensagens, e opcao de falar com humano.`

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4096,
          response_format: { type: 'json_schema', json_schema: this.buildBotJsonSchema() },
        }),
        signal: AbortSignal.timeout(150000),
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
      const content = data.choices?.[0]?.message?.content || '{}'

      const parsed = JSON.parse(content)
      let nodes = parsed.nodes || []
      let edges = parsed.edges || []

      // Validacao e sanitizacao
      nodes = this.sanitizeNodes(nodes)
      edges = this.sanitizeEdges(edges, nodes)

      if (nodes.length === 0) {
        throw new Error('A IA nao gerou nos validos')
      }

      // Calcular layout automatico (tree layout)
      nodes = this.calculateLayout(nodes, edges)

      console.log(`Bot gerado com IA: ${nodes.length} nos, ${edges.length} edges`)

      return { nodes, edges }
    } catch (error: any) {
      console.error('Erro ao gerar bot com IA:', error)
      if (error.message.includes('OpenAI API error') || error.message.includes('nao configurada')) {
        throw error
      }
      throw new Error('Erro ao gerar bot. Tente novamente com uma descricao diferente.')
    }
  }

  /**
   * Sanitiza nos: garante tipos validos, IDs unicos, campos obrigatorios, e no start
   */
  private sanitizeNodes(nodes: any[]): any[] {
    if (!Array.isArray(nodes)) return []

    const seenIds = new Set<string>()
    const sanitized: any[] = []

    for (const node of nodes) {
      if (!node || !node.id || !node.type) continue
      if (!this.VALID_NODE_TYPES.has(node.type)) continue
      if (seenIds.has(node.id)) continue

      seenIds.add(node.id)

      // Garantir campos obrigatorios
      if (!node.data) node.data = {}
      if (!node.data.label) node.data.label = node.label || node.type
      if (!node.position) node.position = { x: 0, y: 0 }

      // Sanitizar data por tipo
      switch (node.type) {
        case 'send_message':
          if (!node.data.messageType) node.data.messageType = 'text'
          if (!node.data.message) node.data.message = ''
          break
        case 'ask_question':
          if (!node.data.question) node.data.question = ''
          if (!node.data.variableName) node.data.variableName = 'resposta'
          if (!node.data.validation) node.data.validation = { type: 'none' }
          break
        case 'buttons':
          if (!node.data.title) node.data.title = ''
          if (!node.data.description) node.data.description = ''
          if (!Array.isArray(node.data.buttons) || node.data.buttons.length === 0) {
            node.data.buttons = [{ id: 'btn_1', text: 'Opcao 1' }]
          }
          // Garantir que botoes tenham ids
          node.data.buttons = node.data.buttons.map((btn: any, i: number) => ({
            id: btn.id || `btn_${i + 1}`,
            text: btn.text || `Opcao ${i + 1}`,
          }))
          break
        case 'list':
          if (!node.data.title) node.data.title = ''
          if (!node.data.description) node.data.description = ''
          if (!node.data.buttonText) node.data.buttonText = 'Ver opcoes'
          if (!Array.isArray(node.data.sections) || node.data.sections.length === 0) {
            node.data.sections = [{ title: 'Opcoes', rows: [{ rowId: 'row_1', title: 'Opcao 1' }] }]
          }
          // Garantir rowIds
          for (const section of node.data.sections) {
            if (!Array.isArray(section.rows)) section.rows = []
            section.rows = section.rows.map((row: any, i: number) => ({
              rowId: row.rowId || `row_${i + 1}`,
              title: row.title || `Opcao ${i + 1}`,
              description: row.description,
            }))
          }
          break
        case 'condition':
          if (!Array.isArray(node.data.conditions) || node.data.conditions.length === 0) {
            node.data.conditions = [{ id: 'cond_1', label: 'Condicao 1', operator: 'equals', variable: '', value: '' }]
          }
          node.data.conditions = node.data.conditions.map((c: any, i: number) => ({
            id: c.id || `cond_${i + 1}`,
            label: c.label || `Condicao ${i + 1}`,
            operator: c.operator || 'equals',
            variable: c.variable || '',
            value: c.value || '',
          }))
          break
        case 'set_variable':
          if (!Array.isArray(node.data.assignments) || node.data.assignments.length === 0) {
            node.data.assignments = [{ variable: '', value: '' }]
          }
          break
        case 'http_request':
          if (!node.data.method) node.data.method = 'GET'
          if (!node.data.url) node.data.url = ''
          if (!node.data.timeout) node.data.timeout = 10000
          if (node.data.headersJson && typeof node.data.headersJson === 'string') {
            try { node.data.headers = JSON.parse(node.data.headersJson) } catch { node.data.headers = {} }
          }
          delete node.data.headersJson
          break
        case 'delay':
          if (!node.data.delayMs) node.data.delayMs = 2000
          break
        case 'ai_response':
          if (!node.data.systemPrompt) node.data.systemPrompt = ''
          if (node.data.temperature === undefined) node.data.temperature = 0.7
          if (node.data.maxTokens === undefined) node.data.maxTokens = 300
          if (node.data.includeSessionContext === undefined) node.data.includeSessionContext = true
          break
      }

      // Limpar campos null vindos do structured output
      for (const key of Object.keys(node.data)) {
        if (node.data[key] === null) delete node.data[key]
      }

      sanitized.push(node)
    }

    // Garantir que existe um no start
    if (!sanitized.some((n) => n.type === 'start')) {
      sanitized.unshift({
        id: 'node_0',
        type: 'start',
        position: { x: 0, y: 0 },
        data: { label: 'Inicio' },
      })
    }

    return sanitized
  }

  /**
   * Sanitiza edges: remove duplicados, edges orfaos, e garante ids
   */
  private sanitizeEdges(edges: any[], nodes: any[]): any[] {
    if (!Array.isArray(edges)) return []

    const nodeIds = new Set(nodes.map((n) => n.id))
    const seenIds = new Set<string>()
    const sanitized: any[] = []

    for (const edge of edges) {
      if (!edge || !edge.source || !edge.target) continue
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue

      const id = edge.id || `edge_${edge.source}_${edge.sourceHandle || ''}_${edge.target}`
      if (seenIds.has(id)) continue
      seenIds.add(id)

      const sanitizedEdge: any = { id, source: edge.source, target: edge.target }
      if (edge.sourceHandle) sanitizedEdge.sourceHandle = edge.sourceHandle

      sanitized.push(sanitizedEdge)
    }

    return sanitized
  }

  /**
   * Calcula layout automatico em arvore (top-down)
   * Usa BFS a partir do no start para posicionar nos em niveis
   */
  private calculateLayout(nodes: any[], edges: any[]): any[] {
    const NODE_HEIGHT_GAP = 200
    const BRANCH_GAP = 320

    // Construir grafo de adjacencia
    const children = new Map<string, string[]>()
    const parentCount = new Map<string, number>()

    for (const node of nodes) {
      children.set(node.id, [])
      parentCount.set(node.id, 0)
    }

    for (const edge of edges) {
      const ch = children.get(edge.source)
      if (ch) ch.push(edge.target)
      parentCount.set(edge.target, (parentCount.get(edge.target) || 0) + 1)
    }

    // BFS por niveis a partir do start
    const startNode = nodes.find((n) => n.type === 'start')
    if (!startNode) return nodes

    const levels = new Map<string, number>()
    const queue: string[] = [startNode.id]
    levels.set(startNode.id, 0)

    while (queue.length > 0) {
      const current = queue.shift()!
      const currentLevel = levels.get(current)!
      const ch = children.get(current) || []

      for (const child of ch) {
        if (!levels.has(child) || levels.get(child)! < currentLevel + 1) {
          levels.set(child, currentLevel + 1)
          queue.push(child)
        }
      }
    }

    // Atribuir nivel 0 a nos orfaos (sem nivel atribuido)
    let maxLevel = 0
    for (const node of nodes) {
      if (!levels.has(node.id)) {
        maxLevel++
        levels.set(node.id, maxLevel)
      }
      maxLevel = Math.max(maxLevel, levels.get(node.id)!)
    }

    // Agrupar nos por nivel
    const levelGroups = new Map<number, string[]>()
    for (const node of nodes) {
      const level = levels.get(node.id) || 0
      if (!levelGroups.has(level)) levelGroups.set(level, [])
      levelGroups.get(level)!.push(node.id)
    }

    // Posicionar nos
    const nodeMap = new Map(nodes.map((n) => [n.id, n]))

    for (const [level, nodeIds] of levelGroups) {
      const count = nodeIds.length
      const totalWidth = (count - 1) * BRANCH_GAP
      const startX = 400 - totalWidth / 2

      nodeIds.forEach((id, index) => {
        const node = nodeMap.get(id)
        if (node) {
          node.position = {
            x: Math.round(startX + index * BRANCH_GAP),
            y: 50 + level * NODE_HEIGHT_GAP,
          }
        }
      })
    }

    return nodes
  }

  async getConfig() {
    return await this.iaRepository.getConfig()
  }

  async saveConfig(config: any) {
    return await this.iaRepository.saveConfig(config)
  }
}
