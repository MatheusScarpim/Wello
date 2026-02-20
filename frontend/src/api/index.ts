import apiClient from './client'
import type {
  HealthResponse,
  StatusResponse,
  WhatsAppStatus,
  AuthToken,
  AuthLoginResponse,
  TokenPayload,
  Conversation,
  Contact,
  UpdateContactPayload,
  ContactConversationCheck,
  CreateConversationPayload,
  Message,
  SendMessagePayload,
  BotListResponse,
  BotSession,
  BotExport,
  Webhook,
  WebhookPayload,
  WebhookStats,
  StorageConfig,
  StorageConfigPayload,
  UploadResult,
  StorageStatus,
  Expense,
  ExpensePayload,
  WeeklySheet,
  PaginatedResponse,
  ConversationFilters,
  MessageFilters,
  ExpenseFilters,
  WebhookFilters,
  // Omnichannel types
  Department,
  DepartmentPayload,
  Operator,
  OperatorPayload,
  OperatorStatus,
  QueueItem,
  QueueFilters,
  TransferPayload,
  Finalization,
  FinalizationPayload,
  WhitelabelSettings,
  WhitelabelPayload,
  CannedResponse,
  CannedResponsePayload,
  Tag,
  TagPayload,
  DashboardMetrics,
  // WhatsApp Multi-Instance types
  WhatsAppInstance,
  WhatsAppInstancePayload,
  WhatsAppInstancesStatus,
  // Finalization Metrics types
  FinalizationMetrics,
  FinalizationDetail,
  MetricsPeriod,
  // Message Metrics types
  MessageMetrics,
  // Pipeline types
  PipelineStage,
  PipelineStagePayload,
  PipelineBoardColumn,
  PipelineMetrics,
  // Appointment types
  Appointment,
  AppointmentPayload,
  AppointmentStatus,
  TimeSlot,
  AvailabilitySettings,
  // Service types
  Service,
  ServicePayload,
  // Professional types
  Professional,
  ProfessionalPayload,
  // Google Calendar types
  GoogleCalendarStatus,
  GoogleCalendarSyncResult,
  // WhatsApp Features types
  ReactionPayload,
  ForwardPayload,
  BroadcastPayload,
} from '@/types'

// Health & Status
export const healthApi = {
  getHealth: () => apiClient.get<HealthResponse>('/health'),
  getStatus: () => apiClient.get<StatusResponse>('/status'),
}

// Auth
export const authApi = {
  generateToken: (payload: { userId: string; email: string; role: string; expiresIn?: string; description?: string }) =>
    apiClient.post<AuthToken>('/api/auth/token/generate', payload),
  login: (payload: { email: string; password: string; remember?: boolean; expiresIn?: string }) =>
    apiClient.post<AuthLoginResponse>('/api/auth/login', payload),
  validateToken: (token: string) =>
    apiClient.post<TokenPayload>('/api/auth/token/validate', { token }),
  getInfo: () => apiClient.get('/api/auth/info'),
  testAuth: () => apiClient.get('/api/auth/test'),
}

// WhatsApp (Legacy - Single Instance)
export const whatsappApi = {
  getStatus: () => apiClient.get<WhatsAppStatus>('/api/whatsapp/status'),
  reconnect: () => apiClient.post('/api/whatsapp/reconnect'),
  disconnect: () => apiClient.post('/api/whatsapp/disconnect'),
  getQrCode: () => apiClient.get('/api/whatsapp/qrcode'),
}

// WhatsApp Instances (Multi-Instance)
export const whatsappInstancesApi = {
  // List all instances
  list: () =>
    apiClient.get<WhatsAppInstance[]>('/api/whatsapp/instances'),
  // Get status of all instances
  getStatus: () =>
    apiClient.get<WhatsAppInstancesStatus>('/api/whatsapp/instances/status'),
  // Get specific instance
  getById: (id: string) =>
    apiClient.get<WhatsAppInstance>(`/api/whatsapp/instances/${id}`),
  // Create new instance
  create: (payload: WhatsAppInstancePayload) =>
    apiClient.post<WhatsAppInstance>('/api/whatsapp/instances', payload),
  // Update instance
  update: (id: string, payload: Partial<WhatsAppInstancePayload>) =>
    apiClient.put<WhatsAppInstance>(`/api/whatsapp/instances/${id}`, payload),
  // Delete instance
  delete: (id: string) =>
    apiClient.delete(`/api/whatsapp/instances/${id}`),
  // Connect instance
  connect: (id: string) =>
    apiClient.post(`/api/whatsapp/instances/${id}/connect`),
  // Disconnect instance
  disconnect: (id: string) =>
    apiClient.post(`/api/whatsapp/instances/${id}/disconnect`),
  // Get QR Code for instance
  getQrCode: (id: string) =>
    apiClient.get<{ qrCode: string | null }>(`/api/whatsapp/instances/${id}/qrcode`),
  // Set instance as default
  setDefault: (id: string) =>
    apiClient.post(`/api/whatsapp/instances/${id}/default`),
  // Transfer conversations between instances
  transferConversations: (payload: {
    sourceInstanceId: string
    targetInstanceId: string
    filter?: {
      mode: 'all' | 'by_status'
      statuses?: string[]
    }
  }) =>
    apiClient.post<{ transferred: number; skipped: number; errors: string[] }>(
      '/api/whatsapp/instances/transfer-conversations',
      payload,
    ),
}

// Conversations
export const conversationsApi = {
  list: (filters?: ConversationFilters) =>
    apiClient.get<PaginatedResponse<Conversation>>('/api/conversations', filters as Record<string, unknown>),
  getById: (id: string) =>
    apiClient.get<Conversation>(`/api/conversations/${id}`),
  create: (payload: CreateConversationPayload) =>
    apiClient.post<Conversation>('/api/conversations/create', payload),
  update: (id: string, payload: Partial<Conversation>) =>
    apiClient.put(`/api/conversations/${id}`, payload),
  archive: (id: string) =>
    apiClient.patch(`/api/conversations/${id}/archive`),
  unarchive: (id: string) =>
    apiClient.patch(`/api/conversations/${id}/unarchive`),
  assignOperator: (id: string, operatorId: string, operatorName: string, suppressAutomaticMessage?: boolean) =>
    apiClient.patch(`/api/conversations/${id}/assign-operator`, {
      operatorId,
      operatorName,
      suppressAutomaticMessage
    }),
}

export const contactsApi = {
  list: (filters?: { page?: number; limit?: number; search?: string; provider?: string }) =>
    apiClient.get<PaginatedResponse<Contact>>('/api/contacts', filters as Record<string, unknown>),
  create: (payload: CreateContactPayload) =>
    apiClient.post<Contact>('/api/contacts', payload),
  getById: (id: string) =>
    apiClient.get<Contact>(`/api/contacts/${id}`),
  update: (id: string, payload: UpdateContactPayload) =>
    apiClient.put<Contact>(`/api/contacts/${id}`, payload),
  delete: (id: string) =>
    apiClient.delete(`/api/contacts/${id}`),
  checkConversation: (id: string) =>
    apiClient.get<ContactConversationCheck>(`/api/contacts/${id}/conversation`),
}

// Messages
export const messagesApi = {
  list: (filters: MessageFilters) =>
    apiClient.get<PaginatedResponse<Message>>('/api/messages', filters as Record<string, unknown>),
  getById: (id: string) =>
    apiClient.get<Message>(`/api/messages/${id}`),
  send: (payload: SendMessagePayload) =>
    apiClient.post<{ success: boolean; messageId: string; provider: string }>('/api/messages/send', payload, { timeout: 300000 }),
  markAsRead: (id: string) =>
    apiClient.patch(`/api/messages/${id}/read`),
  getMedia: (id: string) =>
    apiClient.get<{ mediaUrl: string }>(`/api/messages/${id}/media`),
  delete: (id: string) =>
    apiClient.delete(`/api/messages/${id}`),
  sendNote: (conversationId: string, message: string) =>
    apiClient.post<Message>('/api/messages/note', { conversationId, message }),
}

// Bots
export const botsApi = {
  list: () => apiClient.get<BotListResponse>('/api/bots/list'),
  activate: (conversationId: string, botId: string) =>
    apiClient.post('/api/bots/activate', { conversationId, botId }),
  deactivate: (conversationId: string) =>
    apiClient.post('/api/bots/deactivate', { conversationId }),
  getSession: (conversationId: string) =>
    apiClient.get<BotSession>(`/api/bots/session/${conversationId}`),
  reset: (conversationId: string) =>
    apiClient.post('/api/bots/reset', { conversationId }),
  reload: (botId: string) =>
    apiClient.post(`/api/bots/reload/${botId}`),
  // Export/Import
  export: (botId: string, exportedBy?: string, metadata?: Record<string, unknown>) =>
    apiClient.post<{ filename: string }>(`/api/bots/${botId}/export`, { exportedBy, metadata }),
  import: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.upload<{ botId: string }>('/api/bots/import', formData)
  },
  listExports: () => apiClient.get<{ exports: BotExport[] }>('/api/bots/exports'),
  downloadExport: (filename: string) => apiClient.download(`/api/bots/export/${filename}/download`),
  getExportInfo: (filename: string) => apiClient.get<BotExport>(`/api/bots/export/${filename}/info`),
  deleteExport: (filename: string) => apiClient.delete(`/api/bots/export/${filename}`),
}

// Webhooks
export const webhooksApi = {
  list: (filters?: WebhookFilters) =>
    apiClient.get<PaginatedResponse<Webhook>>('/api/webhooks', filters as Record<string, unknown>),
  getById: (id: string) =>
    apiClient.get<Webhook>(`/api/webhooks/${id}`),
  create: (payload: WebhookPayload) =>
    apiClient.post<Webhook>('/api/webhooks', payload),
  update: (id: string, payload: Partial<WebhookPayload>) =>
    apiClient.put(`/api/webhooks/${id}`, payload),
  delete: (id: string) =>
    apiClient.delete(`/api/webhooks/${id}`),
  enable: (id: string) =>
    apiClient.post(`/api/webhooks/${id}/enable`),
  disable: (id: string) =>
    apiClient.post(`/api/webhooks/${id}/disable`),
  test: (id: string) =>
    apiClient.post<{ success: boolean }>(`/api/webhooks/${id}/test`),
  getEvents: () =>
    apiClient.get<{ events: string[] }>('/api/webhooks/events'),
  getStats: () =>
    apiClient.get<WebhookStats>('/api/webhooks/stats'),
}

// Storage
export const storageApi = {
  listConfigs: () => apiClient.get<{ configs: StorageConfig[] }>('/api/storage/config'),
  getActiveConfig: () => apiClient.get<{ config: StorageConfig }>('/api/storage/config/active'),
  createConfig: (payload: StorageConfigPayload) =>
    apiClient.post<{ config: StorageConfig }>('/api/storage/config', payload),
  updateConfig: (id: string, payload: Partial<StorageConfigPayload>) =>
    apiClient.put<{ config: StorageConfig }>(`/api/storage/config/${id}`, payload),
  deleteConfig: (id: string) =>
    apiClient.delete(`/api/storage/config/${id}`),
  uploadFile: (file: File, userId?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    if (userId) formData.append('userId', userId)
    return apiClient.upload<{ result: UploadResult }>('/api/storage/upload/file', formData)
  },
  uploadBase64: (base64Data: string, fileName: string, contentType: string) =>
    apiClient.post<{ result: UploadResult }>('/api/storage/upload/base64', { base64Data, fileName, contentType }),
  uploadUrl: (url: string, fileName: string, contentType: string) =>
    apiClient.post<{ result: UploadResult }>('/api/storage/upload/url', { url, fileName, contentType }),
  deleteBlob: (blobName: string) =>
    apiClient.delete(`/api/storage/blob/${blobName}`),
  listBlobs: (prefix?: string) =>
    apiClient.get<{ blobs: string[]; count: number }>('/api/storage/blobs', { prefix }),
  getStatus: () =>
    apiClient.get<StorageStatus>('/api/storage/status'),
}

// Expenses
export const expensesApi = {
  list: (filters?: ExpenseFilters) =>
    apiClient.get<PaginatedResponse<Expense>>('/api/expenses', filters as Record<string, unknown>),
  getById: (id: string) =>
    apiClient.get<Expense>(`/api/expenses/${id}`),
  create: (payload: ExpensePayload) =>
    apiClient.post<Expense>('/api/expenses', payload),
  update: (id: string, payload: Partial<ExpensePayload>) =>
    apiClient.put(`/api/expenses/${id}`, payload),
  getWeeklySheet: (cliente?: string, data?: string) =>
    apiClient.get<WeeklySheet>('/api/expenses/weekly-sheet', { cliente, data }),
  getClients: (search?: string) =>
    apiClient.get<string[]>('/api/expenses/clients', { search }),
}

// ============================================
// OMNICHANNEL APIs
// ============================================

// Departments
export const departmentsApi = {
  list: () =>
    apiClient.get<Department[]>('/api/departments'),
  getById: (id: string) =>
    apiClient.get<Department>(`/api/departments/${id}`),
  create: (payload: DepartmentPayload) =>
    apiClient.post<Department>('/api/departments', payload),
  update: (id: string, payload: Partial<DepartmentPayload>) =>
    apiClient.put<Department>(`/api/departments/${id}`, payload),
  delete: (id: string) =>
    apiClient.delete(`/api/departments/${id}`),
  addOperator: (departmentId: string, operatorId: string) =>
    apiClient.post(`/api/departments/${departmentId}/operators`, { operatorId }),
  removeOperator: (departmentId: string, operatorId: string) =>
    apiClient.delete(`/api/departments/${departmentId}/operators/${operatorId}`),
  getStats: (id: string) =>
    apiClient.get<{ waiting: number; active: number; resolved: number }>(`/api/departments/${id}/stats`),
}

// Operators
export const operatorsApi = {
  list: (filters?: { departmentId?: string; status?: OperatorStatus }) =>
    apiClient.get<Operator[]>('/api/operators', filters as Record<string, unknown>),
  getById: (id: string) =>
    apiClient.get<Operator>(`/api/operators/${id}`),
  create: (payload: OperatorPayload) =>
    apiClient.post<Operator>('/api/operators', payload),
  update: (id: string, payload: Partial<OperatorPayload>) =>
    apiClient.put<Operator>(`/api/operators/${id}`, payload),
  delete: (id: string) =>
    apiClient.delete(`/api/operators/${id}`),
  updateStatus: (id: string, status: OperatorStatus) =>
    apiClient.patch<Operator>(`/api/operators/${id}/status`, { status }),
  getMetrics: (id: string) =>
    apiClient.get<Operator['metrics']>(`/api/operators/${id}/metrics`),
  getCurrentOperator: () =>
    apiClient.get<Operator>('/api/operators/me'),
}

// Queue / Attendance
export const queueApi = {
  list: (filters?: QueueFilters) =>
    apiClient.get<PaginatedResponse<QueueItem>>('/api/queue', filters as Record<string, unknown>),
  getById: (id: string) =>
    apiClient.get<QueueItem>(`/api/queue/${id}`),
  // Assume a conversation from queue
  assume: (conversationId: string) =>
    apiClient.post<QueueItem>(`/api/queue/${conversationId}/assume`),
  // Release conversation back to queue
  release: (conversationId: string) =>
    apiClient.post<QueueItem>(`/api/queue/${conversationId}/release`),
  // Transfer conversation
  transfer: (payload: TransferPayload) =>
    apiClient.post<QueueItem>('/api/queue/transfer', payload),
  // Resolve/close conversation
  resolve: (conversationId: string, payload?: { notes?: string; finalizationId?: string; finalizationIds?: string[] }) =>
    apiClient.post(`/api/queue/${conversationId}/resolve`, payload || {}),
  // Get queue stats
  getStats: () =>
    apiClient.get<{ waiting: number; inProgress: number; resolved: number; avgWaitTime: number }>('/api/queue/stats/overview'),
  // Add tags to conversation
  addTags: (conversationId: string, tags: string[]) =>
    apiClient.post(`/api/queue/${conversationId}/tags`, { tags }),
  // Add note to conversation
  addNote: (conversationId: string, note: string) =>
    apiClient.post(`/api/queue/${conversationId}/notes`, { note }),
}

export const finalizationsApi = {
  list: () => apiClient.get<Finalization[]>('/api/finalizations'),
  create: (payload: FinalizationPayload) => apiClient.post<Finalization>('/api/finalizations', payload),
  update: (id: string, payload: FinalizationPayload) => apiClient.put(`/api/finalizations/${id}`, payload),
  remove: (id: string) => apiClient.delete(`/api/finalizations/${id}`),
}

// Finalization Metrics
export const finalizationMetricsApi = {
  getMetrics: (params: {
    period: MetricsPeriod
    startDate?: string
    endDate?: string
    operatorId?: string
    finalizationType?: 'gain' | 'loss'
    finalizationId?: string
  }) => apiClient.get<FinalizationMetrics>('/api/finalization-metrics', params as Record<string, unknown>),

  getDetailedList: (params: {
    period: MetricsPeriod
    startDate?: string
    endDate?: string
    page?: number
    limit?: number
    operatorId?: string
    finalizationType?: 'gain' | 'loss'
    finalizationId?: string
  }) => apiClient.get<PaginatedResponse<FinalizationDetail>>('/api/finalization-metrics/list', params as Record<string, unknown>),
}

// Whitelabel Settings
export const whitelabelApi = {
  get: () =>
    apiClient.get<WhitelabelSettings>('/api/settings/whitelabel'),
  update: (payload: WhitelabelPayload) =>
    apiClient.put<WhitelabelSettings>('/api/settings/whitelabel', payload),
  uploadLogo: (file: File, type: 'logo' | 'logoSmall' | 'favicon' | 'loginBackground') => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)
    return apiClient.upload<{ url: string }>('/api/settings/whitelabel/logo', formData)
  },
  resetToDefault: () =>
    apiClient.post('/api/settings/whitelabel/reset'),
}

// Canned Responses (Quick Replies)
export const cannedResponsesApi = {
  list: (filters?: { departmentId?: string; search?: string }) =>
    apiClient.get<CannedResponse[]>('/api/canned-responses', filters as Record<string, unknown>),
  getById: (id: string) =>
    apiClient.get<CannedResponse>(`/api/canned-responses/${id}`),
  create: (payload: CannedResponsePayload) =>
    apiClient.post<CannedResponse>('/api/canned-responses', payload),
  update: (id: string, payload: Partial<CannedResponsePayload>) =>
    apiClient.put<CannedResponse>(`/api/canned-responses/${id}`, payload),
  delete: (id: string) =>
    apiClient.delete(`/api/canned-responses/${id}`),
}

// Tags
export const tagsApi = {
  list: () =>
    apiClient.get<Tag[]>('/api/tags'),
  create: (payload: TagPayload) =>
    apiClient.post<Tag>('/api/tags', payload),
  update: (id: string, payload: Partial<TagPayload>) =>
    apiClient.put<Tag>(`/api/tags/${id}`, payload),
  delete: (id: string) =>
    apiClient.delete(`/api/tags/${id}`),
}

// Dashboard Metrics
export const dashboardApi = {
  getMetrics: () =>
    apiClient.get<DashboardMetrics>('/api/dashboard/metrics'),
  getRealtimeStats: () =>
    apiClient.get<{
      onlineOperators: number
      waitingConversations: number
      activeConversations: number
    }>('/api/dashboard/realtime'),
}

// Message Metrics
export const messageMetricsApi = {
  getMetrics: (params: {
    period: MetricsPeriod
    startDate?: string
    endDate?: string
  }) => apiClient.get<MessageMetrics>('/api/message-metrics', params as Record<string, unknown>),
}

// IA (Inteligencia Artificial)
export const iaApi = {
  getCompanyDescription: () =>
    apiClient.get<{ description: string }>('/api/ia/company-description'),
  saveCompanyDescription: (description: string) =>
    apiClient.post('/api/ia/company-description', { description }),
  getSuggestionInstructions: () =>
    apiClient.get<{ instructions: string }>('/api/ia/suggestion-instructions'),
  saveSuggestionInstructions: (instructions: string) =>
    apiClient.post('/api/ia/suggestion-instructions', { instructions }),
  getSuggestion: (conversationId: string, lastMessages?: number) =>
    apiClient.post<{ suggestion: string; confidence: number }>('/api/ia/suggestion', { conversationId, lastMessages }),
  improveMessage: (conversationId: string, message: string) =>
    apiClient.post<{ improved: string }>('/api/ia/improve-message', { conversationId, message }),
  textToSpeech: (text: string, voice?: string, model?: string, provider?: string, elevenLabsVoiceId?: string) =>
    apiClient.post<{ audioBase64: string; contentType: string }>('/api/ia/text-to-speech', { text, voice, model, provider, elevenLabsVoiceId }),
  speechToText: (audioBlob: Blob, filename: string) => {
    const formData = new FormData()
    formData.append('audio', audioBlob, filename)
    return apiClient.upload<{ text: string }>('/api/ia/speech-to-text', formData)
  },
  cloneVoice: (audio: File, name: string) => {
    const formData = new FormData()
    formData.append('audio', audio)
    formData.append('name', name)
    return apiClient.upload<{ voiceId: string }>('/api/ia/clone-voice', formData)
  },
  listElevenLabsVoices: () =>
    apiClient.get<{ voices: Array<{ voiceId: string; name: string; category: string; previewUrl?: string }> }>('/api/ia/elevenlabs-voices'),
  generateBot: (prompt: string) =>
    apiClient.post<{ nodes: any[]; edges: any[] }>('/api/ia/generate-bot', { prompt }, { timeout: 180000 }),
}

export const visualBotsApi = {
  list: (search?: string, status?: string) => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    const qs = params.toString()
    return apiClient.get<any[]>(`/api/visual-bots${qs ? `?${qs}` : ''}`)
  },
  getById: (id: string) =>
    apiClient.get<any>(`/api/visual-bots/${id}`),
  create: (payload: { name: string; botId: string; description?: string }) =>
    apiClient.post<any>('/api/visual-bots', payload),
  update: (id: string, payload: any) =>
    apiClient.put<any>(`/api/visual-bots/${id}`, payload),
  delete: (id: string) =>
    apiClient.delete(`/api/visual-bots/${id}`),
  publish: (id: string) =>
    apiClient.post<any>(`/api/visual-bots/${id}/publish`),
  unpublish: (id: string) =>
    apiClient.post<any>(`/api/visual-bots/${id}/unpublish`),
  duplicate: (id: string) =>
    apiClient.post<any>(`/api/visual-bots/${id}/duplicate`),
  test: (id: string, message: string, sessionData?: Record<string, any>) =>
    apiClient.post<any>(`/api/visual-bots/${id}/test`, { message, sessionData }),
}

// ============================================
// PIPELINE / FUNIL DE VENDAS
// ============================================

export const pipelineStagesApi = {
  list: () =>
    apiClient.get<PipelineStage[]>('/api/pipeline-stages'),
  create: (payload: PipelineStagePayload) =>
    apiClient.post<PipelineStage>('/api/pipeline-stages', payload),
  update: (id: string, payload: Partial<PipelineStagePayload>) =>
    apiClient.put<PipelineStage>(`/api/pipeline-stages/${id}`, payload),
  reorder: (stages: { id: string; order: number }[]) =>
    apiClient.put('/api/pipeline-stages/reorder', { stages }),
  delete: (id: string) =>
    apiClient.delete(`/api/pipeline-stages/${id}`),
}

export const pipelineApi = {
  getBoard: () =>
    apiClient.get<PipelineBoardColumn[]>('/api/pipeline/board'),
  move: (conversationId: string, stageId: string | null) =>
    apiClient.put('/api/pipeline/move', { conversationId, stageId }),
  bulkMove: (conversationIds: string[], stageId: string | null) =>
    apiClient.put('/api/pipeline/bulk-move', { conversationIds, stageId }),
  getMetrics: () =>
    apiClient.get<PipelineMetrics>('/api/pipeline/metrics'),
}

// ============================================
// AGENDAMENTOS
// ============================================

export const appointmentsApi = {
  list: (params?: { date?: string; operatorId?: string; contactIdentifier?: string; status?: string; page?: number; limit?: number }) =>
    apiClient.get<Appointment[]>('/api/appointments', params as Record<string, unknown>),
  calendar: (start: string, end: string) =>
    apiClient.get<Appointment[]>('/api/appointments/calendar', { start, end }),
  slots: (date: string) =>
    apiClient.get<TimeSlot[]>(`/api/appointments/slots/${date}`),
  create: (payload: AppointmentPayload) =>
    apiClient.post<Appointment>('/api/appointments', payload),
  update: (id: string, payload: Partial<AppointmentPayload>) =>
    apiClient.put<Appointment>(`/api/appointments/${id}`, payload),
  updateStatus: (id: string, status: AppointmentStatus) =>
    apiClient.patch(`/api/appointments/${id}/status`, { status }),
  delete: (id: string) =>
    apiClient.delete(`/api/appointments/${id}`),
}

export const availabilityApi = {
  get: () =>
    apiClient.get<AvailabilitySettings>('/api/availability'),
  update: (data: Partial<AvailabilitySettings>) =>
    apiClient.put('/api/availability', data),
}

// ============================================
// SERVICOS
// ============================================

export const servicesApi = {
  list: () =>
    apiClient.get<Service[]>('/api/services'),
  create: (payload: ServicePayload) =>
    apiClient.post<Service>('/api/services', payload),
  update: (id: string, payload: Partial<ServicePayload>) =>
    apiClient.put<Service>(`/api/services/${id}`, payload),
  delete: (id: string) =>
    apiClient.delete(`/api/services/${id}`),
}

// ============================================
// PROFISSIONAIS
// ============================================

export const professionalsApi = {
  list: () =>
    apiClient.get<Professional[]>('/api/professionals'),
  listActive: () =>
    apiClient.get<Professional[]>('/api/professionals/active'),
  create: (payload: ProfessionalPayload) =>
    apiClient.post<Professional>('/api/professionals', payload),
  update: (id: string, payload: Partial<ProfessionalPayload>) =>
    apiClient.put<Professional>(`/api/professionals/${id}`, payload),
  delete: (id: string) =>
    apiClient.delete(`/api/professionals/${id}`),
}

// ============================================
// GOOGLE CALENDAR
// ============================================

export const googleCalendarApi = {
  getStatus: () =>
    apiClient.get<GoogleCalendarStatus>('/api/google-calendar/status'),
  getAuthUrl: () =>
    apiClient.get<{ url: string }>('/api/google-calendar/oauth/url'),
  sync: () =>
    apiClient.post<GoogleCalendarSyncResult>('/api/google-calendar/sync'),
  disconnect: () =>
    apiClient.post('/api/google-calendar/disconnect'),
  setupWatch: (webhookUrl: string) =>
    apiClient.post('/api/google-calendar/watch', { webhookUrl }),
}

// ============================================
// WHATSAPP FEATURES (WPPConnect Advanced)
// ============================================

export const whatsappFeaturesApi = {
  // --- Reactions ---
  sendReaction: (payload: ReactionPayload) =>
    apiClient.post('/api/whatsapp/features/reaction', payload),

  // --- Typing ---
  startTyping: (sessionName: string, chatId: string, duration?: number) =>
    apiClient.post('/api/whatsapp/features/typing/start', { sessionName, chatId, duration }),
  stopTyping: (sessionName: string, chatId: string) =>
    apiClient.post('/api/whatsapp/features/typing/stop', { sessionName, chatId }),

  // --- Messages ---
  deleteMessage: (sessionName: string, chatId: string, messageId: string, onlyLocal?: boolean) =>
    apiClient.post('/api/whatsapp/features/message/delete', { sessionName, chatId, messageId, onlyLocal }),
  editMessage: (sessionName: string, messageId: string, newText: string) =>
    apiClient.post('/api/whatsapp/features/message/edit', { sessionName, messageId, newText }),
  forwardMessage: (payload: ForwardPayload) =>
    apiClient.post('/api/whatsapp/features/message/forward', payload),

  // --- Read status ---
  sendSeen: (sessionName: string, chatId: string) =>
    apiClient.post('/api/whatsapp/features/seen', { sessionName, chatId }),
  markUnread: (sessionName: string, chatId: string) =>
    apiClient.post('/api/whatsapp/features/unread', { sessionName, chatId }),

  // --- Stickers ---
  sendSticker: (sessionName: string, to: string, imageBase64: string) =>
    apiClient.post('/api/whatsapp/features/sticker', { sessionName, to, imageBase64 }),
  sendStickerGif: (sessionName: string, to: string, imageBase64: string) =>
    apiClient.post('/api/whatsapp/features/sticker-gif', { sessionName, to, imageBase64 }),

  // --- Star ---
  starMessage: (sessionName: string, messageId: string, star?: boolean) =>
    apiClient.post('/api/whatsapp/features/star', { sessionName, messageId, star }),

  // --- Presence ---
  setOnlinePresence: (sessionName: string, online: boolean) =>
    apiClient.post('/api/whatsapp/features/presence/online', { sessionName, online }),
  subscribePresence: (sessionName: string, contactId: string) =>
    apiClient.post('/api/whatsapp/features/presence/subscribe', { sessionName, contactId }),
  unsubscribePresence: (sessionName: string, contactId: string) =>
    apiClient.post('/api/whatsapp/features/presence/unsubscribe', { sessionName, contactId }),

  // --- Status/Stories ---
  sendImageStatus: (sessionName: string, imageBase64: string, caption?: string) =>
    apiClient.post('/api/whatsapp/features/status/image', { sessionName, imageBase64, caption }),
  sendVideoStatus: (sessionName: string, videoBase64: string, caption?: string) =>
    apiClient.post('/api/whatsapp/features/status/video', { sessionName, videoBase64, caption }),
  sendTextStatus: (sessionName: string, text: string, backgroundColor?: string, font?: number) =>
    apiClient.post('/api/whatsapp/features/status/text', { sessionName, text, backgroundColor, font }),
  sendReadStatus: (sessionName: string, chatId: string, statusId: string) =>
    apiClient.post('/api/whatsapp/features/status/read', { sessionName, chatId, statusId }),

  // --- Contacts ---
  blockContact: (sessionName: string, contactId: string) =>
    apiClient.post('/api/whatsapp/features/contact/block', { sessionName, contactId }),
  unblockContact: (sessionName: string, contactId: string) =>
    apiClient.post('/api/whatsapp/features/contact/unblock', { sessionName, contactId }),
  getContact: (sessionName: string, contactId: string) =>
    apiClient.get('/api/whatsapp/features/contact/info', { sessionName, contactId }),
  checkNumberStatus: (sessionName: string, phoneNumber: string) =>
    apiClient.get('/api/whatsapp/features/contact/check', { sessionName, phoneNumber }),
  getLastSeen: (sessionName: string, contactId: string) =>
    apiClient.get('/api/whatsapp/features/contact/last-seen', { sessionName, contactId }),
  getChatIsOnline: (sessionName: string, contactId: string) =>
    apiClient.get('/api/whatsapp/features/contact/online', { sessionName, contactId }),

  // --- Chat management ---
  archiveChat: (sessionName: string, chatId: string, archive: boolean) =>
    apiClient.post('/api/whatsapp/features/chat/archive', { sessionName, chatId, archive }),
  pinChat: (sessionName: string, chatId: string, pin: boolean) =>
    apiClient.post('/api/whatsapp/features/chat/pin', { sessionName, chatId, pin }),
  deleteChat: (sessionName: string, chatId: string) =>
    apiClient.delete(`/api/whatsapp/features/chat/${chatId}`, { sessionName }),
  clearChat: (sessionName: string, chatId: string, keepStarred?: boolean) =>
    apiClient.post('/api/whatsapp/features/chat/clear', { sessionName, chatId, keepStarred }),
  setDisappearing: (sessionName: string, chatId: string, enabled: boolean) =>
    apiClient.post('/api/whatsapp/features/chat/disappearing', { sessionName, chatId, enabled }),
  muteContact: (sessionName: string, contactId: string, time: number, type: string) =>
    apiClient.post('/api/whatsapp/features/contact/mute', { sessionName, contactId, time, type }),

  // --- Profile ---
  setProfileName: (sessionName: string, name: string) =>
    apiClient.post('/api/whatsapp/features/profile/name', { sessionName, name }),
  setProfilePic: (sessionName: string, imageBase64: string) =>
    apiClient.post('/api/whatsapp/features/profile/pic', { sessionName, imageBase64 }),
  setProfileStatus: (sessionName: string, status: string) =>
    apiClient.post('/api/whatsapp/features/profile/status', { sessionName, status }),
  removeProfilePic: (sessionName: string) =>
    apiClient.post('/api/whatsapp/features/profile/pic/remove', { sessionName }),

  // --- Device info ---
  getDeviceInfo: (sessionName: string) =>
    apiClient.get('/api/whatsapp/features/device/info', { sessionName }),

  // --- Broadcast ---
  sendBroadcast: (payload: BroadcastPayload) =>
    apiClient.post('/api/whatsapp/features/broadcast', payload),
}

export { apiClient }
