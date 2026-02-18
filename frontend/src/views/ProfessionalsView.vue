<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { RefreshCw, Edit3, Trash2, Plus, UserCircle, Phone, Mail } from 'lucide-vue-next'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import { professionalsApi, servicesApi } from '@/api'
import type { Professional, ProfessionalPayload, Service } from '@/types'

const toast = useToast()
const professionals = ref<Professional[]>([])
const services = ref<Service[]>([])
const isLoading = ref(true)
const isSaving = ref(false)
const showEditModal = ref(false)
const editTarget = ref<Professional | null>(null)
const editForm = ref<ProfessionalPayload>({ name: '', color: '#6366F1' })
const isEditing = ref(false)
const newProfessional = ref<ProfessionalPayload>({ name: '', color: '#6366F1', serviceIds: [], phone: '', email: '' })

const presetColors = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16',
  '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
  '#6366F1', '#8B5CF6', '#A855F7', '#EC4899'
]

function getServiceName(serviceId: string): string {
  return services.value.find(s => s._id === serviceId)?.name || serviceId
}

async function fetchData() {
  isLoading.value = true
  try {
    const [profRes, svcRes] = await Promise.all([
      professionalsApi.list(),
      servicesApi.list(),
    ])
    if (profRes.data) professionals.value = profRes.data
    if (svcRes.data) services.value = svcRes.data
  } catch {
    toast.error('Erro ao carregar dados')
  } finally {
    isLoading.value = false
  }
}

async function createProfessional() {
  const payload: ProfessionalPayload = {
    name: newProfessional.value.name.trim(),
    color: newProfessional.value.color,
    serviceIds: newProfessional.value.serviceIds || [],
    phone: newProfessional.value.phone?.trim() || undefined,
    email: newProfessional.value.email?.trim() || undefined,
  }

  if (!payload.name) {
    toast.error('Informe o nome do profissional')
    return
  }

  isSaving.value = true
  try {
    await professionalsApi.create(payload)
    toast.success('Profissional criado com sucesso')
    newProfessional.value = { name: '', color: '#6366F1', serviceIds: [], phone: '', email: '' }
    fetchData()
  } catch {
    toast.error('Erro ao criar profissional')
  } finally {
    isSaving.value = false
  }
}

function openEditModal(prof: Professional) {
  editTarget.value = prof
  editForm.value = {
    name: prof.name,
    color: prof.color,
    serviceIds: [...prof.serviceIds],
    phone: prof.phone || '',
    email: prof.email || '',
    isActive: prof.isActive,
  }
  showEditModal.value = true
}

function closeEditModal() {
  showEditModal.value = false
  editTarget.value = null
}

async function saveEdit() {
  if (!editTarget.value) return

  const payload: Partial<ProfessionalPayload> = {
    name: editForm.value.name.trim(),
    color: editForm.value.color,
    serviceIds: editForm.value.serviceIds || [],
    phone: editForm.value.phone?.trim() || undefined,
    email: editForm.value.email?.trim() || undefined,
    isActive: editForm.value.isActive,
  }

  if (!payload.name) {
    toast.error('Informe o nome do profissional')
    return
  }

  isEditing.value = true
  try {
    await professionalsApi.update(editTarget.value._id, payload)
    toast.success('Profissional atualizado')
    closeEditModal()
    fetchData()
  } catch {
    toast.error('Erro ao atualizar profissional')
  } finally {
    isEditing.value = false
  }
}

async function deleteProfessional(id: string) {
  if (!window.confirm('Tem certeza que deseja remover este profissional?')) return

  try {
    await professionalsApi.delete(id)
    toast.success('Profissional removido')
    fetchData()
  } catch {
    toast.error('Erro ao remover profissional')
  }
}

function toggleService(serviceId: string, target: ProfessionalPayload) {
  if (!target.serviceIds) target.serviceIds = []
  const idx = target.serviceIds.indexOf(serviceId)
  if (idx >= 0) {
    target.serviceIds.splice(idx, 1)
  } else {
    target.serviceIds.push(serviceId)
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
        <h1 class="text-2xl font-bold text-gray-900">Profissionais</h1>
        <p class="text-gray-500">Gerencie os profissionais que atendem na agenda.</p>
      </div>
      <button @click="fetchData" class="btn-outline">
        <RefreshCw class="w-4 h-4" />
        Atualizar
      </button>
    </div>

    <!-- Stats -->
    <div class="bg-white rounded-xl border border-gray-200 p-4 w-fit">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
          <UserCircle class="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900">{{ professionals.length }}</p>
          <p class="text-xs text-gray-500">Profissionais cadastrados</p>
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
            <h2 class="font-semibold text-gray-900">Novo Profissional</h2>
            <p class="text-xs text-gray-500">Pessoa que atende na agenda</p>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <label class="label">Nome</label>
            <input
              v-model="newProfessional.name"
              type="text"
              class="input"
              placeholder="Ex: Dr. Carlos, Dra. Ana..."
            />
          </div>

          <div>
            <label class="label">Telefone (opcional)</label>
            <input
              v-model="newProfessional.phone"
              type="text"
              class="input"
              placeholder="(11) 99999-9999"
            />
          </div>

          <div>
            <label class="label">Email (opcional)</label>
            <input
              v-model="newProfessional.email"
              type="email"
              class="input"
              placeholder="email@exemplo.com"
            />
          </div>

          <div>
            <label class="label">Cor</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="color in presetColors"
                :key="color"
                type="button"
                @click="newProfessional.color = color"
                class="w-8 h-8 rounded-full border-2 transition-all hover:scale-110"
                :class="newProfessional.color === color ? 'border-gray-900 scale-110' : 'border-transparent'"
                :style="{ backgroundColor: color }"
              />
            </div>
          </div>

          <div v-if="services.length > 0">
            <label class="label">Servicos que realiza</label>
            <div class="space-y-2 max-h-40 overflow-y-auto">
              <label
                v-for="svc in services"
                :key="svc._id"
                class="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                :class="newProfessional.serviceIds?.includes(svc._id) ? 'bg-primary-50 border-primary-200' : ''"
              >
                <input
                  type="checkbox"
                  :checked="newProfessional.serviceIds?.includes(svc._id)"
                  @change="toggleService(svc._id, newProfessional)"
                  class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div
                  class="w-3 h-3 rounded-full flex-shrink-0"
                  :style="{ backgroundColor: svc.color }"
                />
                <span class="text-sm text-gray-700">{{ svc.name }}</span>
              </label>
            </div>
          </div>

          <button
            @click="createProfessional"
            class="btn-primary w-full justify-center"
            :disabled="isSaving || !newProfessional.name.trim()"
          >
            <Plus v-if="!isSaving" class="w-4 h-4" />
            <LoadingSpinner v-else size="sm" />
            <span>{{ isSaving ? 'Salvando...' : 'Criar Profissional' }}</span>
          </button>
        </div>
      </div>

      <!-- List -->
      <div class="lg:col-span-2">
        <div v-if="isLoading" class="bg-white rounded-xl border border-gray-200 flex items-center justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>

        <div v-else-if="professionals.length === 0" class="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div class="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <UserCircle class="w-8 h-8 text-gray-400" />
          </div>
          <h3 class="font-semibold text-gray-900 mb-1">Nenhum profissional cadastrado</h3>
          <p class="text-sm text-gray-500">Crie seu primeiro profissional usando o formulario ao lado.</p>
        </div>

        <div v-else class="grid gap-3 sm:grid-cols-2">
          <div
            v-for="prof in professionals"
            :key="prof._id"
            class="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors group"
          >
            <div class="flex items-start gap-3">
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
                :style="{ backgroundColor: prof.color }"
              >
                {{ prof.name.charAt(0).toUpperCase() }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <p class="font-medium text-gray-900 truncate">{{ prof.name }}</p>
                  <span
                    v-if="!prof.isActive"
                    class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-500"
                  >Inativo</span>
                </div>
                <div v-if="prof.phone || prof.email" class="flex flex-wrap items-center gap-2 mt-1">
                  <span v-if="prof.phone" class="flex items-center gap-1 text-xs text-gray-400">
                    <Phone class="w-3 h-3" /> {{ prof.phone }}
                  </span>
                  <span v-if="prof.email" class="flex items-center gap-1 text-xs text-gray-400">
                    <Mail class="w-3 h-3" /> {{ prof.email }}
                  </span>
                </div>
                <div v-if="prof.serviceIds.length > 0" class="flex flex-wrap gap-1 mt-2">
                  <span
                    v-for="sid in prof.serviceIds"
                    :key="sid"
                    class="px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-600"
                  >{{ getServiceName(sid) }}</span>
                </div>
              </div>
              <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  @click="openEditModal(prof)"
                  class="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                  title="Editar"
                >
                  <Edit3 class="w-4 h-4" />
                </button>
                <button
                  @click="deleteProfessional(prof._id)"
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
              <h2 class="font-semibold text-gray-900">Editar Profissional</h2>
              <p class="text-xs text-gray-500">Atualize os dados do profissional</p>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <label class="label">Nome</label>
              <input v-model="editForm.name" type="text" class="input" />
            </div>

            <div>
              <label class="label">Telefone (opcional)</label>
              <input v-model="editForm.phone" type="text" class="input" />
            </div>

            <div>
              <label class="label">Email (opcional)</label>
              <input v-model="editForm.email" type="email" class="input" />
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

            <div v-if="services.length > 0">
              <label class="label">Servicos que realiza</label>
              <div class="space-y-2 max-h-40 overflow-y-auto">
                <label
                  v-for="svc in services"
                  :key="svc._id"
                  class="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                  :class="editForm.serviceIds?.includes(svc._id) ? 'bg-primary-50 border-primary-200' : ''"
                >
                  <input
                    type="checkbox"
                    :checked="editForm.serviceIds?.includes(svc._id)"
                    @change="toggleService(svc._id, editForm)"
                    class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div
                    class="w-3 h-3 rounded-full flex-shrink-0"
                    :style="{ backgroundColor: svc.color }"
                  />
                  <span class="text-sm text-gray-700">{{ svc.name }}</span>
                </label>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="editIsActive"
                v-model="editForm.isActive"
                class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label for="editIsActive" class="text-sm text-gray-700">Ativo</label>
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
