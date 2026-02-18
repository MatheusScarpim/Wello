<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { RefreshCw, Edit3, Trash2, Plus, Briefcase, Clock } from 'lucide-vue-next'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import { servicesApi } from '@/api'
import type { Service, ServicePayload } from '@/types'

const toast = useToast()
const services = ref<Service[]>([])
const isLoading = ref(true)
const isSaving = ref(false)
const showEditModal = ref(false)
const editTarget = ref<Service | null>(null)
const editForm = ref<ServicePayload>({ name: '', defaultDuration: 30, color: '#6366F1' })
const isEditing = ref(false)
const newService = ref<ServicePayload>({ name: '', defaultDuration: 30, color: '#6366F1', description: '' })

const presetColors = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16',
  '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
  '#6366F1', '#8B5CF6', '#A855F7', '#EC4899'
]

const durationOptions = [15, 20, 30, 45, 60, 90, 120]

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

async function fetchServices() {
  isLoading.value = true
  try {
    const response = await servicesApi.list()
    if (response.data) {
      services.value = response.data
    }
  } catch {
    toast.error('Erro ao carregar servicos')
  } finally {
    isLoading.value = false
  }
}

async function createService() {
  const payload: ServicePayload = {
    name: newService.value.name.trim(),
    defaultDuration: newService.value.defaultDuration,
    color: newService.value.color,
    description: newService.value.description?.trim() || undefined,
  }

  if (!payload.name) {
    toast.error('Informe o nome do servico')
    return
  }

  isSaving.value = true
  try {
    await servicesApi.create(payload)
    toast.success('Servico criado com sucesso')
    newService.value = { name: '', defaultDuration: 30, color: '#6366F1', description: '' }
    fetchServices()
  } catch {
    toast.error('Erro ao criar servico')
  } finally {
    isSaving.value = false
  }
}

function openEditModal(service: Service) {
  editTarget.value = service
  editForm.value = {
    name: service.name,
    defaultDuration: service.defaultDuration,
    color: service.color,
    description: service.description || '',
  }
  showEditModal.value = true
}

function closeEditModal() {
  showEditModal.value = false
  editTarget.value = null
}

async function saveEdit() {
  if (!editTarget.value) return

  const payload: Partial<ServicePayload> = {
    name: editForm.value.name.trim(),
    defaultDuration: editForm.value.defaultDuration,
    color: editForm.value.color,
    description: editForm.value.description?.trim() || undefined,
  }

  if (!payload.name) {
    toast.error('Informe o nome do servico')
    return
  }

  isEditing.value = true
  try {
    await servicesApi.update(editTarget.value._id, payload)
    toast.success('Servico atualizado')
    closeEditModal()
    fetchServices()
  } catch {
    toast.error('Erro ao atualizar servico')
  } finally {
    isEditing.value = false
  }
}

async function deleteService(id: string) {
  if (!window.confirm('Tem certeza que deseja remover este servico?')) return

  try {
    await servicesApi.delete(id)
    toast.success('Servico removido')
    fetchServices()
  } catch {
    toast.error('Erro ao remover servico')
  }
}

onMounted(() => {
  fetchServices()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Servicos</h1>
        <p class="text-gray-500">Gerencie os tipos de atendimento e suas duracoes.</p>
      </div>
      <button @click="fetchServices" class="btn-outline">
        <RefreshCw class="w-4 h-4" />
        Atualizar
      </button>
    </div>

    <!-- Stats -->
    <div class="bg-white rounded-xl border border-gray-200 p-4 w-fit">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
          <Briefcase class="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900">{{ services.length }}</p>
          <p class="text-xs text-gray-500">Servicos cadastrados</p>
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
            <h2 class="font-semibold text-gray-900">Novo Servico</h2>
            <p class="text-xs text-gray-500">Tipo de atendimento com duracao padrao</p>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <label class="label">Nome</label>
            <input
              v-model="newService.name"
              type="text"
              class="input"
              placeholder="Ex: Consulta, Retorno, Avaliacao..."
            />
          </div>

          <div>
            <label class="label">Duracao padrao</label>
            <select v-model="newService.defaultDuration" class="input">
              <option v-for="d in durationOptions" :key="d" :value="d">
                {{ formatDuration(d) }}
              </option>
            </select>
          </div>

          <div>
            <label class="label">Cor</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="color in presetColors"
                :key="color"
                type="button"
                @click="newService.color = color"
                class="w-8 h-8 rounded-full border-2 transition-all hover:scale-110"
                :class="newService.color === color ? 'border-gray-900 scale-110' : 'border-transparent'"
                :style="{ backgroundColor: color }"
              />
            </div>
          </div>

          <div>
            <label class="label">Descricao (opcional)</label>
            <textarea
              v-model="newService.description"
              class="input"
              rows="2"
              placeholder="Descricao do servico..."
            />
          </div>

          <button
            @click="createService"
            class="btn-primary w-full justify-center"
            :disabled="isSaving || !newService.name.trim()"
          >
            <Plus v-if="!isSaving" class="w-4 h-4" />
            <LoadingSpinner v-else size="sm" />
            <span>{{ isSaving ? 'Salvando...' : 'Criar Servico' }}</span>
          </button>
        </div>
      </div>

      <!-- List -->
      <div class="lg:col-span-2">
        <div v-if="isLoading" class="bg-white rounded-xl border border-gray-200 flex items-center justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>

        <div v-else-if="services.length === 0" class="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div class="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Briefcase class="w-8 h-8 text-gray-400" />
          </div>
          <h3 class="font-semibold text-gray-900 mb-1">Nenhum servico cadastrado</h3>
          <p class="text-sm text-gray-500">Crie seu primeiro servico usando o formulario ao lado.</p>
        </div>

        <div v-else class="grid gap-3 sm:grid-cols-2">
          <div
            v-for="service in services"
            :key="service._id"
            class="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:border-gray-300 transition-colors group"
          >
            <div
              class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              :style="{ backgroundColor: service.color + '20' }"
            >
              <Briefcase class="w-5 h-5" :style="{ color: service.color }" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <p class="font-medium text-gray-900 truncate">{{ service.name }}</p>
                <div
                  class="w-3 h-3 rounded-full flex-shrink-0"
                  :style="{ backgroundColor: service.color }"
                />
              </div>
              <div class="flex items-center gap-1 text-xs text-gray-400">
                <Clock class="w-3 h-3" />
                <span>{{ formatDuration(service.defaultDuration) }}</span>
              </div>
              <p v-if="service.description" class="text-xs text-gray-400 truncate mt-0.5">{{ service.description }}</p>
            </div>
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                @click="openEditModal(service)"
                class="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                title="Editar"
              >
                <Edit3 class="w-4 h-4" />
              </button>
              <button
                @click="deleteService(service._id)"
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
              <h2 class="font-semibold text-gray-900">Editar Servico</h2>
              <p class="text-xs text-gray-500">Atualize os dados do servico</p>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <label class="label">Nome</label>
              <input v-model="editForm.name" type="text" class="input" />
            </div>

            <div>
              <label class="label">Duracao padrao</label>
              <select v-model="editForm.defaultDuration" class="input">
                <option v-for="d in durationOptions" :key="d" :value="d">
                  {{ formatDuration(d) }}
                </option>
              </select>
            </div>

            <div>
              <label class="label">Cor</label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="color in presetColors"
                  :key="color"
                  type="button"
                  @click="editForm.color = color"
                  class="w-8 h-8 rounded-full border-2 transition-all hover:scale-110"
                  :class="editForm.color === color ? 'border-gray-900 scale-110' : 'border-transparent'"
                  :style="{ backgroundColor: color }"
                />
              </div>
            </div>

            <div>
              <label class="label">Descricao (opcional)</label>
              <textarea
                v-model="editForm.description"
                class="input"
                rows="2"
                placeholder="Descricao do servico..."
              />
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
