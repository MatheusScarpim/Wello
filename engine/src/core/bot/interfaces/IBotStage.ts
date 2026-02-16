/**
 * Contexto da mensagem recebida
 */
export interface MessageContext {
  conversationId: string
  identifier: string
  message: string
  name: string
  provider: string
  type: string
  idMessage: string
  quotedMsg?: string
  identifierProvider?: string
  photo?: string
  mediaUrl?: string
  mediaStorage?: {
    provider: 'azure_blob'
    blobName: string
    container: string
    size: number
  }
  sessionData?: Record<string, any>
}

/**
 * Resposta do estágio
 */
export interface StageResponse {
  message?: string
  media?: {
    type: 'image' | 'document' | 'audio' | 'video'
    url?: string
    base64?: string
    caption?: string
    filename?: string
  }
  // Lista interativa
  list?: {
    title: string
    description: string
    buttonText: string
    sections: Array<{
      title: string
      rows: Array<{
        rowId: string
        title: string
        description?: string
      }>
    }>
  }
  // Botões interativos
  buttons?: {
    title: string
    description: string
    buttons: Array<{
      id: string
      text: string
    }>
    footer?: string
  }
  // Localização
  location?: {
    latitude: number
    longitude: number
    title?: string
    address?: string
  }
  // Contato
  contact?: {
    contactId: string
  }
  nextStage?: number
  updateSessionData?: Record<string, any>
  endSession?: boolean
  skipMessage?: boolean
  transferToHuman?: boolean
  transferDepartmentId?: string
}

/**
 * Interface para validação de entrada
 */
export interface ValidationResult {
  isValid: boolean
  error?: string
  sanitizedValue?: any
}

/**
 * Interface base para estágios de bot
 */
export interface IBotStage {
  /**
   * Número do estágio
   */
  readonly stageNumber: number

  /**
   * Descrição do estágio (para debug/logs)
   */
  readonly description?: string

  /**
   * Executa o estágio
   */
  execute(context: MessageContext): Promise<StageResponse>

  /**
   * Valida a entrada do usuário (opcional)
   */
  validate?(input: string, context: MessageContext): Promise<ValidationResult>

  /**
   * Hook executado antes do processamento (opcional)
   */
  beforeExecute?(context: MessageContext): Promise<void>

  /**
   * Hook executado após o processamento (opcional)
   */
  afterExecute?(context: MessageContext, response: StageResponse): Promise<void>
}
