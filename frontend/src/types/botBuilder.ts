// ============================================
// Tipos de Nós Visuais
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
    operator: string
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
// Nó e Edge Visuais
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
// Definição completa do Bot Visual
// ============================================

export interface VisualBotDefinition {
  _id?: string
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
  createdAt?: string
  updatedAt?: string
  publishedAt?: string
  viewport?: {
    x: number
    y: number
    zoom: number
  }
}

// ============================================
// Payloads de API
// ============================================

export interface CreateVisualBotPayload {
  name: string
  botId: string
  description?: string
}

export interface UpdateVisualBotPayload {
  name?: string
  description?: string
  nodes?: VisualNode[]
  edges?: VisualEdge[]
  viewport?: { x: number; y: number; zoom: number }
  sessionTimeout?: number
  enableAnalytics?: boolean
}

export interface TestBotPayload {
  message: string
  sessionData?: Record<string, any>
}

export interface TestBotResponse {
  responses: Array<{
    message?: string
    buttons?: any
    list?: any
    media?: any
  }>
  sessionData: Record<string, any>
  endSession: boolean
}

// ============================================
// Metadata dos tipos de nó (para paleta)
// ============================================

export interface NodeTypeInfo {
  type: VisualNodeType
  label: string
  description: string
  color: string
  bgColor: string
  borderColor: string
  icon: string
  defaultData: NodeData
}

export const NODE_TYPES: NodeTypeInfo[] = [
  {
    type: 'start',
    label: 'Início',
    description: 'Ponto de entrada do bot',
    color: '#16a34a',
    bgColor: '#f0fdf4',
    borderColor: '#86efac',
    icon: 'play',
    defaultData: {} as StartNodeData,
  },
  {
    type: 'send_message',
    label: 'Enviar Mensagem',
    description: 'Envia uma mensagem de texto ou mídia',
    color: '#2563eb',
    bgColor: '#eff6ff',
    borderColor: '#93c5fd',
    icon: 'message-square',
    defaultData: { messageType: 'text', message: '' } as SendMessageNodeData,
  },
  {
    type: 'ask_question',
    label: 'Fazer Pergunta',
    description: 'Faz uma pergunta e armazena a resposta',
    color: '#d97706',
    bgColor: '#fffbeb',
    borderColor: '#fcd34d',
    icon: 'help-circle',
    defaultData: {
      question: '',
      variableName: '',
      validation: { type: 'none' },
    } as AskQuestionNodeData,
  },
  {
    type: 'buttons',
    label: 'Botões',
    description: 'Mostra botões interativos',
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    borderColor: '#c4b5fd',
    icon: 'mouse-pointer-click',
    defaultData: {
      title: '',
      description: '',
      buttons: [{ id: 'btn_1', text: 'Opção 1' }],
    } as ButtonsNodeData,
  },
  {
    type: 'list',
    label: 'Lista',
    description: 'Mostra uma lista interativa',
    color: '#0891b2',
    bgColor: '#ecfeff',
    borderColor: '#67e8f9',
    icon: 'list',
    defaultData: {
      title: '',
      description: '',
      buttonText: 'Ver opções',
      sections: [
        {
          title: 'Opções',
          rows: [{ rowId: 'row_1', title: 'Opção 1' }],
        },
      ],
    } as ListNodeData,
  },
  {
    type: 'condition',
    label: 'Condição',
    description: 'Ramifica o fluxo com base em condições',
    color: '#9333ea',
    bgColor: '#faf5ff',
    borderColor: '#d8b4fe',
    icon: 'git-branch',
    defaultData: {
      conditions: [
        {
          id: 'cond_1',
          label: 'Condição 1',
          operator: 'equals',
          variable: '',
          value: '',
        },
      ],
    } as ConditionNodeData,
  },
  {
    type: 'set_variable',
    label: 'Definir Variável',
    description: 'Define ou atualiza variáveis de sessão',
    color: '#475569',
    bgColor: '#f8fafc',
    borderColor: '#cbd5e1',
    icon: 'variable',
    defaultData: {
      assignments: [{ variable: '', value: '' }],
    } as SetVariableNodeData,
  },
  {
    type: 'http_request',
    label: 'Requisição HTTP',
    description: 'Faz uma chamada HTTP externa',
    color: '#ea580c',
    bgColor: '#fff7ed',
    borderColor: '#fdba74',
    icon: 'globe',
    defaultData: {
      method: 'GET',
      url: '',
      timeout: 10000,
    } as HttpRequestNodeData,
  },
  {
    type: 'delay',
    label: 'Esperar',
    description: 'Aguarda um tempo antes de continuar',
    color: '#64748b',
    bgColor: '#f1f5f9',
    borderColor: '#94a3b8',
    icon: 'clock',
    defaultData: { delayMs: 2000 } as DelayNodeData,
  },
  {
    type: 'ai_response',
    label: 'Resposta IA',
    description: 'Gera uma resposta usando IA',
    color: '#4f46e5',
    bgColor: '#eef2ff',
    borderColor: '#a5b4fc',
    icon: 'sparkles',
    defaultData: {
      systemPrompt: '',
      temperature: 0.7,
      maxTokens: 300,
      includeSessionContext: true,
    } as AiResponseNodeData,
  },
  {
    type: 'end',
    label: 'Fim',
    description: 'Finaliza a conversa do bot',
    color: '#dc2626',
    bgColor: '#fef2f2',
    borderColor: '#fca5a5',
    icon: 'square',
    defaultData: {} as EndNodeData,
  },
]
