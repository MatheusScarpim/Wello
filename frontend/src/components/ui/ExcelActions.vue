<template>
  <div class="flex gap-2">
    <!-- Botão de Exportar -->
    <button
      @click="handleExport"
      :disabled="isExporting || (!data || data.length === 0)"
      class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      :class="{ 'opacity-50 cursor-not-allowed': isExporting }"
    >
      <svg
        v-if="!isExporting"
        xmlns="http://www.w3.org/2000/svg"
        class="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      <svg
        v-else
        class="w-4 h-4 animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      {{ isExporting ? 'Exportando...' : 'Exportar Excel' }}
    </button>

    <!-- Botão de Importar -->
    <label
      class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer transition-colors"
      :class="{ 'opacity-50 cursor-not-allowed': isImporting }"
    >
      <svg
        v-if="!isImporting"
        xmlns="http://www.w3.org/2000/svg"
        class="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <svg
        v-else
        class="w-4 h-4 animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      {{ isImporting ? 'Importando...' : 'Importar Excel' }}
      <input
        ref="fileInput"
        type="file"
        accept=".xlsx,.xls,.csv"
        @change="handleImport"
        class="hidden"
        :disabled="isImporting"
      />
    </label>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useExcelExport, type ExcelExportOptions } from '@/composables/useExcelExport'
import { useExcelImport } from '@/composables/useExcelImport'
import { useToast } from 'vue-toastification'

interface Props {
  data?: any[]
  exportOptions?: ExcelExportOptions
  onImport?: (data: any[]) => void | Promise<void>
}

const props = defineProps<Props>()

const { exportToExcel } = useExcelExport()
const { importFromExcel, validateExcelFile } = useExcelImport()
const toast = useToast()

const isExporting = ref(false)
const isImporting = ref(false)
const fileInput = ref<HTMLInputElement>()

async function handleExport() {
  if (!props.data || props.data.length === 0) {
    toast.warning('Não há dados para exportar')
    return
  }

  isExporting.value = true
  try {
    exportToExcel(props.data, props.exportOptions)
    toast.success('Dados exportados com sucesso!')
  } catch (error) {
    console.error('Erro ao exportar:', error)
    toast.error('Erro ao exportar dados para Excel')
  } finally {
    isExporting.value = false
  }
}

async function handleImport(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  // Valida o arquivo
  const validation = validateExcelFile(file)
  if (!validation.valid) {
    toast.error(validation.error || 'Arquivo inválido')
    return
  }

  isImporting.value = true
  try {
    const importedData = await importFromExcel(file)

    if (importedData.length === 0) {
      toast.warning('O arquivo não contém dados')
      return
    }

    // Chama o callback de importação se fornecido
    if (props.onImport) {
      await props.onImport(importedData)
      toast.success(`${importedData.length} registro(s) importado(s) com sucesso!`)
    } else {
      toast.info(`${importedData.length} registro(s) encontrado(s) no arquivo`)
    }
  } catch (error) {
    console.error('Erro ao importar:', error)
    const message = error instanceof Error ? error.message : 'Erro ao importar dados do Excel'
    toast.error(message)
  } finally {
    isImporting.value = false
    // Limpa o input para permitir importar o mesmo arquivo novamente
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
}
</script>
