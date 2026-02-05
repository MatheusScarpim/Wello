import axios from 'axios'
import FormData from 'form-data'
import path from 'path'

import { BaseBot } from '@/core/bot/BaseBot'
import {
  IBotStage,
  MessageContext,
  StageResponse,
} from '@/core/bot/interfaces/IBotStage'

const UPLOAD_URL = 'https://janus-api.moovefy.app/api/attachments/upload'
const PROCESS_URL = 'https://janus-api.moovefy.app/api/process'
const PROCESS_PAYLOAD = {
  formId: '69396494cc11d4b54fd97a46',
  isTestMode: false,
}
const KEYCLOAK_TOKEN_URL =
  process.env.JANUS_KEYCLOAK_TOKEN_URL ||
  'https://janus-auth.moovefy.app/realms/master/protocol/openid-connect/token'
const KEYCLOAK_CLIENT_ID = process.env.JANUS_KEYCLOAK_CLIENT_ID || 'janus-back'
const KEYCLOAK_CLIENT_SECRET =
  process.env.JANUS_KEYCLOAK_CLIENT_SECRET || 'OerA4dRjINSVMGaVXIS04IJUIyY4LtBi'
const KEYCLOAK_USERNAME = process.env.JANUS_KEYCLOAK_USERNAME || 'admin_viena'
const KEYCLOAK_PASSWORD = process.env.JANUS_KEYCLOAK_PASSWORD || 'admin123'
const KEYCLOAK_GRANT =
  (process.env.JANUS_KEYCLOAK_GRANT as 'password' | 'client_credentials') ||
  'password'
const DEFAULT_STAGE_DESTINATION =
  process.env.JANUS_STAGE_DESTINATION_ID || '2d054a48f6f675d0e15776c7'
const DEFAULT_EXECUTOR_BRANCH = '6939641dcc11d4b54fd97a45'

type SessionData = {
  supplierName?: string
  pendingMedia?: {
    url: string
    type?: string
    filename?: string
  }
  uploads?: Array<{
    filename: string
    descricao: string
    url?: string
    contentType?: string
    size?: number
    originalName?: string
  }>
}

type CachedToken = {
  token: string
  expiresAt: number
}

let tokenCache: CachedToken | null = null

async function getAuthToken(forceRefresh: boolean = false): Promise<string> {
  const now = Date.now()
  if (!forceRefresh && tokenCache && tokenCache.expiresAt > now + 10_000) {
    return tokenCache.token
  }

  const form = new URLSearchParams()
  if (KEYCLOAK_GRANT === 'client_credentials') {
    form.append('grant_type', 'client_credentials')
    form.append('client_id', KEYCLOAK_CLIENT_ID)
    if (!KEYCLOAK_CLIENT_SECRET) {
      throw new Error('client_credentials requer JANUS_KEYCLOAK_CLIENT_SECRET')
    }
    form.append('client_secret', KEYCLOAK_CLIENT_SECRET)
  } else {
    form.append('grant_type', 'password')
    form.append('client_id', KEYCLOAK_CLIENT_ID)
    if (KEYCLOAK_CLIENT_SECRET) {
      form.append('client_secret', KEYCLOAK_CLIENT_SECRET)
    }
    form.append('username', KEYCLOAK_USERNAME)
    form.append('password', KEYCLOAK_PASSWORD)
  }

  const response = await axios.post(KEYCLOAK_TOKEN_URL, form.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

  const token = response.data?.access_token
  const expiresIn = Number(response.data?.expires_in || 300)
  tokenCache = {
    token,
    expiresAt: now + expiresIn * 1000,
  }

  if (!token) {
    throw new Error('Token não retornado pelo Keycloak')
  }

  return token
}

async function requestWithAuth<T = any>(
  fn: (token: string) => Promise<T>,
): Promise<T> {
  const attempt = async (forceRefresh: boolean = false): Promise<T> => {
    const token = await getAuthToken(forceRefresh)
    try {
      return await fn(token)
    } catch (error: any) {
      const status = error?.response?.status
      const msg = error?.response?.data?.message || error?.message
      console.error('⚠️ Erro na requisição autenticada', {
        status,
        message: msg,
        forceRefresh,
      })
      if (!forceRefresh && status === 401) {
        // Tenta renovar o token e repetir uma vez
        return await attempt(true)
      }
      throw error
    }
  }
  return attempt()
}

export class SupplierUploadBot extends BaseBot {
  constructor() {
    super({
      id: 'fornecedor-upload',
      name: 'Recebedor de Documentos',
      description: 'Coleta anexos por fornecedor e envia para Janus API',
      initialStage: 0,
      sessionTimeout: 60 * 6, // 6 horas
      enableAnalytics: false,
    })
  }

  protected registerStages(): void {
    this.addStage(new StartStage())
    this.addStage(new SupplierNameStage())
    this.addStage(new AwaitAttachmentStage())
    this.addStage(new AwaitDescriptionStage())
  }
}

class StartStage implements IBotStage {
  readonly stageNumber = 0
  readonly description = 'Saudação e solicitação do fornecedor'

  async execute(context: MessageContext): Promise<StageResponse> {
    return {
      message:
        'Olá! Vamos registrar documentos para pagamento.\n' +
        'Primeiro, informe o *nome do fornecedor*:',
      nextStage: 1,
    }
  }
}

class SupplierNameStage implements IBotStage {
  readonly stageNumber = 1
  readonly description = 'Coleta do nome do fornecedor'

  async validate(input: string): Promise<{ isValid: boolean; error?: string }> {
    const name = input.trim()
    if (name.length < 3) {
      return {
        isValid: false,
        error: 'Informe um nome de fornecedor válido (mín. 3 caracteres).',
      }
    }
    return { isValid: true }
  }

  async execute(context: MessageContext): Promise<StageResponse> {
    const supplierName = context.message.trim()

    return {
      message:
        `Fornecedor registrado: *${supplierName}*.\n\n` +
        'Agora envie os anexos (imagem, pdf ou documento). Para cada anexo vou pedir uma *descrição*.\n' +
        'Quando terminar, digite *fim*.',
      nextStage: 2,
      updateSessionData: {
        ...(context.sessionData || {}),
        supplierName,
        uploads: [],
      } as SessionData,
    }
  }
}

class AwaitAttachmentStage implements IBotStage {
  readonly stageNumber = 2
  readonly description = 'Aguardando anexos ou comando fim'

  async execute(context: MessageContext): Promise<StageResponse> {
    const message = context.message?.trim().toLowerCase()
    const session = (context.sessionData || {}) as SessionData

    if (message === 'fim') {
      const uploads = session.uploads || []
      const resumo =
        uploads.length === 0
          ? 'Nenhum documento foi enviado.'
          : `Documentos enviados (${uploads.length}):\n- ${uploads
              .map((u) => `${u.filename} – ${u.descricao}`)
              .join('\n- ')}`

      const processResult = await this.openProcess()

      if (processResult.processId) {
        await this.advanceProcess(
          processResult.processId,
          processResult.processData,
          session,
          context,
        )
      }

      return {
        message: `Encerrando o envio.\n${resumo}\n\n${processResult.message}`,
        endSession: true,
      }
    }

    if (!context.mediaUrl) {
      return {
        message:
          'Envie um anexo (imagem/pdf/doc). Se já terminou, digite *fim*.\n' +
          'Se precisar, inclua uma legenda curta junto com o arquivo.',
        nextStage: 2,
      }
    }

    const filename = this.extractFilename(context)

    return {
      message: `Anexo recebido (${filename}). Agora envie a *descrição* desse documento.`,
      nextStage: 3,
      updateSessionData: {
        ...session,
        pendingMedia: {
          url: context.mediaUrl,
          type: context.type,
          filename,
        },
      } as SessionData,
    }
  }

  private extractFilename(context: MessageContext): string {
    const typeToExt: Record<string, string> = {
      image: 'jpg',
      video: 'mp4',
      audio: 'ogg',
      ptt: 'ogg',
      document: 'pdf',
      sticker: 'webp',
    }
    const extHint = context.type ? typeToExt[context.type] : undefined
    const fallback = `whatsapp-${Date.now()}.${extHint || 'bin'}`

    const fromStorage = context.mediaStorage?.blobName
    if (fromStorage) {
      const base = path.basename(fromStorage)
      return base || fallback
    }

    const mediaUrl = context.mediaUrl || ''
    // Evita usar base64/data URL como nome
    if (mediaUrl.startsWith('data:')) {
      return fallback
    }
    // Se for uma string enorme, usa fallback
    if (mediaUrl.length > 200) {
      return fallback
    }

    if (mediaUrl) {
      try {
        const url = new URL(mediaUrl)
        const last = path.basename(url.pathname)
        if (last && last.length < 150) return last
      } catch {
        // ignore parse errors
      }
    }

    return fallback
  }

  private async openProcess(): Promise<{
    message: string
    processId?: string
    processData?: any
  }> {
    try {
      const response = await requestWithAuth((token) =>
        axios.post(PROCESS_URL, PROCESS_PAYLOAD, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      )
      const processId = response.data?.id || response.data?.processId
      if (processId) {
        return {
          message: `Processo aberto com sucesso (ID: ${processId}).`,
          processId,
          processData: response.data,
        }
      }
      return { message: 'Processo aberto com sucesso.' }
    } catch (error: any) {
      console.error('⚠️ Erro ao abrir processo', {
        status: error?.response?.status,
        data: error?.response?.data,
        url: PROCESS_URL,
        payload: PROCESS_PAYLOAD,
      })
      const reason =
        error?.response?.data?.message ||
        error?.message ||
        'Erro ao abrir processo.'
      return {
        message: `Não foi possível abrir o processo automaticamente: ${reason}`,
      }
    }
  }

  private buildValues(
    session: SessionData,
    context: MessageContext,
    baseValues: any[] = [],
  ) {
    const uploads = session.uploads || []
    const baseDocs = baseValues.find((v) => v.identifier === 'GD_DOCUMENTOSB')
      ?.data?.rows
    const existingRows = Array.isArray(baseDocs) ? baseDocs : []
    const newRows = uploads.map((upload) => ({
      id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      cells: {
        COL_ARQUIV_1: [
          {
            fileName: upload.filename,
            originalName: upload.originalName || upload.filename,
            url: upload.url,
            contentType: upload.contentType,
            size: upload.size,
          },
        ],
        COL_DESCRI_2: upload.descricao || '',
        COL_TIPO_D_3: '',
        COL_CENTRO_4: '',
        COL_VALOR_5: '',
        COL_DATA_D_6: '',
      },
      isNew: true,
      isModified: true,
    }))
    // Mantém linhas anteriores e acrescenta novas
    const documentsRows = [
      ...existingRows.map((row) => ({ ...row, isModified: true })),
      ...newRows,
    ]

    const replaceOrAdd = (arr: any[], identifier: string, data: any) => {
      const existingIndex = arr.findIndex((v) => v.identifier === identifier)
      if (existingIndex >= 0) {
        arr[existingIndex] = { identifier, data }
      } else {
        arr.push({ identifier, data })
      }
    }

    const values = [...baseValues]
    // Preenche identificador e nome do fornecedor
    replaceOrAdd(values, 'LT_NMERO_DO_FO', context.identifier || null)
    replaceOrAdd(values, 'LT_NOME_DO_CON', session.supplierName || null)
    replaceOrAdd(values, 'GD_DOCUMENTOSB', { rows: documentsRows })
    replaceOrAdd(
      values,
      'TA_OBSERVAES',
      baseValues.find((v) => v.identifier === 'TA_OBSERVAES')?.data ?? null,
    )
    replaceOrAdd(
      values,
      'GD_CLIENTES',
      baseValues.find((v) => v.identifier === 'GD_CLIENTES')?.data ?? null,
    )

    return values
  }

  private async advanceProcess(
    processId: string,
    processData: any,
    session: SessionData,
    context: MessageContext,
  ) {
    try {
      const values = this.buildValues(
        session,
        context,
        processData?.values || [],
      )
      console.log(
        'SupplierUploadBot values payload',
        JSON.stringify(values, null, 2),
      )
      const executors = {
        executorBranchs: processData?.executors?.executorBranchs || [
          DEFAULT_EXECUTOR_BRANCH,
        ],
        executorSectors: processData?.executors?.executorSectors || [],
        executorGroups: processData?.executors?.executorGroups || [],
        executorUsers: processData?.executors?.executorUsers || [],
      }
      const stageDestinationId =
        processData?.stageDestinationId || DEFAULT_STAGE_DESTINATION
      const stageId =
        processData?.stageId ||
        processData?.currentStage ||
        processData?.stageDestinationId ||
        DEFAULT_STAGE_DESTINATION

      const payload = {
        id: processId,
        protocol: processData?.protocol,
        formId: processData?.formId || PROCESS_PAYLOAD.formId,
        form: processData?.form ?? null,
        cycle: processData?.cycle || 1,
        stageId,
        executors,
        createdAt: processData?.createdAt,
        values,
        stages: processData?.stages || [],
        currentStage: processData?.currentStage ?? null,
        openBy: processData?.openBy,
        executor: processData?.executor ?? null,
        isTestMode: processData?.isTestMode || false,
        isManager: processData?.isManager || false,
        labelButton: processData?.labelButton || 'Avançar',
        isCyclic: processData?.isCyclic || false,
        stageDestinationId,
        isFinal: processData?.isFinal || false,
      }

      console.log('🚚 Payload avanço de processo', {
        processId,
        payload: {
          ...payload,
          values,
        },
      })

      await requestWithAuth((token) =>
        axios.put(`${PROCESS_URL}/${processId}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      )
    } catch (error: any) {
      console.error('⚠️ Erro ao avançar processo', {
        status: error?.response?.status,
        data: error?.response?.data,
        processId,
      })
    }
  }
}

class AwaitDescriptionStage implements IBotStage {
  readonly stageNumber = 3
  readonly description =
    'Recebe a descrição e envia o arquivo para a API externa'

  async validate(input: string): Promise<{ isValid: boolean; error?: string }> {
    const trimmed = input.trim()
    if (!trimmed) {
      return { isValid: false, error: 'Envie uma descrição para o documento.' }
    }
    if (trimmed.length < 3) {
      return {
        isValid: false,
        error: 'Use ao menos 3 caracteres na descrição.',
      }
    }
    return { isValid: true }
  }

  async execute(context: MessageContext): Promise<StageResponse> {
    const session = (context.sessionData || {}) as SessionData
    const pending = session.pendingMedia
    const supplierName = session.supplierName || 'Fornecedor'
    const descricao = context.message.trim()

    if (!pending?.url) {
      return {
        message: 'Não encontrei um anexo pendente. Envie um arquivo primeiro.',
        nextStage: 2,
      }
    }

    try {
      const uploadResult = await this.uploadToJanus({
        url: pending.url,
        descricao,
        supplierName,
        filename: pending.filename,
        type: pending.type,
      })

      const uploads = Array.isArray(session.uploads) ? [...session.uploads] : []
      uploads.push({
        filename: uploadResult.filename,
        descricao,
        url: uploadResult.url,
        contentType: uploadResult.contentType,
        size: uploadResult.size,
        originalName: uploadResult.originalName,
      })

      return {
        message:
          `✅ Documento enviado com sucesso (${uploadResult.filename}).\n` +
          'Envie outro anexo ou digite *fim* para encerrar.',
        nextStage: 2,
        updateSessionData: {
          ...session,
          pendingMedia: undefined,
          uploads,
        } as SessionData,
      }
    } catch (error: any) {
      console.error('⚠️ Erro ao enviar documento', {
        status: error?.response?.status,
        data: error?.response?.data,
        url: pending?.url,
      })
      const reason = error?.message || 'Falha ao enviar o documento.'
      return {
        message: `Erro ao enviar o documento: ${reason}\nTente novamente ou envie outro anexo.`,
        nextStage: 2,
        updateSessionData: {
          ...session,
          pendingMedia: undefined,
        } as SessionData,
      }
    }
  }

  private async uploadToJanus(params: {
    url: string
    descricao: string
    supplierName: string
    filename?: string
    type?: string
  }): Promise<{
    filename: string
    originalName?: string
    url?: string
    contentType?: string
    size?: number
  }> {
    const { url, descricao, supplierName, filename, type } = params

    let buffer: Buffer
    let contentType = 'application/octet-stream'
    let resolvedFilename = filename
    const typeToMime: Record<string, { mime: string; ext: string }> = {
      image: { mime: 'image/jpeg', ext: 'jpg' },
      video: { mime: 'video/mp4', ext: 'mp4' },
      audio: { mime: 'audio/ogg', ext: 'ogg' },
      ptt: { mime: 'audio/ogg', ext: 'ogg' },
      document: { mime: 'application/pdf', ext: 'pdf' },
      sticker: { mime: 'image/webp', ext: 'webp' },
    }
    const typeHint = type ? typeToMime[type] : undefined
    if (!resolvedFilename && typeHint) {
      resolvedFilename = `whatsapp-${Date.now()}.${typeHint.ext}`
    }
    if (typeHint) {
      contentType = typeHint.mime
    }

    if (url.startsWith('data:')) {
      const match = url.match(/^data:([^;]+);base64,(.+)$/)
      if (!match) {
        throw new Error('Data URL inválida para upload')
      }
      contentType = match[1] || contentType
      buffer = Buffer.from(match[2], 'base64')
      if (!filename) {
        const ext = contentType.split('/')[1] || 'bin'
        resolvedFilename = `whatsapp-${Date.now()}.${ext}`
      }
    } else if (/^https?:\/\//i.test(url)) {
      const response = await axios.get(url, { responseType: 'arraybuffer' })
      buffer = Buffer.from(response.data)
      contentType = response.headers['content-type'] || contentType
      resolvedFilename = filename || this.fallbackFilenameFromUrl(url)
    } else {
      // Qualquer outra string tratamos como base64 puro
      const normalized = url.replace(/\s+/g, '')
      buffer = Buffer.from(normalized, 'base64')
      contentType = contentType || 'application/octet-stream'
      if (!filename) {
        resolvedFilename = `whatsapp-${Date.now()}.bin`
      }
    }

    const extHint = this.guessExtension(buffer, contentType) || typeHint?.ext
    if (contentType === 'application/octet-stream' && extHint) {
      const mimeFromExt: Record<string, string> = {
        pdf: 'application/pdf',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        mp4: 'video/mp4',
        webm: 'video/webm',
        zip: 'application/zip',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ogg: 'audio/ogg',
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
      }
      contentType = mimeFromExt[extHint] || contentType
    }

    resolvedFilename = this.normalizeFilename(
      resolvedFilename,
      contentType,
      extHint,
    )

    // Janus upload espera apenas o arquivo no multipart
    const form = new FormData()
    form.append('file', buffer, {
      filename: resolvedFilename,
      contentType,
    })

    // Alguns endpoints precisam do Content-Length preciso
    const contentLength = await new Promise<number | undefined>((resolve) => {
      form.getLength((err, length) => {
        if (err) {
          console.warn(
            'Não foi possivel calcular Content-Length do upload',
            err,
          )
          return resolve(undefined)
        }
        resolve(length)
      })
    })

    const uploadResponse = await requestWithAuth((token) =>
      axios.post(UPLOAD_URL, form, {
        headers: {
          ...form.getHeaders(),
          ...(contentLength ? { 'Content-Length': contentLength } : {}),
          Authorization: `Bearer ${token}`,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }),
    )

    const meta = uploadResponse?.data || {}

    return {
      filename: meta.fileName || resolvedFilename,
      originalName: meta.originalName || resolvedFilename,
      url: meta.url,
      contentType: meta.contentType || contentType,
      size: meta.size ?? buffer.length,
    }
  }

  private fallbackFilenameFromUrl(url: string): string {
    try {
      const parsed = new URL(url)
      const last = path.basename(parsed.pathname)
      if (last) return last
    } catch {
      // ignore parse errors
    }
    return `anexo-${Date.now()}.bin`
  }

  private normalizeFilename(
    name: string | undefined,
    contentType: string,
    extHint?: string,
  ): string {
    const rawExt = (contentType.split('/')[1] || '').split('+')[0]
    const ext = extHint || rawExt || 'bin'
    const fallback = `whatsapp-${Date.now()}.${ext || 'bin'}`
    if (!name) return fallback
    if (name.startsWith('data:')) return fallback
    if (name.length > 150) return fallback
    const cleaned = name.replace(/[^\w.\-() ]+/g, '').trim()
    if (!cleaned) return fallback
    // se o nome nÇ£o tem extensÇ£o, anexa uma derivada
    if (!cleaned.includes('.') && ext) {
      return `${cleaned}.${ext}`
    }
    return cleaned
  }

  private guessExtension(
    buffer: Buffer,
    contentType: string,
  ): string | undefined {
    const header = buffer.slice(0, 12).toString('hex')
    if (buffer.slice(0, 5).toString() === '%PDF-') return 'pdf'
    if (buffer[0] === 0x89 && buffer.slice(1, 4).toString() === 'PNG')
      return 'png'
    if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'jpg'
    if (buffer.slice(0, 3).toString() === 'GIF') return 'gif'
    if (
      buffer.slice(0, 4).toString() === 'RIFF' &&
      buffer.slice(8, 12).toString() === 'WEBP'
    )
      return 'webp'
    if (buffer.slice(4, 8).toString() === 'ftyp') return 'mp4'
    if (buffer.slice(0, 4).toString() === 'OggS') return 'ogg'
    if (buffer.slice(0, 2).toString() === 'PK') {
      // Pode ser zip/docx/xlsx/pptx
      return 'zip'
    }
    const extFromContentType = (contentType.split('/')[1] || '').split('+')[0]
    return extFromContentType || undefined
  }
}
