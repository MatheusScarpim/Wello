<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { botsApi } from '@/api'
import {
  Bot,
  Power,
  PowerOff,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  FileDown,
  Info
} from 'lucide-vue-next'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import { useToast } from 'vue-toastification'
import type { BotListResponse, BotExport } from '@/types'
import { useWhitelabelStore } from '@/stores/whitelabel'

const toast = useToast()
const whitelabelStore = useWhitelabelStore()

const bots = ref<BotListResponse | null>(null)
const exports = ref<BotExport[]>([])
const isLoading = ref(true)
const isUpdatingBots = ref(false)
const showImportModal = ref(false)
const showExportModal = ref(false)
const selectedBot = ref('')
const deleteConfirm = ref<string | null>(null)

const importFile = ref<File | null>(null)
const botsEnabled = computed(() => whitelabelStore.settings.features?.enableBots ?? true)

async function fetchBots() {
  isLoading.value = true
  try {
    const [botsRes, exportsRes] = await Promise.all([
      botsApi.list(),
      botsApi.listExports()
    ])

    if (botsRes.data) bots.value = botsRes.data
    if (exportsRes.data) exports.value = (exportsRes.data as any).exports || []
  } catch {
    toast.error('Erro ao carregar bots')
  } finally {
    isLoading.value = false
  }
}

async function reloadBot(botId: string) {
  try {
    await botsApi.reload(botId)
    toast.success(`Bot ${botId} recarregado`)
  } catch {
    toast.error('Erro ao recarregar bot')
  }
}

async function exportBot() {
  if (!selectedBot.value) return
  try {
    const response = await botsApi.export(selectedBot.value, 'admin')
    toast.success(`Bot exportado: ${response.data?.filename}`)
    showExportModal.value = false
    fetchBots()
  } catch {
    toast.error('Erro ao exportar bot')
  }
}

async function importBot() {
  if (!importFile.value) return
  try {
    await botsApi.import(importFile.value)
    toast.success('Bot importado com sucesso')
    showImportModal.value = false
    importFile.value = null
    fetchBots()
  } catch {
    toast.error('Erro ao importar bot')
  }
}

async function downloadExport(filename: string) {
  try {
    const blob = await botsApi.downloadExport(filename)
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
  } catch {
    toast.error('Erro ao baixar arquivo')
  }
}

async function deleteExport(filename: string) {
  try {
    await botsApi.deleteExport(filename)
    toast.success('Arquivo excluído')
    deleteConfirm.value = null
    fetchBots()
  } catch {
    toast.error('Erro ao excluir arquivo')
  }
}

async function toggleBotsEnabled() {
  if (isUpdatingBots.value) return
  isUpdatingBots.value = true
  try {
    await whitelabelStore.updateSettings({
      features: {
        ...whitelabelStore.settings.features,
        enableBots: !botsEnabled.value
      }
    })
    toast.success(`Bots ${botsEnabled.value ? 'ativados' : 'desativados'}`)
  } catch {
    toast.error('Erro ao atualizar status dos bots')
  } finally {
    isUpdatingBots.value = false
  }
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files?.length) {
    importFile.value = target.files[0]
  }
}

onMounted(async () => {
  await whitelabelStore.fetchSettings()
  await fetchBots()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Bots</h1>
        <p class="text-gray-500">Gerencie os bots do sistema</p>
      </div>
      <div class="flex gap-2">
        <label class="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            class="w-4 h-4"
            :checked="botsEnabled"
            :disabled="isUpdatingBots"
            @change="toggleBotsEnabled"
          />
          Bots ativos
        </label>
        <button @click="showImportModal = true" class="btn-outline">
          <Upload class="w-4 h-4" />
          Importar
        </button>
        <button @click="showExportModal = true" class="btn-primary">
          <Download class="w-4 h-4" />
          Exportar
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <LoadingSpinner size="lg" />
    </div>

    <template v-else>
      <!-- Bots Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="botId in bots?.registered || []"
          :key="botId"
          class="card card-body"
        >
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <div
                class="w-12 h-12 rounded-xl flex items-center justify-center"
                :class="bots?.active?.includes(botId) ? 'bg-green-100' : 'bg-gray-100'"
              >
                <Bot
                  class="w-6 h-6"
                  :class="bots?.active?.includes(botId) ? 'text-green-600' : 'text-gray-400'"
                />
              </div>
              <div>
                <h3 class="font-semibold text-gray-900 capitalize">{{ botId }}</h3>
                <span
                  :class="bots?.active?.includes(botId) ? 'badge-success' : 'badge-neutral'"
                >
                  {{ bots?.active?.includes(botId) ? 'Ativo' : 'Inativo' }}
                </span>
              </div>
            </div>

            <button
              @click="reloadBot(botId)"
              class="btn-ghost btn-sm"
              title="Recarregar"
            >
              <RefreshCw class="w-4 h-4" />
            </button>
          </div>
        </div>

        <EmptyState
          v-if="!bots?.registered?.length"
          title="Nenhum bot registrado"
          description="Não há bots configurados no sistema."
        >
          <template #icon>
            <Bot class="w-8 h-8 text-gray-400" />
          </template>
        </EmptyState>
      </div>

      <!-- Exports Section -->
      <div v-if="exports.length > 0" class="card">
        <div class="p-4 border-b border-gray-200">
          <h3 class="font-semibold text-gray-900">Arquivos Exportados</h3>
        </div>
        <div class="divide-y divide-gray-100">
          <div
            v-for="exp in exports"
            :key="exp.filename"
            class="p-4 flex items-center justify-between"
          >
            <div class="flex items-center gap-3">
              <FileDown class="w-5 h-5 text-gray-400" />
              <span class="font-medium text-gray-900">{{ exp.filename }}</span>
            </div>
            <div class="flex gap-2">
              <button
                @click="downloadExport(exp.filename)"
                class="btn-ghost btn-sm"
                title="Baixar"
              >
                <Download class="w-4 h-4" />
              </button>
              <button
                @click="deleteConfirm = exp.filename"
                class="btn-ghost btn-sm text-red-600"
                title="Excluir"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Import Modal -->
    <Teleport to="body">
      <div
        v-if="showImportModal"
        class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Importar Bot</h2>

          <div class="mb-4">
            <label class="label">Arquivo .jn</label>
            <input
              type="file"
              accept=".jn"
              @change="handleFileChange"
              class="input"
            />
          </div>

          <div class="flex gap-3">
            <button @click="showImportModal = false" class="btn-secondary flex-1">
              Cancelar
            </button>
            <button
              @click="importBot"
              :disabled="!importFile"
              class="btn-primary flex-1"
            >
              Importar
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Export Modal -->
    <Teleport to="body">
      <div
        v-if="showExportModal"
        class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Exportar Bot</h2>

          <div class="mb-4">
            <label class="label">Selecione o Bot</label>
            <select v-model="selectedBot" class="select">
              <option value="">Selecione...</option>
              <option
                v-for="botId in bots?.registered"
                :key="botId"
                :value="botId"
              >
                {{ botId }}
              </option>
            </select>
          </div>

          <div class="flex gap-3">
            <button @click="showExportModal = false" class="btn-secondary flex-1">
              Cancelar
            </button>
            <button
              @click="exportBot"
              :disabled="!selectedBot"
              class="btn-primary flex-1"
            >
              Exportar
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirm Modal -->
    <Teleport to="body">
      <ConfirmModal
        v-if="deleteConfirm"
        title="Excluir arquivo"
        message="Tem certeza que deseja excluir este arquivo exportado?"
        variant="danger"
        @confirm="deleteExport(deleteConfirm!)"
        @cancel="deleteConfirm = null"
      />
    </Teleport>
  </div>
</template>
