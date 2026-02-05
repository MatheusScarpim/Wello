<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { storageApi } from '@/api'
import {
  HardDrive,
  Plus,
  Edit2,
  Trash2,
  Upload,
  Check,
  Link,
  FileText,
  Image
} from 'lucide-vue-next'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import { useToast } from 'vue-toastification'
import type { StorageConfig, StorageStatus, UploadResult } from '@/types'
import ExcelActions from '@/components/ui/ExcelActions.vue'

const toast = useToast()

const configs = ref<StorageConfig[]>([])
const status = ref<StorageStatus | null>(null)
const blobs = ref<string[]>([])
const isLoading = ref(true)

// Modals
const showConfigModal = ref(false)
const showUploadModal = ref(false)
const editingConfig = ref<StorageConfig | null>(null)
const deleteConfirm = ref<StorageConfig | null>(null)

// Config form
const configForm = ref({
  accountName: '',
  accountKey: '',
  containerName: 'nxzap-media',
  connectionString: '',
  endpoint: '',
  isActive: true
})

// Upload form
const uploadMode = ref<'file' | 'base64' | 'url'>('file')
const uploadFile = ref<File | null>(null)
const uploadBase64 = ref('')
const uploadUrl = ref('')
const uploadFileName = ref('')
const uploadContentType = ref('')
const isUploading = ref(false)
const lastUploadResult = ref<UploadResult | null>(null)

async function fetchData() {
  isLoading.value = true
  try {
    const configsRes = await storageApi.listConfigs()
    const configsPayload =
      configsRes.data?.configs || (configsRes as any).configs || []
    configs.value = configsPayload
  } catch {
    toast.error('Erro ao carregar configurações de storage')
  }

  if (configs.value.length === 0) {
    try {
      const activeRes = await storageApi.getActiveConfig()
      if (activeRes.data?.config) {
        configs.value = [activeRes.data.config]
      }
    } catch {
      // Apenas fallback, não bloqueia
    }
  }

  if (configs.value.length > 0 && !status.value?.configured) {
    const active = configs.value[0]
    status.value = {
      configured: true,
      provider: active.endpoint ? 'azure_blob' : 'azure_blob',
      containerName: active.containerName,
    }
  }

  try {
    const statusRes = await storageApi.getStatus()
    if (statusRes.data) {
      status.value = statusRes.data as StorageStatus
    } else if ((statusRes as any).configured !== undefined) {
      status.value = {
        configured: (statusRes as any).configured,
        provider: (statusRes as any).provider,
        containerName: (statusRes as any).containerName,
      }
    }
  } catch {
    // Não precisa notificar o usuário para status
  }

  try {
    const blobsRes = await storageApi.listBlobs()
    if (blobsRes.data) {
      blobs.value = (blobsRes.data as any).blobs || []
    }
  } catch {
    // Blobs são apenas informativos; ignoramos falhas
  } finally {
    isLoading.value = false
  }
}

async function saveConfig() {
  if (!configForm.value.accountName || !configForm.value.accountKey) {
    toast.error('Preencha os campos obrigatórios')
    return
  }

  try {
    if (editingConfig.value) {
      await storageApi.updateConfig(editingConfig.value._id, configForm.value)
      toast.success('Configuração atualizada')
    } else {
      await storageApi.createConfig(configForm.value)
      toast.success('Configuração criada')
    }
    showConfigModal.value = false
    resetConfigForm()
    fetchData()
  } catch {
    toast.error('Erro ao salvar configuração')
  }
}

async function deleteConfig() {
  if (!deleteConfirm.value) return
  try {
    await storageApi.deleteConfig(deleteConfirm.value._id)
    toast.success('Configuração excluída')
    deleteConfirm.value = null
    fetchData()
  } catch {
    toast.error('Erro ao excluir configuração')
  }
}

async function activateConfig(config: StorageConfig) {
  try {
    await storageApi.updateConfig(config._id, { isActive: true })
    toast.success('Configuração ativada')
    fetchData()
  } catch {
    toast.error('Erro ao ativar configuração')
  }
}

async function handleUpload() {
  isUploading.value = true
  lastUploadResult.value = null

  try {
    let result: { result: UploadResult } | undefined

    if (uploadMode.value === 'file' && uploadFile.value) {
      const response = await storageApi.uploadFile(uploadFile.value)
      result = response.data as any
    } else if (uploadMode.value === 'base64' && uploadBase64.value) {
      const response = await storageApi.uploadBase64(
        uploadBase64.value,
        uploadFileName.value,
        uploadContentType.value
      )
      result = response.data as any
    } else if (uploadMode.value === 'url' && uploadUrl.value) {
      const response = await storageApi.uploadUrl(
        uploadUrl.value,
        uploadFileName.value,
        uploadContentType.value
      )
      result = response.data as any
    }

    if (result?.result) {
      lastUploadResult.value = result.result
      toast.success('Upload realizado com sucesso')
      fetchData()
    }
  } catch {
    toast.error('Erro ao fazer upload')
  } finally {
    isUploading.value = false
  }
}

function openEditConfig(config: StorageConfig) {
  editingConfig.value = config
  configForm.value = {
    accountName: config.accountName,
    accountKey: config.accountKey || '',
    containerName: config.containerName,
    connectionString: config.connectionString || '',
    endpoint: config.endpoint || '',
    isActive: config.isActive
  }
  showConfigModal.value = true
}

function openCreateConfig() {
  editingConfig.value = null
  resetConfigForm()
  showConfigModal.value = true
}

function resetConfigForm() {
  configForm.value = {
    accountName: '',
    accountKey: '',
    containerName: 'nxzap-media',
    connectionString: '',
    endpoint: '',
    isActive: true
  }
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files?.length) {
    uploadFile.value = target.files[0]
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
  toast.success('Copiado!')
}

// Excel handlers
const exportData = computed(() => {
  return blobs.value.map((blob, index) => ({
    '#': index + 1,
    'Nome do Arquivo': blob,
    URL: blob,
  }))
})

async function handleImport(_data: any[]) {
  toast.info('Importação de arquivos via Excel não é suportada. Use o botão Upload.')
}

onMounted(fetchData)
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Storage</h1>
        <p class="text-gray-500">Configurações do Azure Blob Storage</p>
      </div>
      <div class="flex flex-col sm:flex-row gap-2">
        <ExcelActions
          :data="exportData"
          :export-options="{
            filename: 'storage-blobs.xlsx',
            sheetName: 'Arquivos'
          }"
          :on-import="handleImport"
        />
        <button @click="showUploadModal = true" class="btn-outline">
          <Upload class="w-4 h-4" />
          Upload
        </button>
        <button @click="openCreateConfig" class="btn-primary">
          <Plus class="w-4 h-4" />
          Nova Config
        </button>
      </div>
    </div>

    <!-- Status -->
    <div class="card card-body">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="w-12 h-12 rounded-xl flex items-center justify-center"
            :class="status?.configured ? 'bg-green-100' : 'bg-gray-100'"
          >
            <HardDrive
              class="w-6 h-6"
              :class="status?.configured ? 'text-green-600' : 'text-gray-400'"
            />
          </div>
          <div>
            <p class="font-semibold text-gray-900">
              {{ status?.configured ? 'Configurado' : 'Não configurado' }}
            </p>
            <p class="text-sm text-gray-500">
              {{ status?.provider || 'N/A' }} - {{ status?.containerName || 'N/A' }}
            </p>
          </div>
        </div>
        <span :class="status?.configured ? 'badge-success' : 'badge-neutral'">
          {{ status?.configured ? 'Ativo' : 'Inativo' }}
        </span>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <LoadingSpinner size="lg" />
    </div>

    <template v-else>
      <!-- Configs List -->
      <div class="card">
        <div class="p-4 border-b border-gray-200">
          <h3 class="font-semibold text-gray-900">Configurações</h3>
        </div>

        <EmptyState
          v-if="configs.length === 0"
          title="Nenhuma configuração"
          description="Adicione uma configuração do Azure Blob Storage."
        >
          <template #action>
            <button @click="openCreateConfig" class="btn-primary">
              <Plus class="w-4 h-4" />
              Adicionar
            </button>
          </template>
        </EmptyState>

        <div v-else class="divide-y divide-gray-100">
          <div
            v-for="config in configs"
            :key="config._id"
            class="p-4 flex items-center justify-between"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center"
                :class="config.isActive ? 'bg-green-100' : 'bg-gray-100'"
              >
                <Check v-if="config.isActive" class="w-5 h-5 text-green-600" />
                <HardDrive v-else class="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <p class="font-medium text-gray-900">{{ config.accountName }}</p>
                <p class="text-sm text-gray-500">{{ config.containerName }}</p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                v-if="!config.isActive"
                @click="activateConfig(config)"
                class="btn-ghost btn-sm text-green-600"
                title="Ativar"
              >
                <Check class="w-4 h-4" />
              </button>
              <button
                @click="openEditConfig(config)"
                class="btn-ghost btn-sm"
                title="Editar"
              >
                <Edit2 class="w-4 h-4" />
              </button>
              <button
                @click="deleteConfirm = config"
                class="btn-ghost btn-sm text-red-600"
                title="Excluir"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Blobs list -->
      <div v-if="blobs.length > 0" class="card">
        <div class="p-4 border-b border-gray-200">
          <h3 class="font-semibold text-gray-900">Arquivos Recentes ({{ blobs.length }})</h3>
        </div>
        <div class="max-h-60 overflow-y-auto divide-y divide-gray-100">
          <div
            v-for="blob in blobs.slice(0, 20)"
            :key="blob"
            class="p-3 flex items-center gap-3 text-sm"
          >
            <FileText class="w-4 h-4 text-gray-400" />
            <span class="font-mono text-gray-600 truncate">{{ blob }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- Config Modal -->
    <Teleport to="body">
      <div
        v-if="showConfigModal"
        class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">
            {{ editingConfig ? 'Editar Configuração' : 'Nova Configuração' }}
          </h2>

          <form @submit.prevent="saveConfig" class="space-y-4">
            <div>
              <label class="label">Account Name *</label>
              <input v-model="configForm.accountName" type="text" class="input" required />
            </div>

            <div>
              <label class="label">Account Key *</label>
              <input v-model="configForm.accountKey" type="password" class="input" required />
            </div>

            <div>
              <label class="label">Container Name</label>
              <input v-model="configForm.containerName" type="text" class="input" />
            </div>

            <div>
              <label class="label">Connection String (opcional)</label>
              <textarea v-model="configForm.connectionString" class="textarea" rows="2" />
            </div>

            <div class="flex items-center gap-2">
              <input type="checkbox" id="isActive" v-model="configForm.isActive" class="w-4 h-4" />
              <label for="isActive" class="text-sm text-gray-700">Configuração ativa</label>
            </div>

            <div class="flex gap-3 pt-4">
              <button type="button" @click="showConfigModal = false" class="btn-secondary flex-1">
                Cancelar
              </button>
              <button type="submit" class="btn-primary flex-1">
                Salvar
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Upload Modal -->
    <Teleport to="body">
      <div
        v-if="showUploadModal"
        class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Upload de Arquivo</h2>

          <!-- Mode tabs -->
          <div class="flex gap-2 mb-4">
            <button
              v-for="mode in ['file', 'base64', 'url'] as const"
              :key="mode"
              @click="uploadMode = mode"
              class="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
              :class="uploadMode === mode ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'"
            >
              {{ mode === 'file' ? 'Arquivo' : mode === 'base64' ? 'Base64' : 'URL' }}
            </button>
          </div>

          <form @submit.prevent="handleUpload" class="space-y-4">
            <!-- File upload -->
            <div v-if="uploadMode === 'file'">
              <label class="label">Arquivo</label>
              <input type="file" @change="handleFileChange" class="input" />
            </div>

            <!-- Base64 upload -->
            <template v-if="uploadMode === 'base64'">
              <div>
                <label class="label">Base64 Data</label>
                <textarea v-model="uploadBase64" class="textarea font-mono text-xs" rows="4" placeholder="data:image/png;base64,..." />
              </div>
              <div>
                <label class="label">Nome do arquivo</label>
                <input v-model="uploadFileName" type="text" class="input" placeholder="imagem.png" />
              </div>
              <div>
                <label class="label">Content Type</label>
                <input v-model="uploadContentType" type="text" class="input" placeholder="image/png" />
              </div>
            </template>

            <!-- URL upload -->
            <template v-if="uploadMode === 'url'">
              <div>
                <label class="label">URL</label>
                <input v-model="uploadUrl" type="url" class="input" placeholder="https://..." />
              </div>
              <div>
                <label class="label">Nome do arquivo</label>
                <input v-model="uploadFileName" type="text" class="input" placeholder="imagem.png" />
              </div>
              <div>
                <label class="label">Content Type</label>
                <input v-model="uploadContentType" type="text" class="input" placeholder="image/png" />
              </div>
            </template>

            <!-- Result -->
            <div v-if="lastUploadResult" class="p-4 bg-green-50 rounded-lg">
              <p class="text-sm font-medium text-green-800 mb-2">Upload realizado!</p>
              <button
                type="button"
                @click="copyToClipboard(lastUploadResult.url)"
                class="text-xs text-green-600 hover:underline flex items-center gap-1"
              >
                <Link class="w-3 h-3" />
                {{ lastUploadResult.url }}
              </button>
            </div>

            <div class="flex gap-3 pt-4">
              <button type="button" @click="showUploadModal = false" class="btn-secondary flex-1">
                Fechar
              </button>
              <button type="submit" :disabled="isUploading" class="btn-primary flex-1">
                {{ isUploading ? 'Enviando...' : 'Enviar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirm -->
    <Teleport to="body">
      <ConfirmModal
        v-if="deleteConfirm"
        title="Excluir configuração"
        message="Tem certeza que deseja excluir esta configuração?"
        variant="danger"
        @confirm="deleteConfig"
        @cancel="deleteConfirm = null"
      />
    </Teleport>
  </div>
</template>
