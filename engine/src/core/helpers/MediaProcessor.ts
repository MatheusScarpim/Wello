import type { Whatsapp } from '@wppconnect-team/wppconnect'
import axios from 'axios'

import { azureStorageService } from '@/services/AzureStorageService'

import WhatsAppManager from '../whatsapp/WhatsAppManager'

/**
 * Helper para processar mídias recebidas do WhatsApp e Meta
 * Faz download e upload automático para Azure Blob Storage
 */
export class MediaProcessor {
  private static isAzureDisabled(): boolean {
    const explicitlyDisabled =
      process.env.AZURE_STORAGE_DISABLED === 'true' ||
      process.env.DISABLE_AZURE_STORAGE === 'true'
    return explicitlyDisabled || !azureStorageService.isInitialized()
  }

  /**
   * Processa mídia recebida do WhatsApp (wppconnect)
   * Baixa a mídia e faz upload para o Azure
   * @param message - Mensagem do WhatsApp com mídia
   * @param client - Cliente WhatsApp (opcional, usa singleton se não fornecido)
   */
  static async processWhatsAppMedia(
    message: any,
    client?: Whatsapp | null,
  ): Promise<{
    mediaUrl?: string
    mediaStorage?: {
      provider: 'azure_blob'
      blobName: string
      container: string
      size: number
      originalUrl?: string
    }
  } | null> {
    try {
      const mediaTypes = [
        'image',
        'video',
        'audio',
        'ptt',
        'document',
        'sticker',
      ]

      if (!mediaTypes.includes(message.type)) {
        return null
      }

      console.log(`📥 Processando mídia do WhatsApp (${message.type})...`)

      // Usa o cliente fornecido ou tenta obter do singleton (modo single-instance)
      const whatsappClient = client || WhatsAppManager.getClient()

      if (!whatsappClient) {
        console.warn('⚠️ Cliente WhatsApp não está disponível')
        return null
      }

      const mediaData = await whatsappClient.downloadMedia(message)

      if (!mediaData) {
        console.warn('⚠️ Não foi possível baixar a mídia do WhatsApp')
        return null
      }

      // mediaData já é uma string base64 diretamente
      // Garante que tem o prefixo data URI
      const base64Data =
        typeof mediaData === 'string' && mediaData.includes('base64,')
          ? mediaData
          : `data:image/jpeg;base64,${mediaData}`

      // Detecta o tipo de conteúdo baseado no tipo da mensagem
      const contentTypeMap: Record<string, string> = {
        image: 'image/jpeg',
        video: 'video/mp4',
        audio: 'audio/ogg',
        ptt: 'audio/ogg',
        document: 'application/pdf',
        sticker: 'image/webp',
      }

      const contentType =
        contentTypeMap[message.type] || 'application/octet-stream'

      // Sanitiza metadados para evitar caracteres inválidos em headers HTTP
      const sanitizeMetadata = (value: string): string => {
        if (!value) return ''
        // Remove quebras de linha, tabs e caracteres não-ASCII
        return value
          .replace(/[\r\n\t]/g, ' ')
          .replace(/[^\x20-\x7E]/g, '') // Remove caracteres não imprimíveis
          .substring(0, 256) // Limita tamanho
      }

      if (this.isAzureDisabled()) {
        // Não envia para Azure; devolve base64 inline para ser usado diretamente pelo bot
        const base64Content = base64Data.replace(/^data:[^;]+;base64,/, '')
        const size = Buffer.from(base64Content, 'base64').length
        console.warn(
          '⚠️ Azure desabilitado - retornando mídia em base64 inline',
        )
        return {
          mediaUrl: base64Data,
          mediaStorage: {
            provider: 'inline_base64',
            blobName: '',
            container: '',
            size,
            originalUrl: '',
          },
        }
      }

      // Faz upload para o Azure
      const uploadResult = await azureStorageService.uploadBase64(base64Data, {
        fileName: message.filename || `whatsapp-${message.type}-${Date.now()}`,
        contentType,
        metadata: {
          source: 'whatsapp',
          messageId: sanitizeMetadata(message.id || ''),
          type: sanitizeMetadata(message.type || ''),
          from: sanitizeMetadata(message.from || ''),
          caption: sanitizeMetadata(message.caption || ''),
        },
      })

      console.log(`✅ Mídia do WhatsApp salva no Azure: ${uploadResult.url}`)

      return {
        mediaUrl: uploadResult.url,
        mediaStorage: {
          provider: 'azure_blob',
          blobName: uploadResult.blobName,
          container: uploadResult.container,
          size: uploadResult.size,
        },
      }
    } catch (error: any) {
      console.error('❌ Erro ao processar mídia do WhatsApp:', error)

      // Se falhar, retorna null para não bloquear o processamento da mensagem
      return null
    }
  }

  /**
   * Processa mídia recebida da Meta (webhook)
   * Baixa a mídia da URL da Meta e faz upload para o Azure
   */
  static async processMetaMedia(
    mediaUrl: string,
    mediaType: string,
    accessToken: string,
    metadata?: Record<string, string>,
  ): Promise<{
    mediaUrl?: string
    mediaStorage?: {
      provider: 'azure_blob'
      blobName: string
      container: string
      size: number
      originalUrl: string
    }
  } | null> {
    try {
      if (this.isAzureDisabled()) {
        console.warn(
          '⚠️ Azure desabilitado - ignorando upload de mídia da Meta',
        )
        return null
      }

      console.log(`📥 Processando mídia da Meta (${mediaType})...`)

      // Baixa a mídia da Meta usando o access token
      const response = await axios.get(mediaUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        responseType: 'arraybuffer',
      })

      if (!response.data) {
        console.warn('⚠️ Não foi possível baixar a mídia da Meta')
        return null
      }

      // Converte para buffer
      const buffer = Buffer.from(response.data)
      const contentType =
        response.headers['content-type'] || 'application/octet-stream'

      // Sanitiza metadados
      const sanitizeMetadata = (value: string): string => {
        if (!value) return ''
        return value
          .replace(/[\r\n\t]/g, ' ')
          .replace(/[^\x20-\x7E]/g, '')
          .substring(0, 256)
      }

      // Sanitiza todos os metadados
      const sanitizedMetadata: Record<string, string> = {}
      if (metadata) {
        for (const [key, value] of Object.entries(metadata)) {
          sanitizedMetadata[key] = sanitizeMetadata(value)
        }
      }

      // Faz upload para o Azure
      const uploadResult = await azureStorageService.uploadBuffer(buffer, {
        fileName: `meta-${mediaType}-${Date.now()}`,
        contentType,
        metadata: {
          source: 'meta',
          type: sanitizeMetadata(mediaType),
          originalUrl: sanitizeMetadata(mediaUrl),
          ...sanitizedMetadata,
        },
      })

      console.log(`✅ Mídia da Meta salva no Azure: ${uploadResult.url}`)

      return {
        mediaUrl: uploadResult.url,
        mediaStorage: {
          provider: 'azure_blob',
          blobName: uploadResult.blobName,
          container: uploadResult.container,
          size: uploadResult.size,
          originalUrl: mediaUrl,
        },
      }
    } catch (error: any) {
      console.error('❌ Erro ao processar mídia da Meta:', error)

      // Se falhar, retorna null para não bloquear o processamento da mensagem
      return null
    }
  }

  /**
   * Processa foto de perfil (URL)
   * Baixa a foto e faz upload para o Azure
   */
  static async processProfilePhoto(
    photoUrl: string,
    identifier: string,
  ): Promise<string | null> {
    try {
      if (this.isAzureDisabled()) {
        console.warn(
          '⚠️ Azure desabilitado - ignorando upload de foto de perfil',
        )
        return null
      }

      if (!photoUrl || photoUrl === 'undefined') {
        return null
      }

      console.log(`📸 Processando foto de perfil para ${identifier}...`)

      // Baixa a foto
      const response = await axios.get(photoUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
      })

      if (!response.data) {
        console.warn('⚠️ Não foi possível baixar a foto de perfil')
        return null
      }

      // Converte para buffer
      const buffer = Buffer.from(response.data)
      const contentType = response.headers['content-type'] || 'image/jpeg'

      // Sanitiza o identifier para usar no nome do arquivo
      const sanitizedIdentifier = identifier.replace(/[^a-zA-Z0-9]/g, '')

      // Faz upload para o Azure
      const uploadResult = await azureStorageService.uploadBuffer(buffer, {
        fileName: `profile-${sanitizedIdentifier}-${Date.now()}.jpg`,
        contentType,
        metadata: {
          source: 'profile',
          identifier: sanitizedIdentifier,
          type: 'profile-photo',
        },
      })

      console.log(`✅ Foto de perfil salva no Azure: ${uploadResult.url}`)

      return uploadResult.url
    } catch (error: any) {
      console.error('❌ Erro ao processar foto de perfil:', error.message)
      // Retorna null para não bloquear - usa a URL original
      return null
    }
  }

  /**
   * Verifica se o tipo de mensagem contém mídia
   */
  static isMediaType(type: string): boolean {
    const mediaTypes = ['image', 'video', 'audio', 'ptt', 'document', 'sticker']
    return mediaTypes.includes(type)
  }

  /**
   * Extrai o tipo de mídia da Meta baseado no payload
   */
  static getMetaMediaType(message: any): string | null {
    if (message.image) return 'image'
    if (message.video) return 'video'
    if (message.audio) return 'audio'
    if (message.document) return 'document'
    if (message.sticker) return 'sticker'
    return null
  }

  /**
   * Extrai a URL da mídia da Meta baseado no payload
   */
  static getMetaMediaUrl(message: any, mediaType: string): string | null {
    const mediaObject = message[mediaType]
    return mediaObject?.url || mediaObject?.link || null
  }
}

export default MediaProcessor
