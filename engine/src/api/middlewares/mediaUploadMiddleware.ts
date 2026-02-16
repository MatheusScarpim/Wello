import { randomBytes } from 'crypto'
import { NextFunction, Request, Response } from 'express'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { azureStorageService } from '../../services/AzureStorageService'

// Tipos de áudio que precisam ser convertidos para ogg (WhatsApp)
const AUDIO_TYPES_TO_CONVERT = [
  'audio/webm',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/aac',
  'audio/mpeg',
]

/**
 * Verifica se o content-type precisa ser convertido
 */
function needsAudioConversion(contentType: string): boolean {
  const lowerType = contentType.toLowerCase().split(';')[0].trim() // Remove codecs
  return AUDIO_TYPES_TO_CONVERT.some(
    (t) => lowerType === t || lowerType.startsWith(t),
  )
}

/**
 * Converte áudio para formato MP4/AAC usando ffmpeg
 */
async function convertAudioToMp4(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat('mp4')
      .audioCodec('aac')
      .audioBitrate('128k')
      .audioChannels(1)
      .audioFrequency(44100)
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err))
      .save(outputPath)
  })
}

/**
 * Converte base64 de áudio para MP4/AAC
 * Converte apenas formatos que precisam (webm, ogg)
 */
async function convertAudioBase64ToMp4(
  base64Data: string,
  contentType: string,
): Promise<{ base64: string; contentType: string; extension: string } | null> {
  const lowerType = contentType.toLowerCase().split(';')[0].trim()

  // Se já for MP4/M4A, não precisa converter
  if (
    lowerType === 'audio/mp4' ||
    lowerType === 'audio/m4a' ||
    lowerType === 'audio/aac'
  ) {
    console.log(`✅ Áudio já está em formato MP4/AAC, não precisa conversão`)
    return null
  }

  console.log(`🔄 Convertendo áudio ${contentType} para mp4/aac...`)

  const tempId = randomBytes(6).toString('hex')
  // Usa extensão genérica .bin para ffmpeg auto-detectar o formato
  const inputPath = path.join(os.tmpdir(), `scarlat-input-${tempId}.bin`)
  const outputPath = path.join(os.tmpdir(), `scarlat-output-${tempId}.mp4`)

  try {
    // Remove prefixo data:xxx;base64, se existir (inclui possíveis parâmetros como codecs)
    // Formato pode ser: data:audio/webm;codecs=opus;base64,... ou data:audio/webm;base64,...
    const rawBase64 = base64Data.replace(/^data:[^;]+(?:;[^;]+)*;base64,/, '')
    const audioBuffer = Buffer.from(rawBase64, 'base64')
    console.log(`📁 Tamanho do áudio de entrada: ${audioBuffer.length} bytes`)

    if (audioBuffer.length < 100) {
      console.error(
        `❌ Arquivo de áudio muito pequeno (${audioBuffer.length} bytes), provavelmente corrompido`,
      )
      return null
    }

    await fs.writeFile(inputPath, audioBuffer)

    console.log(
      `🔄 Executando ffmpeg para converter ${contentType} para mp4...`,
    )
    await convertAudioToMp4(inputPath, outputPath)

    const convertedBuffer = await fs.readFile(outputPath)
    const convertedBase64 = `data:audio/mp4;base64,${convertedBuffer.toString('base64')}`

    console.log(`✅ Áudio convertido para mp4 com sucesso`)

    return {
      base64: convertedBase64,
      contentType: 'audio/mp4',
      extension: 'mp4',
    }
  } catch (error) {
    console.error('❌ Erro ao converter áudio para mp4:', error)
    return null
  } finally {
    // Limpar arquivos temporários
    try {
      await fs.unlink(inputPath)
    } catch {
      /* ignore */
    }
    try {
      await fs.unlink(outputPath)
    } catch {
      /* ignore */
    }
  }
}

/**
 * Middleware para processar uploads de mídia automaticamente
 *
 * Se a requisição contém mediaBase64 ou mediaUrl, faz upload para Azure Blob Storage
 * e substitui com a URL pública do blob.
 */
export async function mediaUploadMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Se storage não está pronto, apenas segue sem tentar upload
    const incomingBase64 = req.body.mediaBase64
    const inlineFallback = () => {
      if (!incomingBase64) return

      const sanitizedBase64 = incomingBase64.replace(/^data:[^;]+;base64,/, '')
      req.body.mediaUrl = incomingBase64
      req.body.mediaStorage = {
        provider: 'inline_base64',
        size: Buffer.from(sanitizedBase64, 'base64').length,
        blobName: '',
        container: '',
        originalUrl: '',
      }
      delete req.body.mediaBase64
      delete req.body.mediaBase64
    }

    if (!azureStorageService.isInitialized()) {
      inlineFallback()
      return next()
    }

    const { mediaBase64, mediaUrl, type, filename, caption } = req.body

    // Se não há mídia, continua normalmente
    if (!mediaBase64 && !mediaUrl) {
      return next()
    }

    // Verifica se tipo requer mídia
    const mediaTypes = ['image', 'video', 'audio', 'document', 'sticker']
    if (!mediaTypes.includes(type)) {
      return next()
    }

    console.log(`📤 Processando upload de mídia (${type})...`)

    let uploadResult

    // Upload de base64
    if (mediaBase64) {
      // Detecta o content type do base64 (formato: data:TYPE;base64, ou data:TYPE;codecs=xxx;base64,)
      const contentTypeMatch = mediaBase64.match(/^data:([^;,]+)/)
      let contentType = contentTypeMatch
        ? contentTypeMatch[1]
        : getContentTypeFromType(type)

      let finalBase64 = mediaBase64
      let finalFilename =
        filename || `media-${Date.now()}.${getExtensionFromType(type)}`

      // Se for áudio, converte para MP4/AAC se necessário
      if (type === 'audio') {
        console.log(`🎵 Áudio detectado - Content-Type: ${contentType}`)

        const converted = await convertAudioBase64ToMp4(
          mediaBase64,
          contentType,
        )
        if (converted) {
          finalBase64 = converted.base64
          contentType = converted.contentType
        }

        // Garante extensão correta baseada no content-type
        const audioExtMap: Record<string, string> = {
          'audio/mp4': '.mp4',
          'audio/m4a': '.m4a',
          'audio/aac': '.aac',
          'audio/ogg': '.ogg',
          'audio/webm': '.webm',
          'audio/mpeg': '.mp3',
        }
        const baseType = contentType.split(';')[0].trim().toLowerCase()
        const correctExt = audioExtMap[baseType] || '.mp4'
        finalFilename =
          finalFilename.replace(/\.(ogg|webm|m4a|mp4|mp3|wav|aac)$/i, '') +
          correctExt
        console.log(`🎵 Filename ajustado para: ${finalFilename}`)
      }

      uploadResult = await azureStorageService.uploadBase64(finalBase64, {
        fileName: finalFilename,
        contentType,
        metadata: {
          type,
          caption: caption || '',
          uploadedAt: new Date().toISOString(),
        },
      })

      console.log(`✅ Base64 uploaded to: ${uploadResult.url}`)

      // Remove o base64 e substitui com a URL
      delete req.body.mediaBase64
      req.body.mediaUrl = uploadResult.url
      // Atualiza o filename no body também
      req.body.filename = finalFilename
    }
    // Upload de URL externa
    else if (mediaUrl && !mediaUrl.startsWith('blob.core.windows.net')) {
      // Só faz upload se não for já uma URL do Azure
      const contentType = getContentTypeFromType(type)

      uploadResult = await azureStorageService.uploadFromUrl(mediaUrl, {
        fileName:
          filename || `media-${Date.now()}.${getExtensionFromType(type)}`,
        contentType,
        metadata: {
          type,
          caption: caption || '',
          originalUrl: mediaUrl,
          uploadedAt: new Date().toISOString(),
        },
      })

      console.log(`✅ URL uploaded to: ${uploadResult.url}`)

      // Substitui com a URL do Azure
      req.body.mediaUrl = uploadResult.url
    }

    // Adiciona informações do upload ao body para referência
    if (uploadResult) {
      req.body.mediaStorage = {
        provider: 'azure_blob',
        blobName: uploadResult.blobName,
        container: uploadResult.container,
        size: uploadResult.size,
      }
    }

    next()
  } catch (error: any) {
    console.error('❌ Erro no middleware de upload de mídia:', error)

    // Se o upload falhar, não bloqueia a requisição
    // Mas loga o erro e continua com os dados originais
    console.warn('⚠️ Continuando sem upload de mídia devido ao erro')
    next()
  }
}

/**
 * Helper: retorna o content type baseado no tipo de mensagem
 */
function getContentTypeFromType(type: string): string {
  const contentTypes: Record<string, string> = {
    image: 'image/jpeg',
    video: 'video/mp4',
    audio: 'audio/ogg',
    document: 'application/pdf',
    sticker: 'image/webp',
  }

  return contentTypes[type] || 'application/octet-stream'
}

/**
 * Helper: retorna a extensão baseada no tipo de mensagem
 */
function getExtensionFromType(type: string): string {
  const extensions: Record<string, string> = {
    image: 'jpg',
    video: 'mp4',
    audio: 'ogg',
    document: 'pdf',
    sticker: 'webp',
  }

  return extensions[type] || 'bin'
}
