import * as wpp from '@wppconnect-team/wppconnect'
import EventEmitter from 'events'
import * as fs from 'fs'
import * as path from 'path'

import whatsappInstanceRepository, {
  InstanceStatus,
  IWhatsAppInstance,
  InstanceConnectionType,
  MetaInstanceConfig,
  InstanceAutomaticMessages,
} from '../../api/repositories/WhatsAppInstanceRepository'
import whatsappSessionRepository from '../../api/repositories/WhatsAppSessionRepository'
import MediaProcessor from '../helpers/MediaProcessor'
import sessionTokenStore from './SessionTokenStore'
import type { IncomingMessage } from './WhatsAppManager'

// Pasta base para tokens das instancias multi
const MULTI_TOKENS_FOLDER = './tokens/multi-instances'

export interface InstanceInfo {
  id: string
  name: string
  sessionName: string
  connectionType?: InstanceConnectionType
  status: InstanceStatus
  connected: boolean
  authenticated: boolean
  qrCode: string | null
  phoneNumber?: string
  profileName?: string
  isDefault: boolean
  botEnabled?: boolean
  botId?: string | null
  automaticMessages?: InstanceAutomaticMessages
  metaConfig?: MetaInstanceConfig
  fairDistributionEnabled?: boolean
  departmentIds?: string[]
}

interface InstanceData {
  client: wpp.Whatsapp | null
  config: IWhatsAppInstance
  qrCode: string | null
  qrCodeTimestamp: number
  isConnecting: boolean
  wasConnected: boolean
}

/**
 * Gerenciador de múltiplas instâncias WhatsApp
 */
class WhatsAppMultiManager extends EventEmitter {
  private static instance: WhatsAppMultiManager
  private instances: Map<string, InstanceData> = new Map()

  private constructor() {
    super()
  }

  public static getInstance(): WhatsAppMultiManager {
    if (!WhatsAppMultiManager.instance) {
      WhatsAppMultiManager.instance = new WhatsAppMultiManager()
    }
    return WhatsAppMultiManager.instance
  }

  /**
   * Inicializa todas as instâncias com autoConnect
   */
  public async initialize(): Promise<void> {
    console.log(`🧹 Limpando processos Chromium órfãos antes de inicializar...`)

    // Limpa todos os processos Chromium que possam estar rodando
    await this.killOrphanChromiumProcesses()

    // Aguarda um pouco para garantir que morreram
    await new Promise((resolve) => setTimeout(resolve, 3000))

    const instances = await whatsappInstanceRepository.findAllActive()
    console.log(`🔄 Inicializando ${instances.length} instância(s) WhatsApp...`)

    // Limpa locks de todas as instâncias ANTES de conectar
    for (const instance of instances) {
      console.log(`🧹 Limpando locks da instância ${instance.name}...`)
      await this.cleanupStaleLocks(instance.sessionName, false)
    }

    // Aguarda mais um pouco
    await new Promise((resolve) => setTimeout(resolve, 2000))

    for (const instance of instances) {
      try {
        await this.connectInstance(instance.sessionName)
      } catch (error) {
        console.error(
          `❌ Erro ao inicializar instância ${instance.name}:`,
          error,
        )
      }
    }
  }

  /**
   * Cria uma nova instância
   */
  public async createInstance(data: {
    name: string
    connectionType?: InstanceConnectionType
    metaConfig?: MetaInstanceConfig
    isDefault?: boolean
    autoConnect?: boolean
    webhookUrl?: string
    departmentIds?: string[]
    fairDistributionEnabled?: boolean
    botEnabled?: boolean
    botId?: string | null
  }): Promise<IWhatsAppInstance> {
    const sessionName = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const instance = await whatsappInstanceRepository.createInstance({
      name: data.name,
      sessionName,
      connectionType: data.connectionType || 'wppconnect',
      status: 'disconnected',
      isDefault: data.isDefault || false,
      autoConnect: data.autoConnect ?? true,
      webhookUrl: data.webhookUrl,
      departmentIds: data.departmentIds || [],
      fairDistributionEnabled: data.fairDistributionEnabled ?? false,
      botEnabled: data.botEnabled ?? true,
      botId: data.botId ?? null,
      metaConfig: data.metaConfig,
    })

    return instance
  }

  /**
   * Conecta uma instância específica
   */
  public async connectInstance(
    sessionName: string,
    retryCount: number = 0,
  ): Promise<void> {
    const MAX_RETRIES = 3
    const config =
      await whatsappInstanceRepository.findBySessionName(sessionName)
    if (!config) {
      throw new Error(`Instância ${sessionName} não encontrada`)
    }

    if (config.connectionType === 'meta_official') {
      const configured =
        !!config.metaConfig?.enabled &&
        !!config.metaConfig?.accessToken &&
        (!!config.metaConfig?.phoneNumberId || !!config.metaConfig?.instagramAccountId)
      await whatsappInstanceRepository.updateStatus(
        sessionName,
        configured ? 'connected' : 'disconnected',
      )
      return
    }

    let instanceData = this.instances.get(sessionName)

    if (instanceData?.client) {
      console.log(`✅ Instância ${config.name} já está conectada`)
      return
    }

    if (instanceData?.isConnecting) {
      console.log(`⏳ Instância ${config.name} já está conectando...`)
      return
    }

    // Garante que a pasta de tokens existe
    this.ensureTokensFolderExists()

    // Verifica se há sessão salva no banco
    const existingSession =
      await whatsappSessionRepository.findBySessionName(sessionName)
    if (existingSession) {
      console.log(
        `📦 [${config.name}] Sessão encontrada no banco (phone=${existingSession.phoneNumber || 'N/A'})`,
      )
    } else {
      console.log(
        `📦 [${config.name}] Nenhuma sessão salva no banco - será necessário escanear QR`,
      )
    }

    // Verifica se o diretório browser-data existe
    const browserDataDir = path.join(
      MULTI_TOKENS_FOLDER,
      sessionName,
      'browser-data',
    )
    if (fs.existsSync(browserDataDir)) {
      console.log(
        `📁 [${config.name}] Diretório browser-data existe - tentando restaurar sessão`,
      )
    } else {
      console.log(
        `📁 [${config.name}] Diretório browser-data não existe - nova sessão`,
      )
    }

    // NÃO remove browser-data - os dados de autenticação ficam lá!
    // Apenas limpa os lock files que podem ter ficado de execuções anteriores
    console.log(
      `🧹 [${config.name}] Limpando apenas lock files (preservando dados do browser)...`,
    )
    await this.cleanupStaleLocks(sessionName)

    // cleanupStaleLocks já faz limpeza de processos da sessão atual
    console.log(`🧹 [${config.name}] Aguardando limpeza finalizar...`)
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Inicializa ou atualiza dados da instância
    instanceData = {
      client: null,
      config,
      qrCode: null,
      qrCodeTimestamp: 0,
      isConnecting: true,
      wasConnected: false,
    }
    this.instances.set(sessionName, instanceData)

    await whatsappInstanceRepository.updateStatus(sessionName, 'connecting')

    try {
      console.log(
        `🔄 Conectando instância ${config.name}... (tentativa ${retryCount + 1})`,
      )

      // Usa diretório FIXO para preservar dados de autenticação entre reinícios
      const userDataDir = path.join(
        MULTI_TOKENS_FOLDER,
        sessionName,
        'browser-data',
      )
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true })
      }
      console.log(`📁 [${config.name}] Usando userDataDir: ${userDataDir}`)

      const client = await wpp.create({
        session: sessionName,
        headless: true,
        devtools: false,
        debug: false,
        logQR: true,
        browserWS: '',
        disableWelcome: true,
        updatesLog: false,
        autoClose: 0,
        waitForLogin: false,
        tokenStore: sessionTokenStore,
        folderNameToken: MULTI_TOKENS_FOLDER,
        puppeteerOptions: {
          protocolTimeout: 600000,
        },
        browserArgs: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-extensions',
          '--mute-audio',
          `--user-data-dir=${userDataDir}`,
        ],
        catchQR: (base64Qr, _asciiQR, attempt) => {
          console.log(
            `📱 [${config.name}] QR Code gerado (tentativa ${attempt})`,
          )
          console.log(`📱 [${config.name}] SessionName: ${sessionName}`)
          console.log(
            `📱 [${config.name}] QR Code length: ${base64Qr?.length || 0}`,
          )

          const data = this.instances.get(sessionName)
          if (data) {
            data.qrCode = base64Qr
            data.qrCodeTimestamp = Date.now()
            console.log(`📱 [${config.name}] QR Code armazenado com sucesso`)
          } else {
            console.log(
              `📱 [${config.name}] ERRO: Instancia não encontrada no Map!`,
            )
          }

          whatsappInstanceRepository.updateStatus(sessionName, 'qrcode')
          this.emit('qrcode', { sessionName, qrCode: base64Qr })
        },
        statusFind: async (statusSession) => {
          console.log(`📊 [${config.name}] Status: ${statusSession}`)
          if (statusSession === 'isLogged' || statusSession === 'inChat') {
            const data = this.instances.get(sessionName)
            if (data) {
              data.qrCode = null
              data.wasConnected = true
            }
            // Persiste a sessão assim que autenticado
            console.log(
              `💾 [${config.name}] Autenticado via statusFind, persistindo sessão...`,
            )
            try {
              // Aguarda um momento para o client estar pronto
              await new Promise((resolve) => setTimeout(resolve, 1000))
              const instData = this.instances.get(sessionName)
              if (instData?.client) {
                await this.persistInstanceSession(sessionName, instData.client)
              }
            } catch (e) {
              console.warn(
                `⚠️ [${config.name}] Erro ao persistir sessão no statusFind:`,
                e,
              )
            }
          }
        },
      })

      instanceData.client = client
      instanceData.isConnecting = false
      this.instances.set(sessionName, instanceData)

      this.setupInstanceHandlers(sessionName, client, config)

      console.log(`✅ Instância ${config.name} conectada`)
    } catch (error: any) {
      console.error(
        `❌ Erro ao conectar instância ${config.name}:`,
        error.message,
      )
      instanceData.isConnecting = false
      this.instances.set(sessionName, instanceData)

      // Se o erro for relacionado a lock/profile em uso, tenta novamente
      const isLockError =
        error.message?.includes('profile') ||
        error.message?.includes('lock') ||
        error.message?.includes('already running') ||
        error.message?.includes('Chromium') ||
        error.message?.includes('SingletonLock')

      if (isLockError && retryCount < MAX_RETRIES) {
        console.log(
          `🔄 [${config.name}] Erro de lock detectado (tentativa ${retryCount + 1}/${MAX_RETRIES})`,
        )
        console.log(
          `🔄 [${config.name}] Limpando browser-data e tentando novamente em 5s...`,
        )

        // Usa modo agressivo - remove completamente o browser-data
        await this.forceCleanupSession(sessionName, true)
        await new Promise((resolve) => setTimeout(resolve, 5000))
        return this.connectInstance(sessionName, retryCount + 1)
      }

      await whatsappInstanceRepository.updateStatus(sessionName, 'error')
      throw error
    }
  }

  /**
   * Força limpeza de uma sessão
   * @param aggressive Se true, remove completamente o browser-data (perde autenticação)
   */
  private async forceCleanupSession(
    sessionName: string,
    aggressive: boolean = false,
  ): Promise<void> {
    console.log(
      `🧹 [${sessionName}] Forçando limpeza (aggressive=${aggressive})...`,
    )

    // Mata todos os processos Chromium PRIMEIRO
    await this.killOrphanChromiumProcesses(sessionName)

    // Aguarda processos morrerem
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Limpa locks (ou todo o diretório se aggressive=true)
    await this.cleanupStaleLocks(sessionName, aggressive)

    // Aguarda mais um pouco para garantir
    await new Promise((resolve) => setTimeout(resolve, 1000))

    console.log(`🧹 [${sessionName}] Limpeza finalizada`)
  }

  /**
   * Garante que a pasta de tokens existe
   */
  private ensureTokensFolderExists(): void {
    if (!fs.existsSync(MULTI_TOKENS_FOLDER)) {
      fs.mkdirSync(MULTI_TOKENS_FOLDER, { recursive: true })
      console.log(`📁 Pasta de tokens criada: ${MULTI_TOKENS_FOLDER}`)
    }
  }

  /**
   * Remove arquivos de lock que podem ter ficado de sessoes anteriores
   */
  private async cleanupStaleLocks(
    sessionName: string,
    aggressive: boolean = false,
  ): Promise<void> {
    console.log(
      `🧹 Iniciando limpeza de locks para ${sessionName} (aggressive=${aggressive})...`,
    )

    const browserDataDir = path.join(
      MULTI_TOKENS_FOLDER,
      sessionName,
      'browser-data',
    )

    // Se modo agressivo, remove completamente o diretório browser-data
    if (aggressive && fs.existsSync(browserDataDir)) {
      console.log(
        `🧹 Modo agressivo: removendo completamente ${browserDataDir}`,
      )
      try {
        fs.rmSync(browserDataDir, { recursive: true, force: true })
        console.log(`🧹 Diretório removido com sucesso`)
      } catch (e) {
        console.warn(`⚠️ Erro ao remover via fs.rmSync, tentando via shell...`)
        try {
          const { execSync } = require('child_process')
          execSync(`rm -rf "${browserDataDir}"`, {
            stdio: 'ignore',
            timeout: 10000,
          })
          console.log(`🧹 Diretório removido via shell`)
        } catch (e2) {
          console.warn(`⚠️ Falha ao remover diretório:`, e2)
        }
      }
      return
    }

    // Lista de pastas onde podem existir locks
    const foldersToClean = [
      path.join(MULTI_TOKENS_FOLDER, sessionName),
      browserDataDir,
      path.join(browserDataDir, 'Default'),
      path.join('./tokens', sessionName),
    ]

    // Arquivos de lock do Chromium
    const lockFiles = [
      'SingletonLock',
      'SingletonSocket',
      'SingletonCookie',
      'lockfile',
      '.org.chromium.Chromium.lock',
      'DevToolsActivePort',
    ]

    for (const folder of foldersToClean) {
      if (fs.existsSync(folder)) {
        // Remove arquivos de lock na pasta principal
        for (const lockFile of lockFiles) {
          const filePath = path.join(folder, lockFile)
          this.tryRemoveFile(filePath)
        }

        // Procura recursivamente por locks em subpastas (Default, Profile, etc)
        try {
          const items = fs.readdirSync(folder)
          for (const item of items) {
            const itemPath = path.join(folder, item)
            try {
              if (fs.statSync(itemPath).isDirectory()) {
                for (const lockFile of lockFiles) {
                  const filePath = path.join(itemPath, lockFile)
                  this.tryRemoveFile(filePath)
                }
              }
            } catch (e) {
              // Ignora erros de stat (pode ser link quebrado)
            }
          }
        } catch (e) {
          // Ignora erros de leitura
        }
      }
    }

    // Tenta matar processos Chrome órfãos (Linux/Docker)
    await this.killOrphanChromiumProcesses(sessionName)
  }

  /**
   * Tenta remover um arquivo silenciosamente
   */
  private tryRemoveFile(filePath: string): void {
    try {
      // Verifica se existe (inclui links simbólicos quebrados)
      const stats = fs.lstatSync(filePath)
      if (stats) {
        try {
          fs.rmSync(filePath, { force: true, recursive: true })
          console.log(`🧹 Removido lock: ${filePath}`)
        } catch (e) {
          // Tenta com rm -f via processo
          try {
            require('child_process').execSync(`rm -rf "${filePath}"`, {
              stdio: 'ignore',
            })
            console.log(`🧹 Removido lock (force): ${filePath}`)
          } catch (e2) {
            console.warn(`⚠️ Não foi possível remover: ${filePath}`)
          }
        }
      }
    } catch (e) {
      // Arquivo não existe, ignora
    }
  }

  /**
   * Mata processos Chromium órfãos
   */
  private async killOrphanChromiumProcesses(
    sessionName?: string,
  ): Promise<void> {
    try {
      const { execSync } = require('child_process')

      console.log(
        sessionName
          ? `🧹 Matando processos Chromium órfãos da sessão ${sessionName}...`
          : '🧹 Matando processos Chromium órfãos...',
      )

      const isWindows = process.platform === 'win32'
      const sessionPattern = sessionName
        ? sessionName.replace(/[^\w-]/g, '')
        : undefined

      // Em Windows evitamos limpeza global para não matar navegadores não relacionados.
      if (isWindows && !sessionPattern) {
        console.log(
          '⚠️ Limpeza global de processos Chromium ignorada no Windows.',
        )
        return
      }

      // Tenta diferentes comandos para matar processos (Linux/Docker)
      const commands = sessionPattern
        ? [
            `pkill -9 -f "user-data-dir.*${sessionPattern}.*/browser-data" 2>/dev/null || true`,
            `pkill -9 -f "${sessionPattern}.*/browser-data" 2>/dev/null || true`,
            `pkill -9 -f "${sessionPattern}" 2>/dev/null || true`,
          ]
        : [
            'pkill -9 -f "chromium" 2>/dev/null || true',
            'pkill -9 -f "chrome" 2>/dev/null || true',
            'pkill -9 -f "puppeteer" 2>/dev/null || true',
            'pkill -9 -f "headless" 2>/dev/null || true',
            'killall -9 chromium chromium-browser chrome google-chrome 2>/dev/null || true',
            // Mata por padrão de diretório do userDataDir
            'pkill -9 -f "user-data-dir.*tokens" 2>/dev/null || true',
            'pkill -9 -f "browser-data" 2>/dev/null || true',
          ]

      for (const cmd of commands) {
        try {
          execSync(cmd, { stdio: 'pipe', timeout: 5000 })
        } catch (e) {
          // Ignora erros individuais
        }
      }

      console.log(
        sessionName
          ? `🧹 Processos Chromium da sessão ${sessionName} encerrados`
          : '🧹 Processos Chromium órfãos encerrados',
      )
      // Aguarda um pouco para garantir que foram encerrados
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (e) {
      // Ignora erros - pode não haver processos para matar
      console.warn('⚠️ Não foi possível verificar processos Chromium')
    }
  }

  /**
   * Configura handlers de eventos para uma instância
   */
  private setupInstanceHandlers(
    sessionName: string,
    client: wpp.Whatsapp,
    config: IWhatsAppInstance,
  ): void {
    client.onStateChange(async (state) => {
      console.log(`📱 [${config.name}] Estado: ${state}`)

      const data = this.instances.get(sessionName)

      switch (state) {
        case 'CONNECTED':
          try {
            const hostDevice = await client.getHostDevice()
            const phoneNumber =
              (hostDevice as any)?.wid?.user ||
              (hostDevice as any)?.phone?.device

            if (data) data.wasConnected = true

            if (phoneNumber) {
              const persistedNumber = await this.updateInstanceInfo(
                sessionName,
                client,
                hostDevice,
              )
              await this.persistInstanceSession(
                sessionName,
                client,
                persistedNumber || phoneNumber,
              )
              this.emit('connected', { sessionName })
              console.log(`✅ [${config.name}] Autenticado com sucesso!`)
            } else {
              // Mesmo sem phoneNumber, persiste a sessão
              console.log(
                `📱 [${config.name}] Browser conectado, persistindo sessão...`,
              )
              await this.persistInstanceSession(sessionName, client)
              await whatsappInstanceRepository.updateStatus(
                sessionName,
                'connected',
              )
              this.emit('connected', { sessionName })
            }
          } catch (e) {
            // Mesmo com erro, tenta persistir
            console.log(
              `📱 [${config.name}] Browser conectado, tentando persistir...`,
            )
            try {
              if (data) data.wasConnected = true
              await this.persistInstanceSession(sessionName, client)
              await whatsappInstanceRepository.updateStatus(
                sessionName,
                'connected',
              )
            } catch (persistError) {
              console.warn(
                `⚠️ [${config.name}] Falha ao persistir:`,
                persistError,
              )
            }
          }
          break

        case 'UNPAIRED':
          if (data?.wasConnected) {
            await whatsappInstanceRepository.updateStatus(
              sessionName,
              'disconnected',
            )
            this.emit('disconnected', { sessionName })
          }
          break
      }
    })

    client.onMessage(async (message) => {
      try {
        if (this.shouldIgnoreMessage(message)) {
          return
        }

        const processedMessage = await this.processIncomingMessage(
          client,
          message,
        )

        this.emit('message', {
          sessionName,
          instanceName: config.name,
          message: processedMessage,
        })
      } catch (error) {
        console.error(`[${config.name}] Erro ao processar mensagem:`, error)
      }
    })

    // === Event listeners para funcionalidades avançadas ===

    // Reações a mensagens
    try {
      ;(client as any).onReactionMessage((data: any) => {
        this.emit('messageReaction', { sessionName, ...data })
      })
    } catch (e) {
      console.warn(`⚠️ [${config.name}] onReactionMessage não disponível`)
    }

    // Edição de mensagens
    try {
      ;(client as any).onMessageEdit((chat: any, id: any, msg: any) => {
        this.emit('messageEdit', { sessionName, chat, messageId: id, message: msg })
      })
    } catch (e) {
      console.warn(`⚠️ [${config.name}] onMessageEdit não disponível`)
    }

    // Exclusão de mensagens (revogar)
    try {
      ;(client as any).onRevokedMessage((data: any) => {
        this.emit('messageRevoked', { sessionName, ...data })
      })
    } catch (e) {
      console.warn(`⚠️ [${config.name}] onRevokedMessage não disponível`)
    }

    // Respostas de enquetes
    try {
      ;(client as any).onPollResponse((data: any) => {
        this.emit('pollResponse', { sessionName, ...data })
      })
    } catch (e) {
      console.warn(`⚠️ [${config.name}] onPollResponse não disponível`)
    }

    // Status de entrega/leitura (ACK)
    try {
      client.onAck((ack: any) => {
        this.emit('messageAck', { sessionName, ...ack })
      })
    } catch (e) {
      console.warn(`⚠️ [${config.name}] onAck não disponível`)
    }

    // Chamadas recebidas
    try {
      ;(client as any).onIncomingCall((call: any) => {
        this.emit('incomingCall', { sessionName, ...call })
      })
    } catch (e) {
      console.warn(`⚠️ [${config.name}] onIncomingCall não disponível`)
    }

    // Mudanças de presença (online/offline/digitando)
    try {
      ;(client as any).onPresenceChanged((data: any) => {
        this.emit('presenceChanged', { sessionName, ...data })
      })
    } catch (e) {
      console.warn(`⚠️ [${config.name}] onPresenceChanged não disponível`)
    }

    // Mudanças de participantes em grupos
    try {
      ;(client as any).onParticipantsChanged((data: any) => {
        this.emit('participantsChanged', { sessionName, ...data })
      })
    } catch (e) {
      console.warn(`⚠️ [${config.name}] onParticipantsChanged não disponível`)
    }

    // Atualizações de labels
    try {
      ;(client as any).onUpdateLabel((data: any) => {
        this.emit('labelUpdate', { sessionName, ...data })
      })
    } catch (e) {
      console.warn(`⚠️ [${config.name}] onUpdateLabel não disponível`)
    }
  }

  /**
   * Atualiza informações da instância após conexão
   */
  private async updateInstanceInfo(
    sessionName: string,
    client: wpp.Whatsapp,
    hostDevice?: any,
  ): Promise<string | undefined> {
    try {
      const device = hostDevice || (await client.getHostDevice())
      if (!device) return undefined

      const phoneNumber =
        (device as any).wid?.user || (device as any).phone?.device
      const profileName = (device as any).pushname

      await whatsappInstanceRepository.updateStatus(sessionName, 'connected', {
        phoneNumber,
        profileName,
      })

      return phoneNumber
    } catch (error) {
      console.error('Erro ao obter informações do dispositivo:', error)
      return undefined
    }
  }

  private async persistInstanceSession(
    sessionName: string,
    client: wpp.Whatsapp,
    phoneNumber?: string,
    retryCount: number = 0,
  ): Promise<void> {
    if (!sessionName) return

    const MAX_RETRIES = 3
    console.log(
      `💾 [${sessionName}] persistInstanceSession (phone=${phoneNumber}, tentativa=${retryCount + 1})`,
    )

    try {
      if (typeof client.getSessionTokenBrowser !== 'function') {
        console.log(`💾 [${sessionName}] getSessionTokenBrowser não disponível`)
        if (phoneNumber) {
          await whatsappSessionRepository.updatePhoneNumber(
            sessionName,
            phoneNumber,
          )
        }
        return
      }

      const token = await client.getSessionTokenBrowser(true)
      console.log(
        `💾 [${sessionName}] getSessionTokenBrowser result: ${token ? 'TOKEN_OK' : 'NO_TOKEN'}`,
      )

      if (token) {
        const result = await whatsappSessionRepository.upsertToken(
          sessionName,
          token,
          phoneNumber,
        )
        console.log(
          `💾 [${sessionName}] Token salvo no banco: ${result ? 'SUCESSO' : 'FALHA'}`,
        )
      } else if (retryCount < MAX_RETRIES) {
        // Se não obteve token, aguarda e tenta novamente
        console.log(
          `💾 [${sessionName}] Token não disponível, tentando novamente em 2s...`,
        )
        await new Promise((resolve) => setTimeout(resolve, 2000))
        return this.persistInstanceSession(
          sessionName,
          client,
          phoneNumber,
          retryCount + 1,
        )
      } else if (phoneNumber) {
        console.log(
          `💾 [${sessionName}] Salvando apenas phoneNumber após ${MAX_RETRIES} tentativas`,
        )
        await whatsappSessionRepository.updatePhoneNumber(
          sessionName,
          phoneNumber,
        )
      }
    } catch (error) {
      console.warn(`⚠️ [${sessionName}] Falha ao persistir sessão:`, error)
      if (retryCount < MAX_RETRIES) {
        console.log(`💾 [${sessionName}] Tentando novamente em 2s...`)
        await new Promise((resolve) => setTimeout(resolve, 2000))
        return this.persistInstanceSession(
          sessionName,
          client,
          phoneNumber,
          retryCount + 1,
        )
      }
    }
  }

  /**
   * Desconecta uma instância
   */
  public async disconnectInstance(sessionName: string): Promise<void> {
    const data = this.instances.get(sessionName)

    // Mesmo sem client, tenta limpar os locks
    await this.cleanupStaleLocks(sessionName)

    if (!data) return

    try {
      if (data.client) {
        // Tenta fechar o cliente graciosamente
        try {
          await data.client.close()
        } catch (closeError) {
          console.warn(`⚠️ Erro ao fechar cliente: ${closeError}`)
        }
      }

      data.client = null
      data.wasConnected = false
      data.qrCode = null
      data.isConnecting = false
      this.instances.set(sessionName, data)

      await whatsappInstanceRepository.updateStatus(sessionName, 'disconnected')
      console.log(`🔌 Instância ${data.config.name} desconectada`)

      // Pequeno delay para garantir que o browser fechou
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (error) {
      console.error('Erro ao desconectar:', error)
      // Mesmo com erro, marca como desconectado
      if (data) {
        data.client = null
        data.isConnecting = false
      }
    }
  }

  /**
   * Remove uma instância
   */
  public async deleteInstance(id: string): Promise<boolean> {
    const instance = await whatsappInstanceRepository.findById(id)
    if (!instance) return false

    // Desconecta se estiver conectada
    await this.disconnectInstance(instance.sessionName)

    // Remove do mapa
    this.instances.delete(instance.sessionName)

    // Remove sessão armazenada
    await whatsappSessionRepository.removeToken(instance.sessionName)

    // Remove do banco
    return whatsappInstanceRepository.deleteInstance(id)
  }

  /**
   * Lista todas as instâncias com status
   */
  public async listInstances(): Promise<InstanceInfo[]> {
    const dbInstances = await whatsappInstanceRepository.findAll()

    return dbInstances.map((inst) => {
      const data = this.instances.get(inst.sessionName)
      const isMetaOfficial = inst.connectionType === 'meta_official'
      const isMetaConfigured =
        isMetaOfficial &&
        !!inst.metaConfig?.enabled &&
        !!inst.metaConfig?.accessToken &&
        (!!inst.metaConfig?.phoneNumberId || !!inst.metaConfig?.instagramAccountId)

      // Determina o status real baseado na autenticação
      let status: InstanceStatus = inst.status
      if (isMetaConfigured) {
        status = 'connected'
      } else if (data) {
        if (data.wasConnected && data.client) {
          status = 'connected'
        } else if (data.qrCode) {
          status = 'qrcode'
        } else if (data.isConnecting) {
          status = 'connecting'
        }
      }

      return {
        id: inst._id!.toString(),
        name: inst.name,
        sessionName: inst.sessionName,
        connectionType: inst.connectionType || 'wppconnect',
        status,
        connected: isMetaConfigured
          ? true
          : !!(
              data?.wasConnected &&
              data?.client !== null &&
              data?.client !== undefined
            ),
        authenticated: isMetaConfigured ? true : data?.wasConnected || false,
        qrCode: isMetaOfficial ? null : this.getQrCode(inst.sessionName),
        phoneNumber: inst.phoneNumber,
        profileName: inst.profileName,
        isDefault: inst.isDefault,
        botEnabled: inst.botEnabled ?? true,
        botId: inst.botId ?? null,
        automaticMessages: inst.automaticMessages,
        metaConfig: inst.metaConfig,
        fairDistributionEnabled: inst.fairDistributionEnabled ?? false,
        departmentIds: inst.departmentIds,
      }
    })
  }

  /**
   * Obtém informações de uma instância específica
   */
  public async getInstanceInfo(
    sessionName: string,
  ): Promise<InstanceInfo | null> {
    const inst = await whatsappInstanceRepository.findBySessionName(sessionName)
    if (!inst) return null

    const data = this.instances.get(sessionName)
    const isMetaOfficial = inst.connectionType === 'meta_official'
    const isMetaConfigured =
      isMetaOfficial &&
      !!inst.metaConfig?.enabled &&
      !!inst.metaConfig?.accessToken &&
      (!!inst.metaConfig?.phoneNumberId || !!inst.metaConfig?.instagramAccountId)

    // Determina o status real baseado na autenticação
    let status: InstanceStatus = inst.status
    if (isMetaConfigured) {
      status = 'connected'
    } else if (data) {
      if (data.wasConnected && data.client) {
        status = 'connected'
      } else if (data.qrCode) {
        status = 'qrcode'
      } else if (data.isConnecting) {
        status = 'connecting'
      }
    }

    return {
      id: inst._id!.toString(),
      name: inst.name,
      sessionName: inst.sessionName,
      connectionType: inst.connectionType || 'wppconnect',
      status,
      connected: isMetaConfigured
        ? true
        : !!(
            data?.wasConnected &&
            data?.client !== null &&
            data?.client !== undefined
          ),
      authenticated: isMetaConfigured ? true : data?.wasConnected || false,
      qrCode: isMetaOfficial ? null : this.getQrCode(sessionName),
      phoneNumber: inst.phoneNumber,
      profileName: inst.profileName,
      isDefault: inst.isDefault,
      botEnabled: inst.botEnabled ?? true,
      botId: inst.botId ?? null,
      automaticMessages: inst.automaticMessages,
      metaConfig: inst.metaConfig,
    }
  }

  /**
   * Retorna QR Code de uma instância
   */
  public getQrCode(sessionName: string): string | null {
    console.log(`🔍 getQrCode chamado para: ${sessionName}`)
    console.log(
      `🔍 Instancias no Map: ${Array.from(this.instances.keys()).join(', ')}`,
    )

    const data = this.instances.get(sessionName)
    if (!data) {
      console.log(`🔍 Instancia ${sessionName} não encontrada no Map`)
      return null
    }

    if (!data.qrCode) {
      console.log(
        `🔍 Instancia ${sessionName} não tem QR Code (isConnecting: ${data.isConnecting})`,
      )
      return null
    }

    // Expira após 120 segundos (2 minutos)
    const age = Date.now() - data.qrCodeTimestamp
    if (age > 120000) {
      console.log(`🔍 QR Code expirado (${age}ms)`)
      data.qrCode = null
      return null
    }

    console.log(`🔍 QR Code encontrado para ${sessionName} (idade: ${age}ms)`)
    return data.qrCode
  }

  /**
   * Obtém cliente de uma instância
   */
  public getClient(sessionName: string): wpp.Whatsapp | null {
    return this.instances.get(sessionName)?.client || null
  }

  /**
   * Obtém cliente da instância padrão
   */
  public async getDefaultClient(): Promise<wpp.Whatsapp | null> {
    const defaultInstance = await whatsappInstanceRepository.findDefault()
    if (!defaultInstance) return null
    return this.getClient(defaultInstance.sessionName)
  }

  /**
   * Envia mensagem por uma instância específica ou pela padrão
   */
  public async sendMessage(
    to: string,
    message: string,
    sessionName?: string,
  ): Promise<any> {
    let client: wpp.Whatsapp | null

    if (sessionName) {
      client = this.getClient(sessionName)
    } else {
      client = await this.getDefaultClient()
    }

    if (!client) {
      throw new Error('Nenhuma instância WhatsApp disponível')
    }

    const formattedNumber = this.formatRecipient(to)
    return client.sendText(formattedNumber, message)
  }

  /**
   * Define instância como padrão
   */
  public async setDefault(id: string): Promise<boolean> {
    return whatsappInstanceRepository.setDefault(id)
  }

  private shouldIgnoreMessage(message: any): boolean {
    const ignoreTypes = [
      'gp2',
      'ciphertext',
      'e2e_notification',
      'notification',
      'notification_template',
      'protocol',
      'broadcast_notification',
      'group_notification',
    ]

    return (
      message.isGroupMsg ||
      message.from === 'status@broadcast' ||
      ignoreTypes.includes(message.type)
    )
  }

  private async processIncomingMessage(
    client: wpp.Whatsapp,
    message: any,
  ): Promise<IncomingMessage> {
    const messageType = await this.getMessageType(message)
    const resolvedFrom = await this.resolveFromIdentifier(client, message.from)
    const identifier = this.normalizePhoneNumber(
      resolvedFrom.replace('@c.us', ''),
    )

    let mediaData = null
    if (MediaProcessor.isMediaType(message.type)) {
      mediaData = await MediaProcessor.processWhatsAppMedia(message, client)
    }

    return {
      identifier,
      message: messageType.message,
      idMessage: messageType.idMessage,
      quotedMsg: messageType.quotedMsg,
      name: message.notifyName,
      provider: 'whatsapp',
      identifierProvider: messageType.identifierProvider,
      type: messageType.type,
      photo: await this.getProfilePicture(client, resolvedFrom),
      mediaUrl: mediaData?.mediaUrl,
      mediaStorage: mediaData?.mediaStorage,
    }
  }

  private async resolveFromIdentifier(
    client: wpp.Whatsapp,
    rawFrom: string,
  ): Promise<string> {
    if (!rawFrom.endsWith('@lid')) {
      return rawFrom
    }

    if (!(client as any).getPnLidEntry) {
      return rawFrom
    }

    try {
      const mapping = await (client as any).getPnLidEntry(rawFrom)
      const phoneSerialized = mapping?.phoneNumber?._serialized
      if (phoneSerialized) {
        return phoneSerialized
      }
    } catch (error) {
      console.warn('Falha ao mapear LID para telefone:', error)
    }

    return rawFrom
  }

  private async getMessageType(message: any): Promise<any> {
    const result = {
      message: '',
      type: message.type,
      idMessage: message.id,
      quotedMsg: undefined as string | undefined,
      identifierProvider: message.from,
    }

    switch (message.type) {
      case 'chat':
        result.message = message.body
        break

      case 'list_response':
        if (message.listResponse && message.listResponse.singleSelectReply) {
          result.message = message.listResponse.singleSelectReply.selectedRowId
          result.type = 'interactive'
        } else {
          result.message = message.body || ''
        }
        break

      case 'buttons_response':
        if (message.selectedButtonId) {
          result.message = message.selectedButtonId
          result.type = 'interactive'
        } else {
          result.message = message.body || ''
        }
        break

      case 'image':
      case 'video':
      case 'audio':
      case 'ptt':
      case 'document':
        result.message = message.caption || ''
        break

      default:
        result.message = message.body || ''
    }

    if (message.quotedMsg) {
      result.quotedMsg = message.quotedMsg.id
    }

    return result
  }

  private normalizePhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.startsWith('55') && cleaned.length === 12) {
      return `55${cleaned.charAt(2)}9${cleaned.substring(3)}`
    }
    return cleaned
  }

  private async getProfilePicture(
    client: wpp.Whatsapp,
    contactId: string,
  ): Promise<string | undefined> {
    try {
      const profilePic = await client.getProfilePicFromServer(contactId)
      return profilePic || undefined
    } catch (error) {
      return undefined
    }
  }

  private formatRecipient(to: string): string {
    const cleaned = to.replace(/\D/g, '')
    if (cleaned.startsWith('55') && cleaned.length === 12) {
      return `55${cleaned.charAt(2)}9${cleaned.substring(3)}@c.us`
    }
    return `${cleaned}@c.us`
  }
}

export default WhatsAppMultiManager.getInstance()
