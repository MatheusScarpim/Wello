<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { format } from 'date-fns'
import { useToast } from 'vue-toastification'
import { RefreshCw, Edit3, Trash2, TrendingUp, TrendingDown, Plus, CheckCircle2, XCircle, FolderOpen } from 'lucide-vue-next'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import { finalizationsApi } from '@/api'
import type { Finalization, FinalizationPayload } from '@/types'
import ExcelActions from '@/components/ui/ExcelActions.vue'

const toast = useToast()
const finalizations = ref<Finalization[]>([])
const isLoading = ref(true)
const isSaving = ref(false)
const showEditModal = ref(false)
const editTarget = ref<Finalization | null>(null)
const editForm = ref<FinalizationPayload>({ name: '', type: 'gain' })
const isEditing = ref(false)
const newFinalization = ref<FinalizationPayload>({ name: '', type: 'gain' })

async function fetchFinalizations() {
  isLoading.value = true
  try {
    const response = await finalizationsApi.list()
    if (response.data) {
      finalizations.value = response.data
    }
  } catch {
    toast.error('Erro ao carregar finalizações')
  } finally {
    isLoading.value = false
  }
}

async function createFinalization() {
  const payload = {
    name: newFinalization.value.name.trim(),
    type: newFinalization.value.type,
  }

  if (!payload.name) {
    toast.error('Informe o nome da finalização')
    return
  }

  isSaving.value = true
  try {
    await finalizationsApi.create(payload)
    toast.success('Finalização criada com sucesso')
    newFinalization.value = { name: '', type: 'gain' }
    fetchFinalizations()
  } catch {
    toast.error('Erro ao criar finalização')
  } finally {
    isSaving.value = false
  }
}

function openEditModal(finalization: Finalization) {
  editTarget.value = finalization
  editForm.value = { name: finalization.name, type: finalization.type }
  showEditModal.value = true
}

function closeEditModal() {
  showEditModal.value = false
  editTarget.value = null
}

async function saveEdit() {
  if (!editTarget.value) return

  const payload = {
    name: editForm.value.name.trim(),
    type: editForm.value.type,
  }

  if (!payload.name) {
    toast.error('Informe o nome da finalização')
    return
  }

  isEditing.value = true
  try {
    await finalizationsApi.update(editTarget.value._id, payload)
    toast.success('Finalização atualizada')
    closeEditModal()
    fetchFinalizations()
  } catch {
    toast.error('Erro ao atualizar finalização')
  } finally {
    isEditing.value = false
  }
}

async function deleteFinalization(id: string) {
  if (!window.confirm('Tem certeza que deseja remover esta finalização?')) {
    return
  }

  try {
    await finalizationsApi.remove(id)
    toast.success('Finalização removida')
    fetchFinalizations()
  } catch {
    toast.error('Erro ao remover finalização')
  }
}

function formatDateTime(date?: string) {
  if (!date) return '-'
  return format(new Date(date), 'dd/MM/yyyy HH:mm')
}

const gainFinalizations = computed(() => finalizations.value.filter(f => f.type === 'gain'))
const lossFinalizations = computed(() => finalizations.value.filter(f => f.type === 'loss'))

// Excel handlers
const exportData = computed(() => {
  return finalizations.value.map(fin => ({
    Nome: fin.name,
    Tipo: fin.type === 'gain' ? 'Ganho' : 'Perda',
    'Criado em': formatDateTime(fin.createdAt),
    'Atualizado em': formatDateTime(fin.updatedAt),
  }))
})

async function handleImport(data: any[]) {
  const validFinalizations = data.filter(row => row.Nome || row.name)

  if (validFinalizations.length === 0) {
    toast.error('Nenhuma finalização válida encontrada no arquivo')
    return
  }

  let created = 0
  let failed = 0

  for (const row of validFinalizations) {
    try {
      const name = row.Nome || row.name
      const tipoStr = (row.Tipo || row.type || 'ganho').toLowerCase()
      const type = tipoStr === 'ganho' || tipoStr === 'gain' ? 'gain' : 'loss'

      await finalizationsApi.create({
        name,
        type
      })
      created++
    } catch (error) {
      console.error('Erro ao criar finalização:', error)
      failed++
    }
  }

  if (created > 0) {
    toast.success(`${created} finalização(ões) importada(s) com sucesso!`)
    fetchFinalizations()
  }

  if (failed > 0) {
    toast.warning(`${failed} finalização(ões) falharam ao importar (podem já existir)`)
  }
}

onMounted(() => {
  fetchFinalizations()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Finalizações</h1>
        <p class="text-gray-500">Gerencie motivos de encerramento de atendimentos.</p>
      </div>
      <div class="flex flex-col sm:flex-row gap-2">
        <ExcelActions
          :data="exportData"
          :export-options="{
            filename: 'finalizacoes.xlsx',
            sheetName: 'Finalizações'
          }"
          :on-import="handleImport"
        />
        <button @click="fetchFinalizations" class="btn-outline">
          <RefreshCw class="w-4 h-4" />
          Atualizar
        </button>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
            <FolderOpen class="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900">{{ finalizations.length }}</p>
            <p class="text-xs text-gray-500">Total</p>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
            <TrendingUp class="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p class="text-2xl font-bold text-emerald-600">{{ gainFinalizations.length }}</p>
            <p class="text-xs text-gray-500">Ganhos</p>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4 col-span-2 sm:col-span-1">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
            <TrendingDown class="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p class="text-2xl font-bold text-red-600">{{ lossFinalizations.length }}</p>
            <p class="text-xs text-gray-500">Perdas</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Form Card -->
      <div class="bg-white rounded-xl border border-gray-200 p-5 h-fit">
        <div class="flex items-center gap-3 mb-5">
          <div class="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
            <Plus class="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h2 class="font-semibold text-gray-900">Nova Finalização</h2>
            <p class="text-xs text-gray-500">Adicione um motivo de encerramento</p>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <label class="label">Nome</label>
            <input
              v-model="newFinalization.name"
              type="text"
              class="input"
              placeholder="Ex: Venda Concluída"
            />
          </div>

          <div>
            <label class="label">Tipo</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                @click="newFinalization.type = 'gain'"
                class="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all"
                :class="newFinalization.type === 'gain'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'"
              >
                <TrendingUp class="w-4 h-4" />
                <span class="font-medium text-sm">Ganho</span>
              </button>
              <button
                type="button"
                @click="newFinalization.type = 'loss'"
                class="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all"
                :class="newFinalization.type === 'loss'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'"
              >
                <TrendingDown class="w-4 h-4" />
                <span class="font-medium text-sm">Perda</span>
              </button>
            </div>
          </div>

          <button
            @click="createFinalization"
            class="btn-primary w-full justify-center"
            :disabled="isSaving || !newFinalization.name.trim()"
          >
            <Plus v-if="!isSaving" class="w-4 h-4" />
            <LoadingSpinner v-else size="sm" />
            <span>{{ isSaving ? 'Salvando...' : 'Criar Finalização' }}</span>
          </button>
        </div>
      </div>

      <!-- List -->
      <div class="lg:col-span-2">
        <div v-if="isLoading" class="bg-white rounded-xl border border-gray-200 flex items-center justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>

        <div v-else-if="finalizations.length === 0" class="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div class="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <FolderOpen class="w-8 h-8 text-gray-400" />
          </div>
          <h3 class="font-semibold text-gray-900 mb-1">Nenhuma finalização</h3>
          <p class="text-sm text-gray-500">Crie sua primeira finalização usando o formulário ao lado.</p>
        </div>

        <div v-else class="space-y-4">
          <!-- Ganhos -->
          <div v-if="gainFinalizations.length > 0">
            <div class="flex items-center gap-2 mb-3">
              <div class="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                <TrendingUp class="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <h3 class="font-semibold text-gray-700 text-sm">Ganhos</h3>
              <span class="text-xs text-gray-400">({{ gainFinalizations.length }})</span>
            </div>
            <div class="grid gap-2">
              <div
                v-for="finalization in gainFinalizations"
                :key="finalization._id"
                class="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:border-emerald-200 hover:bg-emerald-50/30 transition-colors group"
              >
                <div class="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 class="w-5 h-5 text-emerald-600" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-gray-900 truncate">{{ finalization.name }}</p>
                  <p class="text-xs text-gray-400">{{ formatDateTime(finalization.createdAt) }}</p>
                </div>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    @click="openEditModal(finalization)"
                    class="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                    title="Editar"
                  >
                    <Edit3 class="w-4 h-4" />
                  </button>
                  <button
                    @click="deleteFinalization(finalization._id)"
                    class="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600"
                    title="Remover"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Perdas -->
          <div v-if="lossFinalizations.length > 0">
            <div class="flex items-center gap-2 mb-3">
              <div class="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                <TrendingDown class="w-3.5 h-3.5 text-red-600" />
              </div>
              <h3 class="font-semibold text-gray-700 text-sm">Perdas</h3>
              <span class="text-xs text-gray-400">({{ lossFinalizations.length }})</span>
            </div>
            <div class="grid gap-2">
              <div
                v-for="finalization in lossFinalizations"
                :key="finalization._id"
                class="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:border-red-200 hover:bg-red-50/30 transition-colors group"
              >
                <div class="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                  <XCircle class="w-5 h-5 text-red-600" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-gray-900 truncate">{{ finalization.name }}</p>
                  <p class="text-xs text-gray-400">{{ formatDateTime(finalization.createdAt) }}</p>
                </div>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    @click="openEditModal(finalization)"
                    class="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                    title="Editar"
                  >
                    <Edit3 class="w-4 h-4" />
                  </button>
                  <button
                    @click="deleteFinalization(finalization._id)"
                    class="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600"
                    title="Remover"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <Teleport to="body">
      <div
        v-if="showEditModal"
        class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        @click.self="closeEditModal"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
              <Edit3 class="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 class="font-semibold text-gray-900">Editar Finalização</h2>
              <p class="text-xs text-gray-500">Atualize os dados da finalização</p>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <label class="label">Nome</label>
              <input v-model="editForm.name" type="text" class="input" />
            </div>

            <div>
              <label class="label">Tipo</label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  @click="editForm.type = 'gain'"
                  class="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all"
                  :class="editForm.type === 'gain'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'"
                >
                  <TrendingUp class="w-4 h-4" />
                  <span class="font-medium text-sm">Ganho</span>
                </button>
                <button
                  type="button"
                  @click="editForm.type = 'loss'"
                  class="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all"
                  :class="editForm.type === 'loss'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'"
                >
                  <TrendingDown class="w-4 h-4" />
                  <span class="font-medium text-sm">Perda</span>
                </button>
              </div>
            </div>

            <div class="flex gap-3 pt-2">
              <button @click="closeEditModal" class="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                @click="saveEdit"
                class="btn-primary flex-1 justify-center"
                :disabled="isEditing || !editForm.name.trim()"
              >
                <LoadingSpinner v-if="isEditing" size="sm" />
                <span>{{ isEditing ? 'Salvando...' : 'Salvar' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
