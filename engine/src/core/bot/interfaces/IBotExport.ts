/**
 * Interface para exportação/importação de Bots
 * Formato de arquivo .jn (JuNexum)
 */

/**
 * Representa um estágio exportado
 */
export interface ExportedStage {
  stageNumber: number
  description: string
  type: 'message' | 'list' | 'buttons' | 'custom'
  content?: {
    message?: string
    list?: {
      title: string
      description: string
      buttonText: string
      sections: Array<{
        title: string
        rows: Array<{
          rowId: string
          title: string
          description: string
        }>
      }>
    }
    buttons?: {
      title: string
      description: string
      buttons: Array<{
        id: string
        text: string
      }>
      footer?: string
    }
  }
  validation?: {
    type: 'options' | 'regex' | 'length' | 'custom'
    value?: any
    errorMessage?: string
  }
  nextStage?: number
  updateSessionData?: boolean
  sessionDataFields?: string[]
}

/**
 * Configuração do Bot exportado
 */
export interface ExportedBotConfig {
  id: string
  name: string
  description: string
  version: string
  createdAt: string
  updatedAt: string
  initialStage: number
  sessionTimeout: number
  enableAnalytics: boolean
  stages: ExportedStage[]
  metadata?: {
    author?: string
    tags?: string[]
    category?: string
    [key: string]: any
  }
}

/**
 * Formato completo do arquivo .jn
 */
export interface JNFileFormat {
  fileVersion: '1.0.0'
  exportDate: string
  exportedBy?: string
  bot: ExportedBotConfig
  checksum?: string
}

/**
 * Resultado da importação
 */
export interface ImportResult {
  success: boolean
  botId?: string
  message: string
  errors?: string[]
  warnings?: string[]
}

/**
 * Resultado da exportação
 */
export interface ExportResult {
  success: boolean
  filename: string
  filepath?: string
  data?: JNFileFormat
  message: string
}
