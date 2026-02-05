import axios from 'axios'
import { randomUUID } from 'crypto'

import { BaseBot } from '@/core/bot/BaseBot'
import type {
  IBotStage,
  MessageContext,
  StageResponse,
} from '@/core/bot/interfaces/IBotStage'
import MessagingService from '@/core/messaging/MessagingService'

type AuraWebhookPayload = {
  userMessage: string
  company: string
  branch: string
  userId: string
  chatId: string
  type: 'ask'
  language: AuraLanguage
}

type AuraWebhookResponse = {
  summary?: string
  message?: string
  sql?: string
  elapsedMs?: number
  chart?: AuraChart
}

type AuraLanguage = 'pt' | 'en' | 'es'
type AuraDataSource = 'field' | 'industry' | 'quality'

type AuraChart = {
  type?: 'bar' | 'doughnut' | 'line' | 'area'
  data?: Record<string, unknown>[]
  xKey?: string
  yKey?: string
  title?: string
  imageUrl?: string
  imageBase64?: string
}

const CHART_URL = 'https://quickchart.io/chart'
const CHART_CREATE_URL = 'https://quickchart.io/chart/create'
const CHART_COLORS = [
  '#2563eb',
  '#16a34a',
  '#f97316',
  '#e11d48',
  '#14b8a6',
  '#64748b',
]
const DEFAULT_AURA_TIMEOUT_MS = 300000

const LANGUAGE_OPTIONS: Array<{
  code: AuraLanguage
  label: string
  keywords: string[]
}> = [
  {
    code: 'pt',
    label: 'Português',
    keywords: ['1', 'pt', 'pt-br', 'portugues', 'portuguese', 'br', 'brazil'],
  },
  {
    code: 'en',
    label: 'Inglês',
    keywords: ['2', 'en', 'eng', 'english', 'ingles'],
  },
  {
    code: 'es',
    label: 'Espanhol',
    keywords: ['3', 'es', 'esp', 'spanish', 'espanhol', 'espanol'],
  },
]

const PROMPTS = {
  choose:
    'Escolha o idioma / Choose the language / Elige el idioma:\n1) Português 🇧🇷\n2) English 🇺🇸\n3) Español 🇪🇸',
  invalid: 'Opção inválida. Responda com 1, 2 ou 3. 🙏',
  selected: {
    pt: 'Idioma definido: Portugues.',
    en: 'Language set: English.',
    es: 'Idioma definido: Espanol.',
  },
  askQuestion: {
    pt: 'Fonte de dados definida. Envie sua pergunta.',
    en: 'Data source set. Send your question.',
    es: 'Fuente de datos definida. Envie su pregunta.',
  },
  reset: {
    pt: 'Nova conversa iniciada. Envie sua pergunta. 🔄',
    en: 'New session started. Send your question. 🔄',
    es: 'Nueva conversación iniciada. Envíe su pregunta. 🔄',
  },
  generating: {
    pt: 'Gerando resposta... ⏳',
    en: 'Generating response... ⏳',
    es: 'Generando respuesta... ⏳',
  },
  emptyQuestion: {
    pt: 'Envie sua pergunta para eu consultar. 😊',
    en: 'Send your question so I can check it. 😊',
    es: 'Envíe su pregunta para que yo la revise. 😊',
  },
  dataSourceInvalid: {
    pt: 'Opção inválida. Responda com 1, 2 ou 3.',
    en: 'Invalid option. Reply with 1, 2, or 3.',
    es: 'Opción inválida. Responda con 1, 2 o 3.',
  },
  webhookMissing:
    'Webhook do Aura não configurado. Ajuste AURA_WEBHOOK_URL. ⚠️',
  requestFailed: 'Falha ao consultar o Aura. ⚠️ Detalhe: ',
  fallbackAnswer: 'Não consegui gerar uma resposta agora. 😕',
}

function normalizeInput(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function resolveLanguage(input: string): AuraLanguage | null {
  const normalized = normalizeInput(input)
  if (!normalized) return null
  for (const option of LANGUAGE_OPTIONS) {
    if (option.keywords.some((keyword) => normalized.includes(keyword))) {
      return option.code
    }
  }
  return null
}

const DATA_SOURCE_SUFFIX: Record<AuraDataSource, string> = {
  field: 'avecom',
  industry: 'edata',
  quality: 'mypac',
}

const DATA_SOURCE_LABELS: Record<
  AuraLanguage,
  Record<AuraDataSource, string>
> = {
  pt: { field: 'Campo', industry: 'Ind\u00fastria', quality: 'Qualidade' },
  en: { field: 'LiveOps', industry: 'Processing', quality: 'Quality' },
  es: { field: 'Campo', industry: 'Industria', quality: 'Calidad' },
}

const DATA_SOURCE_KEYWORDS: Record<AuraDataSource, string[]> = {
  field: ['1', 'field', 'campo', 'liveops', 'live ops', 'avecom'],
  industry: ['2', 'industry', 'industria', 'processing', 'edata'],
  quality: ['3', 'quality', 'qualidade', 'calidad', 'mypac'],
}

function buildDataSourcePrompt(language: AuraLanguage): string {
  const labels = DATA_SOURCE_LABELS[language]
  if (language === 'en') {
    return `Choose the data source:
1) ${labels.field}
2) ${labels.industry}
3) ${labels.quality}`
  }
  if (language === 'es') {
    return `Elige la fuente de datos:
1) ${labels.field}
2) ${labels.industry}
3) ${labels.quality}`
  }
  return `Escolha a fonte de dados:
1) ${labels.field}
2) ${labels.industry}
3) ${labels.quality}`
}

function resolveDataSource(input: string): AuraDataSource | null {
  const normalized = normalizeInput(input)
  if (!normalized) return null
  for (const [key, keywords] of Object.entries(DATA_SOURCE_KEYWORDS)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return key as AuraDataSource
    }
  }
  return null
}

function formatAssistantMessage(text: string, emoji: string): string {
  const trimmed = text.trim()
  return `${trimmed} ${emoji}`
}

const RESET_COMMANDS: AuraLanguage[] = ['pt', 'en', 'es']
const RESET_KEYWORDS: Record<AuraLanguage, string[]> = {
  pt: ['novo', 'reiniciar'],
  en: ['new', 'restart'],
  es: ['nuevo', 'reiniciar'],
}

function isResetCommand(input: string): boolean {
  const normalized = normalizeInput(input).replace(/^[/#]/, '')
  return RESET_COMMANDS.some((lang) =>
    RESET_KEYWORDS[lang].includes(normalized),
  )
}

function isLanguageChangeCommand(input: string): boolean {
  const normalized = normalizeInput(input).replace(/^[/#]/, '')
  return normalized === 'language'
}

function buildChatId(): string {
  return `aura_${randomUUID()}`
}

function resolveChartKeys(chart: AuraChart): { xKey?: string; yKey?: string } {
  if (!chart.data || chart.data.length === 0) return {}
  const first = chart.data[0]
  if (!first) return {}
  const keys = Object.keys(first)
  return {
    xKey: chart.xKey ?? keys[0],
    yKey: chart.yKey ?? keys[1],
  }
}

function normalizeChartType(type?: AuraChart['type']) {
  if (type === 'area') return 'line'
  return type ?? 'bar'
}

async function buildChartMedia(
  chart: AuraChart,
): Promise<{ url?: string; base64?: string } | null> {
  if (chart.imageUrl) {
    return { url: chart.imageUrl }
  }

  if (chart.imageBase64) {
    const base64 = chart.imageBase64.startsWith('data:')
      ? chart.imageBase64
      : `data:image/png;base64,${chart.imageBase64}`
    return { base64 }
  }

  if (!chart.data || chart.data.length === 0) return null

  const keys = resolveChartKeys(chart)
  const xKey = keys.xKey
  const yKey = keys.yKey
  if (!xKey || !yKey) return null

  const labels = chart.data.map((row) => String(row[xKey] ?? ''))
  const values = chart.data.map((row) => Number(row[yKey] ?? 0))
  const type = normalizeChartType(chart.type)

  const config = {
    type,
    data: {
      labels,
      datasets: [
        {
          label: yKey,
          data: values,
          backgroundColor:
            type === 'doughnut'
              ? values.map((_, i) => CHART_COLORS[i % CHART_COLORS.length])
              : CHART_COLORS[0],
          borderColor:
            type === 'doughnut'
              ? values.map((_, i) => CHART_COLORS[i % CHART_COLORS.length])
              : CHART_COLORS[0],
          borderWidth: 2,
          fill: chart.type === 'area',
          tension: 0.3,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: type === 'doughnut' },
        title: { display: Boolean(chart.title), text: chart.title },
      },
      scales:
        type === 'doughnut'
          ? {}
          : {
              y: { beginAtZero: true },
            },
    },
  }

  try {
    const response = await axios.post(
      CHART_CREATE_URL,
      { chart: config, width: 800, height: 500, format: 'png' },
      { timeout: 15000 },
    )
    const url = response.data?.url
    if (url) {
      return { url }
    }
  } catch {
    // Ignore and fallback to base64.
  }

  try {
    const response = await axios.post(
      CHART_URL,
      { chart: config, width: 800, height: 500, format: 'png' },
      { responseType: 'arraybuffer' },
    )
    const base64 = Buffer.from(response.data, 'binary').toString('base64')
    return { base64: `data:image/png;base64,${base64}` }
  } catch {
    return null
  }
}

class AuraMainStage implements IBotStage {
  stageNumber = 0
  description = 'Forward messages to Aura webhook'

  async execute(context: MessageContext): Promise<StageResponse> {
    const webhookUrl = (process.env.AURA_WEBHOOK_URL || '').trim()
    if (!webhookUrl) {
      return {
        message: PROMPTS.webhookMissing,
      }
    }

    const sessionData = context.sessionData || {}
    const currentLanguage = sessionData.language as AuraLanguage | undefined
    const currentDataSource = sessionData.dataSource as
      | AuraDataSource
      | undefined
    const auraChatId =
      (sessionData.auraChatId as string | undefined) || context.conversationId
    const question = (context.message || '').trim()

    if (isLanguageChangeCommand(question)) {
      return {
        message: PROMPTS.choose,
        updateSessionData: {
          language: undefined,
          awaitingLanguage: true,
          awaitingDataSource: false,
          dataSource: undefined,
        },
      }
    }

    if (!currentLanguage) {
      if (!sessionData.awaitingLanguage) {
        const selected = resolveLanguage(question)
        if (selected) {
          return {
            message: `${PROMPTS.selected[selected]}

${buildDataSourcePrompt(selected)}`,
            updateSessionData: {
              awaitingLanguage: false,
              language: selected,
              awaitingDataSource: true,
              dataSource: undefined,
            },
          }
        }

        return {
          message: PROMPTS.choose,
          updateSessionData: {
            awaitingLanguage: true,
          },
        }
      }

      const selected = resolveLanguage(question)
      if (!selected) {
        return {
          message: PROMPTS.invalid + '\n\n' + PROMPTS.choose,
          updateSessionData: {
            awaitingLanguage: true,
          },
        }
      }

      return {
        message: `${PROMPTS.selected[selected]}

${buildDataSourcePrompt(selected)}`,
        updateSessionData: {
          awaitingLanguage: false,
          language: selected,
          awaitingDataSource: true,
          dataSource: undefined,
        },
      }
    }

    if (isResetCommand(question)) {
      return {
        message: buildDataSourcePrompt(currentLanguage),
        updateSessionData: {
          auraChatId: buildChatId(),
          awaitingLanguage: false,
          awaitingDataSource: true,
          dataSource: undefined,
        },
      }
    }

    if (sessionData.awaitingDataSource || !currentDataSource) {
      const selectedDataSource = resolveDataSource(question)
      if (!selectedDataSource) {
        return {
          message: `${PROMPTS.dataSourceInvalid[currentLanguage]}

${buildDataSourcePrompt(currentLanguage)}`,
          updateSessionData: { awaitingDataSource: true },
        }
      }

      return {
        message: PROMPTS.askQuestion[currentLanguage],
        updateSessionData: {
          awaitingDataSource: false,
          dataSource: selectedDataSource,
        },
      }
    }

    if (!question) {
      return {
        message: PROMPTS.emptyQuestion[currentLanguage],
      }
    }

    const finalQuestion = `${question} ${DATA_SOURCE_SUFFIX[currentDataSource]}`
    return this.forwardToWebhook(
      context,
      webhookUrl,
      currentLanguage,
      auraChatId,
      finalQuestion,
    )
  }

  private async forwardToWebhook(
    context: MessageContext,
    webhookUrl: string,
    currentLanguage: AuraLanguage,
    auraChatId: string,
    question: string,
    extraSessionData?: Record<string, unknown>,
  ): Promise<StageResponse> {
    const payload: AuraWebhookPayload = {
      userMessage: question,
      company: (process.env.AURA_COMPANY || 'default').trim(),
      branch: (process.env.AURA_BRANCH || 'default').trim(),
      userId: (process.env.AURA_USER_ID || context.identifier).trim(),
      chatId: auraChatId,
      type: 'ask',
      language: currentLanguage,
    }

    try {
      await MessagingService.sendMessage({
        to: context.identifier,
        provider: context.provider as any,
        type: 'text',
        message: PROMPTS.generating[currentLanguage],
      })
    } catch {
      // Non-blocking: if the notice fails, continue with the request.
    }

    const timeoutEnv = Number(process.env.AURA_TIMEOUT_MS || '')
    const timeoutMs =
      Number.isFinite(timeoutEnv) && timeoutEnv > 0
        ? timeoutEnv
        : DEFAULT_AURA_TIMEOUT_MS

    try {
      const response = await axios.post<AuraWebhookResponse>(
        webhookUrl,
        payload,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: timeoutMs,
        },
      )

      const body = response.data || {}
      const rawText = body.summary || body.message
      const text = rawText
        ? formatAssistantMessage(rawText, 'OK')
        : PROMPTS.fallbackAnswer

      if (body.chart) {
        const media = await buildChartMedia(body.chart)
        if (media?.url || media?.base64) {
          return {
            message: text,
            updateSessionData: extraSessionData,
            media: {
              type: 'image',
              url: media.url,
              base64: media.base64,
              filename: 'grafico.png',
              caption: text,
            },
          }
        }
      }

      return { message: text, updateSessionData: extraSessionData }
    } catch (error: any) {
      const reason =
        error?.response?.data?.message || error?.message || 'Erro desconhecido'
      return {
        message: `${PROMPTS.requestFailed}${reason}`,
        updateSessionData: extraSessionData,
      }
    }
  }
}

export class AuraBot extends BaseBot {
  constructor() {
    super({
      id: 'aura',
      name: 'Aura',
      description: 'Bot que encaminha perguntas para o webhook do Aura',
      initialStage: 0,
    })
  }

  protected registerStages(): void {
    this.addStage(new AuraMainStage())
  }
}
