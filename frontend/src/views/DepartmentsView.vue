<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { departmentsApi, operatorsApi } from '@/api'
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Users,
  Clock,
  Settings2,
  ChevronDown,
  ChevronUp,
  UserPlus,
  UserMinus
} from 'lucide-vue-next'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import { useToast } from 'vue-toastification'
import type { Department, DepartmentPayload, Operator, DaySchedule } from '@/types'
import ExcelActions from '@/components/ui/ExcelActions.vue'

const toast = useToast()

const departments = ref<Department[]>([])
const operators = ref<Operator[]>([])
const isLoading = ref(true)
const showModal = ref(false)
const editingDepartment = ref<Department | null>(null)
const deleteConfirm = ref<Department | null>(null)
const expandedDepartment = ref<string | null>(null)

// Form
const defaultSchedule: DaySchedule = { enabled: true, start: '09:00', end: '18:00' }
const form = ref<DepartmentPayload & { settings: Department['settings'] }>({
  name: '',
  description: '',
  color: '#cd2649',
  isActive: true,
  settings: {
    maxConcurrentChats: 5,
    autoAssign: true,
    welcomeMessage: '',
    offlineMessage: '',
    priority: 1,
    businessHours: {
      enabled: false,
      timezone: 'America/Sao_Paulo',
      schedule: {
        monday: { ...defaultSchedule },
        tuesday: { ...defaultSchedule },
        wednesday: { ...defaultSchedule },
        thursday: { ...defaultSchedule },
        friday: { ...defaultSchedule },
        saturday: { enabled: false, start: '09:00', end: '13:00' },
        sunday: { enabled: false, start: '09:00', end: '13:00' }
      }
    }
  }
})

const availableOperators = computed(() => {
  if (!editingDepartment.value) return operators.value
  return operators.value.filter(op => !editingDepartment.value!.operators.includes(op._id))
})

async function fetchData() {
  isLoading.value = true
  try {
    const [deptRes, opRes] = await Promise.all([
      departmentsApi.list(),
      operatorsApi.list()
    ])
    if (deptRes.data) departments.value = deptRes.data as Department[]
    if (opRes.data) operators.value = opRes.data as Operator[]
  } catch {
    toast.error('Erro ao carregar departamentos')
  } finally {
    isLoading.value = false
  }
}

function openCreateModal() {
  editingDepartment.value = null
  resetForm()
  showModal.value = true
}

function openEditModal(dept: Department) {
  editingDepartment.value = dept
  form.value = {
    name: dept.name,
    description: dept.description || '',
    color: dept.color,
    isActive: dept.isActive,
    settings: { ...dept.settings }
  }
  showModal.value = true
}

function resetForm() {
  form.value = {
    name: '',
    description: '',
    color: '#cd2649',
    isActive: true,
    settings: {
      maxConcurrentChats: 5,
      autoAssign: true,
      welcomeMessage: '',
      offlineMessage: '',
      priority: 1,
      businessHours: {
        enabled: false,
        timezone: 'America/Sao_Paulo',
        schedule: {
          monday: { ...defaultSchedule },
          tuesday: { ...defaultSchedule },
          wednesday: { ...defaultSchedule },
          thursday: { ...defaultSchedule },
          friday: { ...defaultSchedule },
          saturday: { enabled: false, start: '09:00', end: '13:00' },
          sunday: { enabled: false, start: '09:00', end: '13:00' }
        }
      }
    }
  }
}

async function saveDepartment() {
  if (!form.value.name.trim()) {
    toast.error('Nome é obrigatório')
    return
  }

  try {
    if (editingDepartment.value) {
      await departmentsApi.update(editingDepartment.value._id, form.value)
      toast.success('Departamento atualizado')
    } else {
      await departmentsApi.create(form.value)
      toast.success('Departamento criado')
    }
    showModal.value = false
    fetchData()
  } catch {
    toast.error('Erro ao salvar departamento')
  }
}

async function deleteDepartment() {
  if (!deleteConfirm.value) return
  try {
    await departmentsApi.delete(deleteConfirm.value._id)
    toast.success('Departamento excluído')
    deleteConfirm.value = null
    fetchData()
  } catch {
    toast.error('Erro ao excluir departamento')
  }
}

async function addOperatorToDepartment(deptId: string, operatorId: string) {
  try {
    await departmentsApi.addOperator(deptId, operatorId)
    toast.success('Operador adicionado ao departamento')
    fetchData()
  } catch {
    toast.error('Erro ao adicionar operador')
  }
}

async function removeOperatorFromDepartment(deptId: string, operatorId: string) {
  try {
    await departmentsApi.removeOperator(deptId, operatorId)
    toast.success('Operador removido do departamento')
    fetchData()
  } catch {
    toast.error('Erro ao remover operador')
  }
}

function toggleExpand(deptId: string) {
  expandedDepartment.value = expandedDepartment.value === deptId ? null : deptId
}

function getOperatorById(id: string) {
  return operators.value.find(op => op._id === id)
}

const weekDays = [
  { key: 'monday', label: 'Segunda' },
  { key: 'tuesday', label: 'Terça' },
  { key: 'wednesday', label: 'Quarta' },
  { key: 'thursday', label: 'Quinta' },
  { key: 'friday', label: 'Sexta' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' }
] as const

// Excel handlers
const exportData = computed(() => {
  return departments.value.map(dept => ({
    Nome: dept.name,
    Descrição: dept.description || '',
    Cor: dept.color,
    Status: dept.isActive ? 'Ativo' : 'Inativo',
    'Nº Operadores': dept.operators.length,
    'Max Chats Simultâneos': dept.settings.maxConcurrentChats,
    'Auto Atribuir': dept.settings.autoAssign ? 'Sim' : 'Não',
    Prioridade: dept.settings.priority,
    'Criado em': dept.createdAt ? new Date(dept.createdAt).toLocaleString('pt-BR') : '',
  }))
})

async function handleImport(data: any[]) {
  const validDepartments = data.filter(row => row.Nome || row.name)

  if (validDepartments.length === 0) {
    toast.error('Nenhum departamento válido encontrado no arquivo')
    return
  }

  let created = 0
  let failed = 0

  for (const row of validDepartments) {
    try {
      const name = row.Nome || row.name
      const description = row.Descrição || row.description || ''
      const color = row.Cor || row.color || '#cd2649'
      const isActive = row.Status?.toLowerCase() === 'ativo' || row.status?.toLowerCase() === 'ativo' || true

      await departmentsApi.create({
        name,
        description,
        color,
        isActive,
        settings: {
          maxConcurrentChats: row['Max Chats Simultâneos'] || row.maxChats || 5,
          autoAssign: row['Auto Atribuir']?.toLowerCase() === 'sim' || true,
          welcomeMessage: '',
          offlineMessage: '',
          priority: row.Prioridade || row.priority || 1,
          businessHours: {
            enabled: false,
            timezone: 'America/Sao_Paulo',
            schedule: {
              monday: { ...defaultSchedule },
              tuesday: { ...defaultSchedule },
              wednesday: { ...defaultSchedule },
              thursday: { ...defaultSchedule },
              friday: { ...defaultSchedule },
              saturday: { enabled: false, start: '09:00', end: '13:00' },
              sunday: { enabled: false, start: '09:00', end: '13:00' }
            }
          }
        }
      })
      created++
    } catch (error) {
      console.error('Erro ao criar departamento:', error)
      failed++
    }
  }

  if (created > 0) {
    toast.success(`${created} departamento(s) importado(s) com sucesso!`)
    fetchData()
  }

  if (failed > 0) {
    toast.warning(`${failed} departamento(s) falharam ao importar (podem já existir)`)
  }
}

onMounted(fetchData)
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Departamentos</h1>
        <p class="text-gray-500">Gerencie os departamentos de atendimento</p>
      </div>
      <div class="flex flex-col sm:flex-row gap-2">
        <ExcelActions
          :data="exportData"
          :export-options="{
            filename: 'departamentos.xlsx',
            sheetName: 'Departamentos'
          }"
          :on-import="handleImport"
        />
        <button @click="openCreateModal" class="btn-primary">
          <Plus class="w-4 h-4" />
          Novo Departamento
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <LoadingSpinner size="lg" />
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else-if="departments.length === 0"
      title="Nenhum departamento"
      description="Crie departamentos para organizar seu atendimento."
    >
      <template #icon>
        <Building2 class="w-8 h-8 text-gray-400" />
      </template>
      <template #action>
        <button @click="openCreateModal" class="btn-primary">
          <Plus class="w-4 h-4" />
          Criar Departamento
        </button>
      </template>
    </EmptyState>

    <!-- Departments List -->
    <div v-else class="space-y-4">
      <div
        v-for="dept in departments"
        :key="dept._id"
        class="card overflow-hidden"
      >
        <!-- Header -->
        <div
          class="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
          @click="toggleExpand(dept._id)"
        >
          <div class="flex items-center gap-4">
            <div
              class="w-12 h-12 rounded-xl flex items-center justify-center"
              :style="{ backgroundColor: dept.color + '20' }"
            >
              <Building2 class="w-6 h-6" :style="{ color: dept.color }" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-semibold text-gray-900">{{ dept.name }}</h3>
                <span
                  :class="dept.isActive ? 'badge-success' : 'badge-neutral'"
                >
                  {{ dept.isActive ? 'Ativo' : 'Inativo' }}
                </span>
              </div>
              <p class="text-sm text-gray-500">
                {{ dept.operators.length }} operadores
                <span v-if="dept.description"> · {{ dept.description }}</span>
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              @click.stop="openEditModal(dept)"
              class="btn-ghost btn-sm"
            >
              <Edit2 class="w-4 h-4" />
            </button>
            <button
              @click.stop="deleteConfirm = dept"
              class="btn-ghost btn-sm text-red-600"
            >
              <Trash2 class="w-4 h-4" />
            </button>
            <component
              :is="expandedDepartment === dept._id ? ChevronUp : ChevronDown"
              class="w-5 h-5 text-gray-400"
            />
          </div>
        </div>

        <!-- Expanded Content -->
        <div
          v-if="expandedDepartment === dept._id"
          class="border-t border-gray-200 p-4 bg-gray-50"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Settings -->
            <div>
              <h4 class="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Settings2 class="w-4 h-4" />
                Configurações
              </h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-500">Chats simultâneos</span>
                  <span class="font-medium">{{ dept.settings.maxConcurrentChats }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">Auto-atribuição</span>
                  <span class="font-medium">{{ dept.settings.autoAssign ? 'Sim' : 'Não' }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">Prioridade</span>
                  <span class="font-medium">{{ dept.settings.priority }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">Horário comercial</span>
                  <span class="font-medium">{{ dept.settings.businessHours.enabled ? 'Ativo' : 'Inativo' }}</span>
                </div>
              </div>
            </div>

            <!-- Operators -->
            <div>
              <h4 class="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Users class="w-4 h-4" />
                Operadores ({{ dept.operators.length }})
              </h4>
              <div class="space-y-2">
                <div
                  v-for="opId in dept.operators"
                  :key="opId"
                  class="flex items-center justify-between p-2 bg-white rounded-lg"
                >
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <span class="text-xs font-medium text-gray-600">
                        {{ getOperatorById(opId)?.name?.charAt(0) || '?' }}
                      </span>
                    </div>
                    <span class="text-sm font-medium">
                      {{ getOperatorById(opId)?.name || 'Operador não encontrado' }}
                    </span>
                  </div>
                  <button
                    @click="removeOperatorFromDepartment(dept._id, opId)"
                    class="btn-ghost btn-sm text-red-600"
                  >
                    <UserMinus class="w-4 h-4" />
                  </button>
                </div>

                <!-- Add operator dropdown -->
                <div v-if="operators.filter(op => !dept.operators.includes(op._id)).length > 0" class="mt-2">
                  <select
                    class="select text-sm"
                    @change="(e: any) => { if (e.target.value) { addOperatorToDepartment(dept._id, e.target.value); e.target.value = '' } }"
                  >
                    <option value="">+ Adicionar operador...</option>
                    <option
                      v-for="op in operators.filter(o => !dept.operators.includes(o._id))"
                      :key="op._id"
                      :value="op._id"
                    >
                      {{ op.name }}
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
          <div class="p-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">
              {{ editingDepartment ? 'Editar Departamento' : 'Novo Departamento' }}
            </h2>
          </div>

          <form @submit.prevent="saveDepartment" class="p-4 space-y-6 max-h-[70vh] overflow-y-auto">
            <!-- Basic Info -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="label">Nome *</label>
                <input v-model="form.name" type="text" class="input" required />
              </div>
              <div>
                <label class="label">Cor</label>
                <div class="flex gap-2">
                  <input v-model="form.color" type="color" class="w-12 h-10 rounded cursor-pointer" />
                  <input v-model="form.color" type="text" class="input flex-1" />
                </div>
              </div>
            </div>

            <div>
              <label class="label">Descrição</label>
              <textarea v-model="form.description" class="textarea" rows="2" />
            </div>

            <div class="flex items-center gap-2">
              <input type="checkbox" id="isActive" v-model="form.isActive" class="w-4 h-4" />
              <label for="isActive" class="text-sm text-gray-700">Departamento ativo</label>
            </div>

            <!-- Settings -->
            <div class="border-t border-gray-200 pt-4">
              <h3 class="font-medium text-gray-900 mb-4">Configurações</h3>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="label">Máx. chats simultâneos</label>
                  <input v-model.number="form.settings.maxConcurrentChats" type="number" min="1" class="input" />
                </div>
                <div>
                  <label class="label">Prioridade</label>
                  <input v-model.number="form.settings.priority" type="number" min="1" class="input" />
                </div>
              </div>

              <div class="flex items-center gap-2 mt-4">
                <input type="checkbox" id="autoAssign" v-model="form.settings.autoAssign" class="w-4 h-4" />
                <label for="autoAssign" class="text-sm text-gray-700">Auto-atribuir conversas aos operadores</label>
              </div>

              <div class="mt-4">
                <label class="label">Mensagem de boas-vindas</label>
                <textarea v-model="form.settings.welcomeMessage" class="textarea" rows="2" placeholder="Olá! Como posso ajudar?" />
              </div>

              <div class="mt-4">
                <label class="label">Mensagem fora do horário</label>
                <textarea v-model="form.settings.offlineMessage" class="textarea" rows="2" placeholder="No momento estamos fora do horário de atendimento..." />
              </div>
            </div>

            <!-- Business Hours -->
            <div class="border-t border-gray-200 pt-4">
              <div class="flex items-center justify-between mb-4">
                <h3 class="font-medium text-gray-900">Horário de Atendimento</h3>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" v-model="form.settings.businessHours.enabled" class="w-4 h-4" />
                  <span class="text-sm text-gray-700">Ativar</span>
                </label>
              </div>

              <div v-if="form.settings.businessHours.enabled" class="space-y-3">
                <div
                  v-for="day in weekDays"
                  :key="day.key"
                  class="flex items-center gap-4"
                >
                  <label class="flex items-center gap-2 w-32">
                    <input
                      type="checkbox"
                      v-model="form.settings.businessHours.schedule[day.key].enabled"
                      class="w-4 h-4"
                    />
                    <span class="text-sm">{{ day.label }}</span>
                  </label>
                  <input
                    v-model="form.settings.businessHours.schedule[day.key].start"
                    type="time"
                    class="input w-32"
                    :disabled="!form.settings.businessHours.schedule[day.key].enabled"
                  />
                  <span class="text-gray-400">até</span>
                  <input
                    v-model="form.settings.businessHours.schedule[day.key].end"
                    type="time"
                    class="input w-32"
                    :disabled="!form.settings.businessHours.schedule[day.key].enabled"
                  />
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-3 pt-4 border-t border-gray-200">
              <button type="button" @click="showModal = false" class="btn-secondary flex-1">
                Cancelar
              </button>
              <button type="submit" class="btn-primary flex-1">
                {{ editingDepartment ? 'Salvar' : 'Criar' }}
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
        title="Excluir departamento"
        :message="`Tem certeza que deseja excluir o departamento '${deleteConfirm.name}'?`"
        variant="danger"
        @confirm="deleteDepartment"
        @cancel="deleteConfirm = null"
      />
    </Teleport>
  </div>
</template>
