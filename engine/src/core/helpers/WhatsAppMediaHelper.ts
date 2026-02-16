import { randomBytes } from 'crypto'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

export interface LocalMediaPayload {
  /** Path that can be safely passed to WPPConnect as a file path. */
  path: string
  /** Cleanup routine that should be awaited after the payload is sent. */
  cleanup: () => Promise<void>
}

// Regex para data URI com possíveis parâmetros extras (ex: codecs=opus)
// Formato: data:audio/webm;codecs=opus;base64,... ou data:image/png;base64,...
const DATA_URI_REGEX = /^data:([^;,]+)(?:;[^;]+)*;base64,(.*)$/i
const BASE64_ONLY_REGEX = /^[A-Za-z0-9+/=\r\n]+$/

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'audio/ogg': '.ogg',
  'audio/mpeg': '.mp3',
  'audio/webm': '.webm',
  'audio/mp4': '.m4a',
  'application/pdf': '.pdf',
}

// Tipos de áudio que precisam ser convertidos para ogg (WhatsApp)
const AUDIO_TYPES_TO_CONVERT = ['audio/webm', 'audio/mp4', 'audio/x-m4a']

const NOOP = async () => {}

/**
 * Converte áudio para formato OGG usando ffmpeg
 */
async function convertAudioToOgg(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat('ogg')
      .audioCodec('libopus')
      .audioBitrate('64k')
      .audioChannels(1)
      .audioFrequency(48000)
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err))
      .save(outputPath)
  })
}

/**
 * Prepara um payload que pode ser consumido pelo WPPConnect.
 * Se o source for um base64/data URL, escreve em um arquivo temporário e retorna o path.
 * Se for áudio em formato não suportado (webm, m4a), converte para ogg.
 */
export async function prepareLocalMediaPayload(
  source: string,
  filename?: string,
): Promise<LocalMediaPayload> {
  if (!isLikelyBase64(source)) {
    return { path: source, cleanup: NOOP }
  }

  const { contentType, base64Data } = parseBase64Media(source)
  const extension =
    path.extname(filename || '') || getExtensionFromMime(contentType) || '.bin'
  const tempFileName = `scarlat-media-${randomBytes(6).toString('hex')}${extension}`
  const tempFilePath = path.join(os.tmpdir(), tempFileName)

  await fs.writeFile(tempFilePath, Buffer.from(base64Data, 'base64'))

  // Verifica se precisa converter áudio para ogg
  const needsConversion = AUDIO_TYPES_TO_CONVERT.includes(
    contentType.toLowerCase(),
  )

  if (needsConversion) {
    const oggFileName = `scarlat-media-${randomBytes(6).toString('hex')}.ogg`
    const oggFilePath = path.join(os.tmpdir(), oggFileName)

    try {
      await convertAudioToOgg(tempFilePath, oggFilePath)

      // Remove o arquivo original e retorna o convertido
      return {
        path: oggFilePath,
        cleanup: async () => {
          try {
            await fs.unlink(tempFilePath)
          } catch {
            // ignore
          }
          try {
            await fs.unlink(oggFilePath)
          } catch {
            // ignore
          }
        },
      }
    } catch (error) {
      console.error('Erro ao converter áudio para ogg:', error)
      // Se falhar a conversão, retorna o arquivo original
    }
  }

  return {
    path: tempFilePath,
    cleanup: async () => {
      try {
        await fs.unlink(tempFilePath)
      } catch {
        // ignore cleanup failures
      }
    },
  }
}

function isLikelyBase64(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return false
  }

  if (DATA_URI_REGEX.test(trimmed)) {
    return true
  }

  return BASE64_ONLY_REGEX.test(trimmed)
}

function parseBase64Media(source: string): {
  contentType: string
  base64Data: string
} {
  const trimmed = source.trim()
  const dataUriMatch = trimmed.match(DATA_URI_REGEX)

  if (dataUriMatch) {
    const [, contentType, rawData] = dataUriMatch
    return {
      contentType,
      base64Data: rawData.replace(/[\r\n\s]+/g, ''),
    }
  }

  return {
    contentType: 'application/octet-stream',
    base64Data: trimmed.replace(/[\r\n\s]+/g, ''),
  }
}

function getExtensionFromMime(contentType: string): string | undefined {
  return MIME_EXTENSION_MAP[contentType.toLowerCase()]
}
