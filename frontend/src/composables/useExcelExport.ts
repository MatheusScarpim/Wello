import * as XLSX from 'xlsx'

export interface ExcelExportOptions {
  filename?: string
  sheetName?: string
  columns?: string[]
  headers?: Record<string, string>
}

export function useExcelExport() {
  /**
   * Exporta dados para um arquivo Excel
   * @param data Array de objetos a serem exportados
   * @param options Opções de exportação
   */
  function exportToExcel<T extends Record<string, any>>(
    data: T[],
    options: ExcelExportOptions = {}
  ) {
    try {
      const {
        filename = 'export.xlsx',
        sheetName = 'Dados',
        columns,
        headers,
      } = options

      // Se não houver dados, exporta apenas os cabeçalhos
      if (data.length === 0) {
        const emptyData = [{}]
        const worksheet = XLSX.utils.json_to_sheet(emptyData)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
        XLSX.writeFile(workbook, filename)
        return
      }

      // Prepara os dados para exportação
      let exportData = data

      // Se houver colunas específicas definidas, filtra apenas essas colunas
      if (columns && columns.length > 0) {
        exportData = data.map((item) => {
          const filtered: Record<string, any> = {}
          columns.forEach((col) => {
            filtered[col] = item[col]
          })
          return filtered as T
        })
      }

      // Aplica headers customizados se fornecidos
      if (headers) {
        exportData = exportData.map((item) => {
          const mapped: Record<string, any> = {}
          Object.keys(item).forEach((key) => {
            const headerName = headers[key] || key
            mapped[headerName] = item[key]
          })
          return mapped as T
        })
      }

      // Cria a planilha
      const worksheet = XLSX.utils.json_to_sheet(exportData)

      // Ajusta largura das colunas automaticamente
      const cols = Object.keys(exportData[0] || {}).map((key) => ({
        wch: Math.max(
          key.length,
          ...exportData.map((row) => String(row[key] || '').length)
        ),
      }))
      worksheet['!cols'] = cols

      // Cria o workbook e adiciona a planilha
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

      // Faz o download do arquivo
      XLSX.writeFile(workbook, filename)

      return true
    } catch (error) {
      console.error('Erro ao exportar para Excel:', error)
      throw new Error('Falha ao exportar dados para Excel')
    }
  }

  return {
    exportToExcel,
  }
}
