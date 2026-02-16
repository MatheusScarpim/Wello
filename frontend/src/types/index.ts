// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  timestamp: string
}

export interface ApiError {
  success: false
  error: string
  details?: Record<string, unknown>
  timestamp: string
}

export interface PaginatedResponse<T> {
  items: T[]
  pagination: Pagination
}

export interface Pagination {
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Health & Status
export interface HealthResponse {
  status: string
  timestamp: string
  uptime: number
  memory: Record<string, unknown>
}

export interface StatusResponse {
  status: string
  version: string
  service: string
}

export interface WhatsAppStatus {
  connected: boolean
  status: string
}

// Auth
export interface AuthToken {
  token: string
  userId: string
  email: string
  role: string
  expiresIn: string
  description?: string
  createdAt: string
  usage: string
}

export interface TokenPayload {
  userId: string
  email: string
  role: string
}

export interface AuthLoginResponse {
  token: string
  userId: string
  email: string
  role: string
  expiresIn: string
  createdAt: string
  usage: string
  operator?: Operator
}

// Conversation
export interface Conversation {
  _id: string
  identifier: string
  provider: string
  name: string
  photo?: string
  protocolNumber?: string
  status: 'active' | 'inactive' | 'waiting' | 'finalized'
  archived: boolean | string
  operatorId?: string
  operatorName?: string
  lastMessage?: Message
  tags?: string[] | string
  createdAt?: string
  updatedAt?: string
  // Finalization fields
  finalizationAt?: string
  finalizationId?: string
  finalizationName?: string
  finalizationType?: 'gain' | 'loss'
  finalizationNotes?: string
  finalizations?: FinalizationSummary[]
  resolvedAt?: string
  // WhatsApp instance fields
  instanceId?: string
  sessionName?: string
  instanceName?: string
}

export interface CreateConversationPayload {
  identifier: string
  provider: string
  name?: string
  photo?: string
  instanceId?: string
  sessionName?: string
  instanceName?: string
  contactId?: string
  suppressWelcomeMessage?: boolean
}

export interface Contact {
  _id: string
  identifier: string
  provider: string
  name?: string
  photo?: string
  contactId?: string
  lastMessage?: string
  lastMessageAt?: string
  createdAt?: string
  updatedAt?: string
  // Campos para personalizacao do contato
  tags?: string[]
  customName?: string
}

export interface UpdateContactPayload {
  customName?: string
  tags?: string[]
}

export interface CreateContactPayload {
  identifier: string
  provider: string
  name?: string
  customName?: string
  tags?: string[]
}

export interface ContactConversationCheck {
  exists: boolean
  conversationId: string | null
  status: string | null
  operatorId: string | null
  operatorName: string | null
  archived: boolean | null
}

// Message
export interface Message {
  _id: string
  conversationId?: string
  identifier?: string
  provider?: string
  message: string
  type: MessageType
  direction: 'incoming' | 'outgoing'
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  mediaUrl?: string
  filename?: string
  metadata?: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
  operatorId?: string
  operatorName?: string
  quotedMessageId?: string
  quotedMsg?: QuotedMessage
  isNote?: boolean
}

// Mensagem citada (reply)
export interface QuotedMessage {
  _id: string
  message: string
  type: MessageType
  direction: 'incoming' | 'outgoing'
  mediaUrl?: string
}

export type MessageType = 'text' | 'image' | 'document' | 'audio' | 'video' | 'list' | 'buttons' | 'location' | 'contact' | 'ptt' | 'system' | 'sticker' | 'chat' | 'note'

export interface SendMessagePayload {
  to: string
  provider: string
  type: MessageType
  message?: string
  mediaUrl?: string
  mediaBase64?: string
  filename?: string
  caption?: string
  // Reply (citação)
  quotedMessageId?: string
  // List message
  listTitle?: string
  listDescription?: string
  listButtonText?: string
  listSections?: ListSection[]
  // Buttons message
  buttonsTitle?: string
  buttonsDescription?: string
  buttonsFooter?: string
  buttons?: MessageButton[]
  // Location message
  latitude?: number
  longitude?: number
  locationTitle?: string
  locationAddress?: string
  // Contact message
  contactId?: string
  operatorName?: string
}

export interface ListSection {
  title: string
  rows: ListRow[]
}

export interface ListRow {
  rowId: string
  title: string
  description?: string
}

export interface MessageButton {
  id: string
  text: string
}

// Bot
export interface BotListResponse {
  registered: string[]
  active: string[]
  total: number
  totalActive: number
}

export interface BotSession {
  conversationId: string
  botId: string
  stage: number
}

export interface BotExport {
  filename: string
  filepath?: string
  bot?: Record<string, unknown>
}

// Webhook
export interface Webhook {
  _id: string
  name: string
  url: string
  events: string[]
  enabled: boolean
  secret?: string
  headers?: Record<string, string>
  retryAttempts?: number
  retryDelay?: number
  createdAt?: string
  updatedAt?: string
}

export interface WebhookPayload {
  name: string
  url: string
  events: string[]
  enabled?: boolean
  secret?: string
  headers?: Record<string, string>
  retryAttempts?: number
  retryDelay?: number
}

export interface WebhookStats {
  totalSent: number
  totalFailed: number
}

// Storage
export interface StorageConfig {
  _id: string
  accountName: string
  accountKey?: string
  containerName: string
  connectionString?: string
  endpoint?: string
  isActive: boolean
}

export interface StorageConfigPayload {
  accountName: string
  accountKey: string
  containerName: string
  connectionString?: string
  endpoint?: string
  isActive?: boolean
}

export interface UploadResult {
  url: string
  blobName: string
  container: string
  size: number
}

export interface StorageStatus {
  configured: boolean
  provider: string
  containerName: string
}

// Expense
export interface Expense {
  _id: string
  obra: string
  cliente: string
  documentoVinculado?: string
  dataVencimento?: string
  descricao: string
  tipoDespesa: string
  centroCusto?: string
  valor: number
  semNotaEmitida?: boolean
  dependeFechamentoLoja?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ExpensePayload {
  obra: string
  cliente: string
  documentoVinculado?: string
  dataVencimento?: string
  descricao: string
  tipoDespesa: string
  centroCusto?: string
  valor: number
  semNotaEmitida?: boolean
  dependeFechamentoLoja?: boolean
}

export interface WeeklySheet {
  periodo: {
    inicio: string
    fim: string
  }
  totalItens: number
  totalValor: number
  itens: Expense[]
}

// Filter types
export interface ConversationFilters {
  status?: string
  search?: string
  page?: number
  limit?: number
  archived?: boolean
  instanceName?: string
}

export interface MessageFilters {
  conversationId?: string
  identifier?: string
  provider?: string
  page?: number
  limit?: number
}

export interface ExpenseFilters {
  cliente?: string
  search?: string
  page?: number
  limit?: number
}

export interface WebhookFilters {
  enabled?: boolean
  event?: string
  search?: string
  page?: number
  limit?: number
}

// ============================================
// OMNICHANNEL TYPES
// ============================================

// Department
export interface Department {
  _id: string
  name: string
  description?: string
  color: string
  icon?: string
  isActive: boolean
  settings: DepartmentSettings
  operators: string[] // operator IDs
  createdAt?: string
  updatedAt?: string
}

export interface DepartmentSettings {
  maxConcurrentChats: number
  autoAssign: boolean
  welcomeMessage?: string
  offlineMessage?: string
  businessHours: BusinessHours
  priority: number
}

export interface BusinessHours {
  enabled: boolean
  timezone: string
  schedule: WeekSchedule
}

export interface WeekSchedule {
  monday: DaySchedule
  tuesday: DaySchedule
  wednesday: DaySchedule
  thursday: DaySchedule
  friday: DaySchedule
  saturday: DaySchedule
  sunday: DaySchedule
}

export interface DaySchedule {
  enabled: boolean
  start: string // HH:mm
  end: string   // HH:mm
}

export interface DepartmentPayload {
  name: string
  description?: string
  color: string
  icon?: string
  isActive?: boolean
  settings?: Partial<DepartmentSettings>
}

// Operator
export interface Operator {
  _id: string
  name: string
  email: string
  avatar?: string
  role: OperatorRole
  status: OperatorStatus
  departmentIds: string[]
  departments?: Department[]
  settings: OperatorSettings
  metrics: OperatorMetrics
  lastActivity?: string
  createdAt?: string
  updatedAt?: string
}

export type OperatorRole = 'admin' | 'supervisor' | 'operator'
export type OperatorStatus = 'online' | 'away' | 'busy' | 'offline'

export interface OperatorSettings {
  maxConcurrentChats: number
  receiveNotifications: boolean
  soundEnabled: boolean
  autoAcceptChats: boolean
}

export interface OperatorMetrics {
  totalChats: number
  activeChats: number
  avgResponseTime: number // seconds
  avgResolutionTime: number // seconds
  satisfaction: number // 0-5
  todayChats: number
}

export interface OperatorPayload {
  name: string
  email: string
  password?: string
  avatar?: string
  role?: OperatorRole
  status?: OperatorStatus
  departmentIds?: string[]
  settings?: Partial<OperatorSettings>
}

// Queue / Attendance
export interface QueueItem {
  _id: string
  conversation: Conversation
  departmentId?: string
  department?: Department
  operatorId?: string
  operator?: Operator
  status: QueueStatus
  priority: number
  offerOperatorId?: string
  offerOperatorName?: string
  offerExpiresAt?: string
  offerRemainingSeconds?: number
  waitTime: number // seconds
  tags: string[]
  notes?: string
  createdAt: string
  assignedAt?: string
  resolvedAt?: string
  finalization?: FinalizationSummary | null
  finalizations?: FinalizationSummary[]
  _receivedAt?: number
}

export type QueueStatus = 'waiting' | 'assigned' | 'in_progress' | 'resolved' | 'transferred'

export interface QueueFilters {
  status?: QueueStatus
  departmentId?: string
  operatorId?: string
  page?: number
  limit?: number
}

export interface TransferPayload {
  conversationId: string
  targetType: 'department' | 'operator'
  targetId: string
  notes?: string
}

export interface FinalizationSummary {
  _id: string
  name: string
  type: 'gain' | 'loss'
  notes?: string
  finalizedAt?: string
}

export interface Finalization {
  _id: string
  name: string
  type: 'gain' | 'loss'
  createdAt?: string
  updatedAt?: string
}

export interface FinalizationPayload {
  name: string
  type: 'gain' | 'loss'
}

// Whitelabel Settings
export interface WhitelabelSettings {
  _id: string
  companyName: string
  logo?: string
  logoSmall?: string
  favicon?: string
  loginBackground?: string
  protocolIdentifier?: string
  theme: ThemeSettings
  customCss?: string
  metadata: CompanyMetadata
  features: FeatureFlags
  automaticMessages?: AutomaticMessages
  createdAt?: string
  updatedAt?: string
}

export interface ThemeSettings {
  primaryColor: string
  primaryColorDark: string
  primaryColorLight: string
  accentColor: string
  sidebarBg: string
  sidebarText: string
  headerBg: string
  headerText: string
  fontFamily: string
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full'
}

export interface CompanyMetadata {
  address?: string
  phone?: string
  email?: string
  website?: string
  supportEmail?: string
  socialLinks?: {
    facebook?: string
    instagram?: string
    twitter?: string
    linkedin?: string
  }
}

export interface FeatureFlags {
  enableBots: boolean
  enableWebhooks: boolean
  enableExpenses: boolean
  enableStorage: boolean
  enableReports: boolean
  enableCannedResponses: boolean
  enableTags: boolean
  enableNotes: boolean
  maxDepartments: number
  maxOperators: number
  showOperatorNameInMessages: boolean
  defaultTtsVoice: string
  ttsModel: string
  ttsProvider: string
  elevenLabsVoiceId: string
}

export interface AutomaticMessageConfig {
  enabled: boolean
  message: string
}

export interface AutomaticMessages {
  welcome: AutomaticMessageConfig
  assign: AutomaticMessageConfig
  finalization: AutomaticMessageConfig
}

export interface WhitelabelPayload {
  companyName?: string
  logo?: string
  logoSmall?: string
  favicon?: string
  loginBackground?: string
  theme?: Partial<ThemeSettings>
  customCss?: string
  metadata?: Partial<CompanyMetadata>
  features?: Partial<FeatureFlags>
  automaticMessages?: Partial<AutomaticMessages>
}

// Canned Responses (Quick Replies)
export interface CannedResponse {
  _id: string
  shortcut: string
  title: string
  content: string
  departmentId?: string
  operatorId?: string
  isGlobal: boolean
  usageCount: number
  createdAt?: string
  updatedAt?: string
}

export interface CannedResponsePayload {
  shortcut: string
  title: string
  content: string
  departmentId?: string
  isGlobal?: boolean
}

// Tags
export interface Tag {
  _id: string
  name: string
  color: string
  description?: string
  createdAt?: string
}

export interface TagPayload {
  name: string
  color: string
  description?: string
}

// Dashboard Metrics
export interface DashboardMetrics {
  overview: {
    totalConversations: number
    activeConversations: number
    waitingConversations: number
    resolvedToday: number
  }
  operators: {
    total: number
    online: number
    busy: number
    offline: number
  }
  performance: {
    avgWaitTime: number
    avgResponseTime: number
    avgResolutionTime: number
    satisfaction: number
  }
  charts: {
    conversationsByHour: { hour: number; count: number }[]
    conversationsByDepartment: { department: string; count: number }[]
    conversationsByStatus: { status: string; count: number }[]
  }
}

// ============================================
// WHATSAPP MULTI-INSTANCE TYPES
// ============================================

export type WhatsAppInstanceStatus = 'disconnected' | 'connecting' | 'qrcode' | 'connected' | 'error'
export type WhatsAppConnectionType = 'wppconnect' | 'meta_official'

export interface MetaInstanceConfig {
  enabled: boolean
  accessToken?: string
  phoneNumberId?: string
  instagramAccountId?: string
  apiVersion?: string
  baseUrl?: string
}

export interface WhatsAppInstance {
  id: string
  name: string
  sessionName: string
  connectionType?: WhatsAppConnectionType
  status: WhatsAppInstanceStatus
  connected: boolean
  authenticated: boolean
  qrCode: string | null
  phoneNumber?: string
  profileName?: string
  isDefault: boolean
  departmentIds?: string[]
  botEnabled?: boolean
  botId?: string | null
  automaticMessages?: AutomaticMessages
  fairDistributionEnabled?: boolean
  metaConfig?: MetaInstanceConfig
}

export interface WhatsAppInstancePayload {
  name: string
  connectionType?: WhatsAppConnectionType
  metaConfig?: MetaInstanceConfig
  isDefault?: boolean
  autoConnect?: boolean
  webhookUrl?: string
  departmentIds?: string[]
  botEnabled?: boolean
  botId?: string | null
  automaticMessages?: AutomaticMessages
  fairDistributionEnabled?: boolean
}

export interface WhatsAppInstancesStatus {
  total: number
  connected: number
  disconnected: number
  instances: WhatsAppInstance[]
}

// ============================================
// FINALIZATION METRICS TYPES
// ============================================

export type MetricsPeriod = 'today' | 'week' | 'month' | 'custom'

export interface OperatorFinalizationSummary {
  operatorId: string
  operatorName: string
  total: number
  gains: number
  losses: number
}

export interface FinalizationTypeSummary {
  finalizationId: string
  finalizationName: string
  finalizationType: 'gain' | 'loss'
  count: number
}

export interface FinalizationDetail {
  conversationId: string
  identifier: string
  name?: string
  operatorId?: string
  operatorName?: string
  finalizationId?: string
  finalizationName?: string
  finalizationType?: 'gain' | 'loss'
  finalizationNotes?: string
  finalizationAt?: string
  finalizations?: Array<{
    finalizationId?: string
    finalizationName?: string
    finalizationType?: 'gain' | 'loss'
  }>
}

export interface FinalizationDayMetric {
  date: string
  gains: number
  losses: number
  total: number
}

export interface FinalizationCharts {
  byDay: FinalizationDayMetric[]
  byOperator: Array<{ name: string; total: number; gains: number; losses: number }>
  byType: Array<{ name: string; type: 'gain' | 'loss'; count: number }>
}

export interface FinalizationMetrics {
  total: number
  gains: number
  losses: number
  byOperator: OperatorFinalizationSummary[]
  byFinalizationType: FinalizationTypeSummary[]
  recentFinalizations: FinalizationDetail[]
  charts: FinalizationCharts
}

// ============================================
// MESSAGE METRICS TYPES
// ============================================

export interface MessageDayMetric {
  date: string
  sent: number
  received: number
  total: number
}

export interface MessageOperatorMetric {
  operatorId: string
  operatorName: string
  sent: number
  received: number
  total: number
}

export interface MessageHourMetric {
  hour: number
  count: number
}

export interface MessageMetrics {
  overview: {
    totalMessages: number
    totalSent: number
    totalReceived: number
    avgResponseTimeMs: number
  }
  byDay: MessageDayMetric[]
  byOperator: MessageOperatorMetric[]
  byHour: MessageHourMetric[]
}
