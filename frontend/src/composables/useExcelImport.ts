import * as XLSX from 'xlsx'
import { ref } from 'vue'

export interface ExcelImportOptions {
  sheetName?: string
  headerRow?: number
}

export function useExcelImport() {
  const isImporting = ref(false)

  /**
   * Importa dados de um arquivo Excel
   * @param file Arquivo Excel a ser importado
   * @param options Opções de importação
   * @returns Promise com array de objetos importados
   */
  async function importFromExcel<T extends Record<string, any>>(
    file: File,
    options: ExcelImportOptions = {}
  ): Promise<T[]> {
    isImporting.value = true

    try {
      const { sheetName, headerRow = 0 } = options

      // Valida o tipo de arquivo
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
      ]

      if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
        throw new Error('Tipo de arquivo inválido. Use arquivos Excel (.xlsx, .xls) ou CSV (.csv)')
      }

      // Lê o arquivo
      const data = await readFile(file)

      // Processa o workbook
      const workbook = XLSX.read(data, { type: 'binary' })

      // Seleciona a planilha (usa a primeira se não especificado)
      const sheet = sheetName
        ? workbook.Sheets[sheetName]
        : workbook.Sheets[workbook.SheetNames[0]]

      if (!sheet) {
        throw new Error(
          sheetName
            ? `Planilha "${sheetName}" não encontrada`
            : 'Nenhuma planilha encontrada no arquivo'
        )
      }

      // Converte para JSON
      const jsonData = XLSX.utils.sheet_to_json<T>(sheet, {
        header: headerRow,
        defval: '',
        blankrows: false,
      })

      if (jsonData.length === 0) {
        throw new Error('O arquivo não contém dados')
      }

      return jsonData
    } catch (error) {
      console.error('Erro ao importar Excel:', error)
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Falha ao importar dados do Excel')
    } finally {
      isImporting.value = false
    }
  }

  /**
   * Lê o arquivo como binary string
   */
  function readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string)
        } else {
          reject(new Error('Falha ao ler o arquivo'))
        }
      }

      reader.onerror = () => {
        reject(new Error('Erro ao ler o arquivo'))
      }

      reader.readAsBinaryString(file)
    })
  }

  /**
   * Valida se um arquivo é um arquivo Excel válido
   */
  function validateExcelFile(file: File): { valid: boolean; error?: string } {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ]

    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      return {
        valid: false,
        error: 'Tipo de arquivo inválido. Use arquivos Excel (.xlsx, .xls) ou CSV (.csv)',
      }
    }

    // Limita o tamanho do arquivo a 10MB
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return {
        valid: false,
        error: 'Arquivo muito grande. O tamanho máximo é 10MB',
      }
    }

    return { valid: true }
  }

  return {
    isImporting,
    importFromExcel,
    validateExcelFile,
  }
}
