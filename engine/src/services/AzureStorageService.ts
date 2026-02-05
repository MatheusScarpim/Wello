import {
  BlobServiceClient,
  BlockBlobClient,
  ContainerClient,
} from '@azure/storage-blob'
import crypto from 'crypto'
import path from 'path'
import { Readable } from 'stream'

import {
  StorageConfigDocument,
  StorageConfigRepository,
} from '@/api/repositories/StorageConfigRepository'

export interface UploadResult {
  url: string
  blobName: string
  container: string
  contentType: string
  size: number
}

export interface UploadOptions {
  fileName?: string
  contentType?: string
  metadata?: Record<string, string>
}

export class AzureStorageService {
  private blobServiceClient: BlobServiceClient | null = null
  private containerClient: ContainerClient | null = null
  private config: StorageConfigDocument | null = null
  private repository: StorageConfigRepository
  private initialized: boolean = false

  constructor() {
    this.repository = new StorageConfigRepository()
  }

  /**
   * Inicializa o serviço com as configurações do banco de dados
   */
  async initialize(): Promise<void> {
    try {
      this.initialized = false
      // Busca a configuração ativa
      this.config = await this.repository.findActive()

      if (!this.config) {
        console.warn('Azure Storage não configurado - inicialização ignorada')
        return
      }

      // Cria o cliente usando connection string ou credenciais
      if (this.config.connectionString) {
        this.blobServiceClient = BlobServiceClient.fromConnectionString(
          this.config.connectionString,
        )
      } else {
        const connectionString = `DefaultEndpointsProtocol=https;AccountName=${this.config.accountName};AccountKey=${this.config.accountKey};EndpointSuffix=core.windows.net`
        this.blobServiceClient =
          BlobServiceClient.fromConnectionString(connectionString)
      }

      // Obtém o container client
      this.containerClient = this.blobServiceClient.getContainerClient(
        this.config.containerName,
      )

      // Cria o container se não existir e garante que o acesso a blobs seja público
      await this.containerClient.createIfNotExists()
      await this.containerClient.setAccessPolicy('blob')

      console.log('Azure Storage Service inicializado com sucesso')
      this.initialized = true
    } catch (error) {
      console.error('Erro ao inicializar Azure Storage Service:', error)
      this.initialized = false
      throw error
    }
  }

  /**
   * Verifica se o serviço está inicializado
   */
  private ensureInitialized(): void {
    if (!this.containerClient || !this.config) {
      throw new Error(
        'Azure Storage Service não está inicializado. Chame initialize() primeiro.',
      )
    }
  }

  /**
   * Indica se o storage foi inicializado com sucesso
   */
  public isInitialized(): boolean {
    return this.initialized && !!this.containerClient && !!this.config
  }

  /**
   * Gera um nome único para o blob
   */
  private generateBlobName(originalName?: string): string {
    const timestamp = Date.now()
    const random = crypto.randomBytes(8).toString('hex')
    const extension = originalName ? path.extname(originalName) : ''
    return `${timestamp}-${random}${extension}`
  }

  /**
   * Faz upload de um arquivo a partir de um Buffer
   */
  async uploadBuffer(
    buffer: Buffer,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    this.ensureInitialized()

    const blobName = this.generateBlobName(options.fileName)
    const blockBlobClient = this.containerClient!.getBlockBlobClient(blobName)

    const contentType = options.contentType || 'application/octet-stream'

    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: contentType,
      },
      metadata: options.metadata,
    })

    return {
      url: blockBlobClient.url,
      blobName,
      container: this.config.containerName,
      contentType,
      size: buffer.length,
    }
  }

  /**
   * Faz upload de um arquivo a partir de uma Stream
   */
  async uploadStream(
    stream: Readable,
    size: number,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    this.ensureInitialized()

    const blobName = this.generateBlobName(options.fileName)
    const blockBlobClient = this.containerClient!.getBlockBlobClient(blobName)

    const contentType = options.contentType || 'application/octet-stream'

    await blockBlobClient.uploadStream(stream, size, 5, {
      blobHTTPHeaders: {
        blobContentType: contentType,
      },
      metadata: options.metadata,
    })

    return {
      url: blockBlobClient.url,
      blobName,
      container: this.config.containerName,
      contentType,
      size,
    }
  }

  /**
   * Faz upload de um arquivo a partir de base64
   */
  async uploadBase64(
    base64Data: string,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    // Remove o prefixo data:xxx;base64, se existir (inclui parâmetros como codecs)
    // Formato: data:audio/webm;codecs=opus;base64,... ou data:image/png;base64,...
    const base64Content = base64Data.replace(
      /^data:[^;]+(?:;[^;]+)*;base64,/,
      '',
    )
    const buffer = Buffer.from(base64Content, 'base64')

    return this.uploadBuffer(buffer, options)
  }

  /**
   * Faz upload de um arquivo a partir de uma URL
   */
  async uploadFromUrl(
    url: string,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Falha ao baixar arquivo: ${response.statusText}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType =
      options.contentType ||
      response.headers.get('content-type') ||
      'application/octet-stream'

    return this.uploadBuffer(buffer, { ...options, contentType })
  }

  /**
   * Deleta um blob
   */
  async deleteBlob(blobName: string): Promise<void> {
    this.ensureInitialized()

    const blockBlobClient = this.containerClient!.getBlockBlobClient(blobName)
    await blockBlobClient.deleteIfExists()
  }

  /**
   * Obtém a URL de um blob
   */
  getBlobUrl(blobName: string): string {
    this.ensureInitialized()
    return `${this.containerClient!.url}/${blobName}`
  }

  /**
   * Lista blobs no container
   */
  async listBlobs(prefix?: string): Promise<string[]> {
    this.ensureInitialized()

    const blobs: string[] = []
    for await (const blob of this.containerClient!.listBlobsFlat({ prefix })) {
      blobs.push(blob.name)
    }
    return blobs
  }

  /**
   * Verifica se um blob existe
   */
  async blobExists(blobName: string): Promise<boolean> {
    this.ensureInitialized()

    const blockBlobClient = this.containerClient!.getBlockBlobClient(blobName)
    return blockBlobClient.exists()
  }

  /**
   * Recarrega a configuração do banco de dados
   */
  async reloadConfig(): Promise<void> {
    await this.initialize()
  }
}

// Exporta uma instância singleton
export const azureStorageService = new AzureStorageService()
