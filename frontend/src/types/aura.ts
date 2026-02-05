export type AuraChartType = 'bar' | 'doughnut' | 'line' | 'area'

export interface AuraChart {
  type?: AuraChartType
  data?: Record<string, unknown>[]
  xKey?: string
  yKey?: string
  title?: string
}

export interface AuraWebhookPayload {
  userMessage: string
  company: string
  branch: string
  userId: string
  chatId: string
}

export interface AuraWebhookResponse {
  type?: string
  sql?: string
  summary?: string
  message?: string
  chatId?: string
  historyId?: string
  elapsedMs?: number
  rows?: Record<string, unknown>[]
  columns?: string[]
  chart?: AuraChart
  tokenUsage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}

export interface AuraFeedbackPayload {
  type: 'feedback'
  historyId: string
  favorite: boolean
}
