import { ObjectId } from 'mongodb'

// ============================================
// Tipos de Nos Visuais
// ============================================

export type VisualNodeType =
  | 'start'
  | 'send_message'
  | 'ask_question'
  | 'buttons'
  | 'list'
  | 'condition'
  | 'set_variable'
  | 'http_request'
  | 'delay'
  | 'ai_response'
  | 'end'

// ============================================
// NodeData por tipo
// ============================================

export interface StartNodeData {
  welcomeMessage?: string
}

export interface SendMessageNodeData {
  messageType: 'text' | 'image' | 'document' | 'audio' | 'video'
  message?: string
  media?: {
    type: 'image' | 'document' | 'audio' | 'video'
    url?: string
    caption?: string
    filename?: string
  }
}

export interface AskQuestionNodeData {
  question: string
  variableName: string
  validation?: {
    type: 'none' | 'options' | 'regex' | 'length' | 'number' | 'email' | 'phone'
    value?: any
    errorMessage?: string
  }
}

export interface ButtonsNodeData {
  title: string
  description: string
  buttons: Array<{
    id: string
    text: string
  }>
  footer?: string
  variableName?: string
}

export interface ListNodeData {
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
  variableName?: string
}

export interface ConditionNodeData {
  conditions: Array<{
    id: string
    label: string
    operator:
      | 'equals'
      | 'not_equals'
      | 'contains'
      | 'not_contains'
      | 'starts_with'
      | 'ends_with'
      | 'regex'
      | 'greater_than'
      | 'less_than'
      | 'is_empty'
      | 'is_not_empty'
    variable: string
    value: string
  }>
}

export interface SetVariableNodeData {
  assignments: Array<{
    variable: string
    value: string
  }>
}

export interface HttpRequestNodeData {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  url: string
  headers?: Record<string, string>
  body?: string
  responseVariable?: string
  timeout?: number
}

export interface DelayNodeData {
  delayMs: number
}

export interface AiResponseNodeData {
  systemPrompt: string
  temperature?: number
  maxTokens?: number
  responseVariable?: string
  includeSessionContext?: boolean
  routeToDepartment?: boolean
}

export interface EndNodeData {
  finalMessage?: string
  transferToHuman?: boolean
  transferDepartmentId?: string
}

export type NodeData =
  | StartNodeData
  | SendMessageNodeData
  | AskQuestionNodeData
  | ButtonsNodeData
  | ListNodeData
  | ConditionNodeData
  | SetVariableNodeData
  | HttpRequestNodeData
  | DelayNodeData
  | AiResponseNodeData
  | EndNodeData

// ============================================
// No e Edge Visuais
// ============================================

export interface VisualNode {
  id: string
  type: VisualNodeType
  position: { x: number; y: number }
  data: NodeData
  label?: string
}

export interface VisualEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  label?: string
  animated?: boolean
}

// ============================================
// Definicao completa do Bot Visual
// ============================================

export interface VisualBotDefinition {
  _id?: ObjectId
  botId: string
  name: string
  description?: string
  status: 'draft' | 'published' | 'archived'
  nodes: VisualNode[]
  edges: VisualEdge[]
  initialNodeId: string
  sessionTimeout: number
  enableAnalytics: boolean
  createdBy?: string
  updatedBy?: string
  createdAt: Date
  updatedAt: Date
  publishedAt?: Date
  viewport?: {
    x: number
    y: number
    zoom: number
  }
}
