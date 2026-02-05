import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

import { IBot } from '@/core/bot/interfaces/IBot'
import {
  ExportedBotConfig,
  ExportedStage,
  ExportResult,
  ImportResult,
  JNFileFormat,
} from '@/core/bot/interfaces/IBotExport'

/**
 * Serviço para exportação e importação de bots em formato .jn
 */
export class BotExportService {
  private static readonly EXPORT_DIR = path.join(process.cwd(), 'exports')
  private static readonly FILE_VERSION = '1.0.0'

  /**
   * Garante que o diretório de exportação existe
   */
  private static ensureExportDir(): void {
    if (!fs.existsSync(this.EXPORT_DIR)) {
      fs.mkdirSync(this.EXPORT_DIR, { recursive: true })
    }
  }

  /**
   * Gera checksum MD5 para validação de integridade
   */
  private static generateChecksum(data: any): string {
    const jsonString = JSON.stringify(data, null, 2)
    return crypto.createHash('md5').update(jsonString).digest('hex')
  }

  /**
   * Valida checksum do arquivo
   */
  private static validateChecksum(fileData: JNFileFormat): boolean {
    if (!fileData.checksum) return true // Opcional

    const checksumToValidate = fileData.checksum
    const dataCopy = { ...fileData }
    delete dataCopy.checksum

    const calculatedChecksum = this.generateChecksum(dataCopy)
    return checksumToValidate === calculatedChecksum
  }

  /**
   * Exporta um bot para arquivo .jn
   */
  static async exportBot(
    bot: IBot,
    exportedBy?: string,
    metadata?: Record<string, any>,
  ): Promise<ExportResult> {
    try {
      this.ensureExportDir()

      // Cria a configuração exportada
      const botConfig: ExportedBotConfig = {
        id: bot.config.id,
        name: bot.config.name,
        description: bot.config.description,
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        initialStage: bot.config.initialStage,
        sessionTimeout: bot.config.sessionTimeout,
        enableAnalytics: bot.config.enableAnalytics,
        stages: this.extractStages(bot),
        metadata: metadata || {},
      }

      // Cria o formato do arquivo .jn
      const jnFile: JNFileFormat = {
        fileVersion: this.FILE_VERSION,
        exportDate: new Date().toISOString(),
        exportedBy,
        bot: botConfig,
      }

      // Gera checksum
      jnFile.checksum = this.generateChecksum({
        ...jnFile,
        checksum: undefined,
      })

      // Nome do arquivo
      const filename = `${bot.config.id}_${Date.now()}.jn`
      const filepath = path.join(this.EXPORT_DIR, filename)

      // Salva o arquivo
      fs.writeFileSync(filepath, JSON.stringify(jnFile, null, 2), 'utf-8')

      return {
        success: true,
        filename,
        filepath,
        data: jnFile,
        message: `Bot "${bot.config.name}" exportado com sucesso!`,
      }
    } catch (error) {
      console.error('Erro ao exportar bot:', error)
      return {
        success: false,
        filename: '',
        message: `Erro ao exportar bot: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  /**
   * Extrai estágios do bot (simplificado - você precisará adaptar)
   */
  private static extractStages(bot: IBot): ExportedStage[] {
    const stages: ExportedStage[] = []

    // Nota: Esta é uma versão simplificada
    // Você precisará adaptar de acordo com sua implementação real
    // Para obter os estágios reais do bot

    // Exemplo básico - você pode precisar acessar os estágios de forma diferente
    // dependendo de como estão armazenados no seu bot
    for (let i = 0; i <= 10; i++) {
      const stage = (bot as any).stages?.get(i)
      if (!stage) continue

      stages.push({
        stageNumber: stage.stageNumber,
        description: stage.description || `Estágio ${i}`,
        type: 'custom', // Você pode determinar o tipo baseado no conteúdo
        content: {
          message: 'Mensagem do estágio',
        },
      })
    }

    return stages
  }

  /**
   * Importa um bot a partir de arquivo .jn
   */
  static async importBot(filepath: string): Promise<ImportResult> {
    try {
      // Valida se o arquivo existe
      if (!fs.existsSync(filepath)) {
        return {
          success: false,
          message: 'Arquivo não encontrado',
          errors: ['O arquivo especificado não existe'],
        }
      }

      // Valida extensão
      if (!filepath.endsWith('.jn')) {
        return {
          success: false,
          message: 'Formato de arquivo inválido',
          errors: ['O arquivo deve ter extensão .jn'],
        }
      }

      // Lê o arquivo
      const fileContent = fs.readFileSync(filepath, 'utf-8')
      const jnFile: JNFileFormat = JSON.parse(fileContent)

      // Valida versão do arquivo
      if (jnFile.fileVersion !== this.FILE_VERSION) {
        return {
          success: false,
          message: 'Versão de arquivo incompatível',
          errors: [
            `Versão esperada: ${this.FILE_VERSION}, recebida: ${jnFile.fileVersion}`,
          ],
          warnings: ['Tente exportar novamente com a versão mais recente'],
        }
      }

      // Valida checksum
      if (!this.validateChecksum(jnFile)) {
        return {
          success: false,
          message: 'Arquivo corrompido',
          errors: [
            'O checksum do arquivo não corresponde. O arquivo pode estar corrompido.',
          ],
        }
      }

      // Valida estrutura do bot
      const validationErrors = this.validateBotStructure(jnFile.bot)
      if (validationErrors.length > 0) {
        return {
          success: false,
          message: 'Estrutura do bot inválida',
          errors: validationErrors,
        }
      }

      // Aqui você implementaria a lógica para:
      // 1. Criar uma nova classe de bot dinamicamente
      // 2. Registrar os estágios
      // 3. Adicionar ao BotFactory
      // Por enquanto, apenas retornamos sucesso

      return {
        success: true,
        botId: jnFile.bot.id,
        message: `Bot "${jnFile.bot.name}" importado com sucesso!`,
        warnings: [
          'A implementação dinâmica completa ainda precisa ser desenvolvida',
        ],
      }
    } catch (error) {
      console.error('Erro ao importar bot:', error)
      return {
        success: false,
        message: `Erro ao importar bot: ${error instanceof Error ? error.message : String(error)}`,
        errors: [String(error)],
      }
    }
  }

  /**
   * Valida a estrutura do bot exportado
   */
  private static validateBotStructure(bot: ExportedBotConfig): string[] {
    const errors: string[] = []

    if (!bot.id || bot.id.trim() === '') {
      errors.push('Bot ID é obrigatório')
    }

    if (!bot.name || bot.name.trim() === '') {
      errors.push('Nome do bot é obrigatório')
    }

    if (!bot.stages || bot.stages.length === 0) {
      errors.push('Bot deve ter pelo menos um estágio')
    }

    if (bot.initialStage < 0) {
      errors.push('Estágio inicial inválido')
    }

    // Valida que o estágio inicial existe
    if (
      bot.stages &&
      !bot.stages.find((s) => s.stageNumber === bot.initialStage)
    ) {
      errors.push('Estágio inicial não encontrado na lista de estágios')
    }

    // Valida estágios
    bot.stages?.forEach((stage, index) => {
      if (stage.stageNumber < 0) {
        errors.push(`Estágio ${index}: número de estágio inválido`)
      }
      if (!stage.type) {
        errors.push(`Estágio ${index}: tipo é obrigatório`)
      }
    })

    return errors
  }

  /**
   * Lista todos os arquivos .jn disponíveis
   */
  static listExportedBots(): Array<{
    filename: string
    filepath: string
    bot?: ExportedBotConfig
  }> {
    try {
      this.ensureExportDir()

      const files = fs
        .readdirSync(this.EXPORT_DIR)
        .filter((file) => file.endsWith('.jn'))

      return files.map((filename) => {
        const filepath = path.join(this.EXPORT_DIR, filename)
        try {
          const content = fs.readFileSync(filepath, 'utf-8')
          const jnFile: JNFileFormat = JSON.parse(content)
          return { filename, filepath, bot: jnFile.bot }
        } catch {
          return { filename, filepath }
        }
      })
    } catch (error) {
      console.error('Erro ao listar bots exportados:', error)
      return []
    }
  }

  /**
   * Deleta um arquivo .jn exportado
   */
  static deleteExportedBot(filename: string): boolean {
    try {
      const filepath = path.join(this.EXPORT_DIR, filename)
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath)
        return true
      }
      return false
    } catch (error) {
      console.error('Erro ao deletar bot exportado:', error)
      return false
    }
  }
}
