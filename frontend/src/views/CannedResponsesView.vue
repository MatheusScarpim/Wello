<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useToast } from 'vue-toastification'
import { RefreshCw, Edit3, Trash2, Plus, Zap, Search, Globe, Building2 } from 'lucide-vue-next'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import { cannedResponsesApi, departmentsApi } from '@/api'
import type { CannedResponse, CannedResponsePayload, Department } from '@/types'

const toast = useToast()
const responses = ref<CannedResponse[]>([])
const departments = ref<Department[]>([])
const isLoading = ref(true)
const isSaving = ref(false)
const showEditModal = ref(false)
const editTarget = ref<CannedResponse | null>(null)
const editForm = ref<CannedResponsePayload>({ shortcut: '', title: '', content: '', isGlobal: true })
const isEditing = ref(false)
const searchQuery = ref('')

const newResponse = ref<CannedResponsePayload>({
  shortcut: '',
  title: '',
  content: '',
  departmentId: undefined,
  isGlobal: true,
})

const filteredResponses = computed(() => {
  if (!searchQuery.value) return responses.value
  const term = searchQuery.value.toLowerCase()
  return responses.value.filter(
    (r) =>
      r.title.toLowerCase().includes(term) ||
      r.shortcut.toLowerCase().includes(term) ||
      r.content.toLowerCase().includes(term),
  )
})

function getDepartmentName(id?: string) {
  if (!id) return null
  return departments.value.find((d) => d._id === id)?.name || null
}

async function fetchData() {
  isLoading.value = true
  try {
    const [resResp, resDept] = await Promise.all([
      cannedResponsesApi.list(),
      departmentsApi.list(),
    ])
    if (resResp.data) responses.value = resResp.data
    if (resDept.data) departments.value = resDept.data
  } catch {
    toast.error('Erro ao carregar respostas rapidas')
  } finally {
    isLoading.value = false
  }
}

async function createResponse() {
  const payload: CannedResponsePayload = {
    shortcut: newResponse.value.shortcut.trim(),
    title: newResponse.value.title.trim(),
    content: newResponse.value.content.trim(),
    isGlobal: newResponse.value.isGlobal,
  }

  if (!newResponse.value.isGlobal && newResponse.value.departmentId) {
    payload.departmentId = newResponse.value.departmentId
  }

  if (!payload.shortcut || !payload.title || !payload.content) {
    toast.error('Preencha atalho, titulo e conteudo')
    return
  }

  isSaving.value = true
  try {
    await cannedResponsesApi.create(payload)
    toast.success('Resposta rapida criada com sucesso')
    newResponse.value = { shortcut: '', title: '', content: '', departmentId: undefined, isGlobal: true }
    fetchData()
  } catch {
    toast.error('Erro ao criar resposta rapida')
  } finally {
    isSaving.value = false
  }
}

function openEditModal(item: CannedResponse) {
  editTarget.value = item
  editForm.value = {
    shortcut: item.shortcut,
    title: item.title,
    content: item.content,
    departmentId: item.departmentId,
    isGlobal: item.isGlobal,
  }
  showEditModal.value = true
}

function closeEditModal() {
  showEditModal.value = false
  editTarget.value = null
}

async function saveEdit() {
  if (!editTarget.value) return

  const payload: Partial<CannedResponsePayload> = {
    shortcut: editForm.value.shortcut.trim(),
    title: editForm.value.title.trim(),
    content: editForm.value.content.trim(),
    isGlobal: editForm.value.isGlobal,
  }

  if (!editForm.value.isGlobal && editForm.value.departmentId) {
    payload.departmentId = editForm.value.departmentId
  } else {
    payload.departmentId = undefined
  }

  if (!payload.shortcut || !payload.title || !payload.content) {
    toast.error('Preencha atalho, titulo e conteudo')
    return
  }

  isEditing.value = true
  try {
    await cannedResponsesApi.update(editTarget.value._id, payload)
    toast.success('Resposta rapida atualizada')
    closeEditModal()
    fetchData()
  } catch {
    toast.error('Erro ao atualizar resposta rapida')
  } finally {
    isEditing.value = false
  }
}

async function deleteResponse(id: string) {
  if (!window.confirm('Tem certeza que deseja remover esta resposta rapida?')) return

  try {
    await cannedResponsesApi.delete(id)
    toast.success('Resposta rapida removida')
    fetchData()
  } catch {
    toast.error('Erro ao remover resposta rapida')
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Respostas Rapidas</h1>
        <p class="text-gray-500">Gerencie atalhos de mensagens para agilizar o atendimento.</p>
      </div>
      <button @click="fetchData" class="btn-outline">
        <RefreshCw class="w-4 h-4" />
        Atualizar
      </button>
    </div>

    <!-- Stats Card -->
    <div class="bg-white rounded-xl border border-gray-200 p-4 w-fit">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
          <Zap class="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900">{{ responses.length }}</p>
          <p class="text-xs text-gray-500">Respostas cadastradas</p>
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
            <h2 class="font-semibold text-gray-900">Nova Resposta</h2>
            <p class="text-xs text-gray-500">Crie um atalho de mensagem</p>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <label class="label">Atalho</label>
            <input
              v-model="newResponse.shortcut"
              type="text"
              class="input"
              placeholder="Ex: /saudacao, /preco, /obrigado"
            />
          </div>

          <div>
            <label class="label">Titulo</label>
            <input
              v-model="newResponse.title"
              type="text"
              class="input"
              placeholder="Ex: Saudacao inicial"
            />
          </div>

          <div>
            <label class="label">Conteudo da mensagem</label>
            <textarea
              v-model="newResponse.content"
              class="input"
              rows="4"
              placeholder="Ola! Seja bem-vindo(a)! Como posso ajuda-lo(a) hoje?"
            />
          </div>

          <!-- Global toggle -->
          <div>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                v-model="newResponse.isGlobal"
                class="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span class="text-sm text-gray-700">Disponivel para todos os departamentos</span>
            </label>
          </div>

          <!-- Department select (only if not global) -->
          <div v-if="!newResponse.isGlobal">
            <label class="label">Departamento</label>
            <select v-model="newResponse.departmentId" class="input">
              <option :value="undefined">Selecione...</option>
              <option v-for="dept in departments" :key="dept._id" :value="dept._id">
                {{ dept.name }}
              </option>
            </select>
          </div>

          <button
            @click="createResponse"
            class="btn-primary w-full justify-center"
            :disabled="isSaving || !newResponse.shortcut.trim() || !newResponse.title.trim() || !newResponse.content.trim()"
          >
            <Plus v-if="!isSaving" class="w-4 h-4" />
            <LoadingSpinner v-else size="sm" />
            <span>{{ isSaving ? 'Salvando...' : 'Criar Resposta' }}</span>
          </button>
        </div>
      </div>

      <!-- List -->
      <div class="lg:col-span-2 space-y-4">
        <!-- Search -->
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            v-model="searchQuery"
            type="text"
            class="input w-full pl-10"
            placeholder="Buscar por atalho, titulo ou conteudo..."
          />
        </div>

        <div v-if="isLoading" class="bg-white rounded-xl border border-gray-200 flex items-center justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>

        <div v-else-if="filteredResponses.length === 0" class="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div class="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Zap class="w-8 h-8 text-gray-400" />
          </div>
          <h3 class="font-semibold text-gray-900 mb-1">
            {{ searchQuery ? 'Nenhum resultado' : 'Nenhuma resposta cadastrada' }}
          </h3>
          <p class="text-sm text-gray-500">
            {{ searchQuery ? 'Tente buscar com outros termos.' : 'Crie sua primeira resposta rapida usando o formulario ao lado.' }}
          </p>
        </div>

        <div v-else class="grid gap-3">
          <div
            v-for="item in filteredResponses"
            :key="item._id"
            class="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors group"
          >
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                <Zap class="w-5 h-5 text-amber-600" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-mono text-sm font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded">{{ item.shortcut }}</span>
                  <span class="font-medium text-gray-900 truncate">{{ item.title }}</span>
                </div>
                <p class="text-sm text-gray-500 line-clamp-2">{{ item.content }}</p>
                <div class="flex items-center gap-3 mt-2">
                  <span v-if="item.isGlobal" class="inline-flex items-center gap-1 text-xs text-gray-400">
                    <Globe class="w-3 h-3" />
                    Global
                  </span>
                  <span v-else-if="getDepartmentName(item.departmentId)" class="inline-flex items-center gap-1 text-xs text-gray-400">
                    <Building2 class="w-3 h-3" />
                    {{ getDepartmentName(item.departmentId) }}
                  </span>
                  <span v-if="item.usageCount > 0" class="text-xs text-gray-400">
                    {{ item.usageCount }}x usado
                  </span>
                </div>
              </div>
              <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  @click="openEditModal(item)"
                  class="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                  title="Editar"
                >
                  <Edit3 class="w-4 h-4" />
                </button>
                <button
                  @click="deleteResponse(item._id)"
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
              <h2 class="font-semibold text-gray-900">Editar Resposta Rapida</h2>
              <p class="text-xs text-gray-500">Atualize os dados da resposta</p>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <label class="label">Atalho</label>
              <input v-model="editForm.shortcut" type="text" class="input" />
            </div>

            <div>
              <label class="label">Titulo</label>
              <input v-model="editForm.title" type="text" class="input" />
            </div>

            <div>
              <label class="label">Conteudo</label>
              <textarea v-model="editForm.content" class="input" rows="4" />
            </div>

            <div>
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  v-model="editForm.isGlobal"
                  class="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span class="text-sm text-gray-700">Disponivel para todos</span>
              </label>
            </div>

            <div v-if="!editForm.isGlobal">
              <label class="label">Departamento</label>
              <select v-model="editForm.departmentId" class="input">
                <option :value="undefined">Selecione...</option>
                <option v-for="dept in departments" :key="dept._id" :value="dept._id">
                  {{ dept.name }}
                </option>
              </select>
            </div>

            <div class="flex gap-3 pt-2">
              <button @click="closeEditModal" class="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                @click="saveEdit"
                class="btn-primary flex-1 justify-center"
                :disabled="isEditing || !editForm.shortcut.trim() || !editForm.title.trim() || !editForm.content.trim()"
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
