import { ConversationRepository } from '../repositories/ConversationRepository'
import { IaRepository } from '../repositories/IaRepository'
import { MessageRepository } from '../repositories/MessageRepository'

export interface SuggestionResult {
  suggestion: string
  confidence: number
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

    const data = await response.json()
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

    const data = await response.json()
    const improved = data.choices?.[0]?.message?.content || ''

    // Clean and return
    return this.cleanSuggestion(improved) || originalMessage
  }

  async getConfig() {
    return await this.iaRepository.getConfig()
  }

  async saveConfig(config: any) {
    return await this.iaRepository.saveConfig(config)
  }
}
