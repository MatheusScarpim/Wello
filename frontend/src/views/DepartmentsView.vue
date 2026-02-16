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
  UserMinus,
  Search,
  Zap,
  Shield,
  ToggleLeft,
  ToggleRight,
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
const searchQuery = ref('')

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

// Computed
const filteredDepartments = computed(() => {
  if (!searchQuery.value.trim()) return departments.value
  const q = searchQuery.value.toLowerCase()
  return departments.value.filter(d =>
    d.name.toLowerCase().includes(q) ||
    (d.description && d.description.toLowerCase().includes(q))
  )
})

const stats = computed(() => ({
  total: departments.value.length,
  active: departments.value.filter(d => d.isActive).length,
  inactive: departments.value.filter(d => !d.isActive).length,
  totalOperators: new Set(departments.value.flatMap(d => d.operators)).size,
}))

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
    settings: JSON.parse(JSON.stringify(dept.settings))
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
    toast.error('Nome e obrigatorio')
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
    toast.success('Departamento excluido')
    deleteConfirm.value = null
    fetchData()
  } catch {
    toast.error('Erro ao excluir departamento')
  }
}

async function addOperatorToDepartment(deptId: string, operatorId: string) {
  try {
    await departmentsApi.addOperator(deptId, operatorId)
    toast.success('Operador adicionado')
    fetchData()
  } catch {
    toast.error('Erro ao adicionar operador')
  }
}

async function removeOperatorFromDepartment(deptId: string, operatorId: string) {
  try {
    await departmentsApi.removeOperator(deptId, operatorId)
    toast.success('Operador removido')
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

function getInitials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

const weekDays = [
  { key: 'monday', label: 'Segunda' },
  { key: 'tuesday', label: 'Terca' },
  { key: 'wednesday', label: 'Quarta' },
  { key: 'thursday', label: 'Quinta' },
  { key: 'friday', label: 'Sexta' },
  { key: 'saturday', label: 'Sabado' },
  { key: 'sunday', label: 'Domingo' }
] as const

const colorPresets = [
  '#cd2649', '#dc2626', '#ea580c', '#d97706',
  '#16a34a', '#0891b2', '#2563eb', '#7c3aed',
  '#9333ea', '#db2777', '#475569', '#000000',
]

// Excel handlers
const exportData = computed(() => {
  return departments.value.map(dept => ({
    Nome: dept.name,
    Descricao: dept.description || '',
    Cor: dept.color,
    Status: dept.isActive ? 'Ativo' : 'Inativo',
    'N Operadores': dept.operators.length,
    'Max Chats Simultaneos': dept.settings.maxConcurrentChats,
    'Auto Atribuir': dept.settings.autoAssign ? 'Sim' : 'Nao',
    Prioridade: dept.settings.priority,
    'Criado em': dept.createdAt ? new Date(dept.createdAt).toLocaleString('pt-BR') : '',
  }))
})

async function handleImport(data: any[]) {
  const validDepartments = data.filter(row => row.Nome || row.name)

  if (validDepartments.length === 0) {
    toast.error('Nenhum departamento valido encontrado no arquivo')
    return
  }

  let created = 0
  let failed = 0

  for (const row of validDepartments) {
    try {
      const name = row.Nome || row.name
      const description = row.Descricao || row.description || ''
      const color = row.Cor || row.color || '#cd2649'
      const isActive = row.Status?.toLowerCase() === 'ativo' || row.status?.toLowerCase() === 'ativo' || true

      await departmentsApi.create({
        name,
        description,
        color,
        isActive,
        settings: {
          maxConcurrentChats: row['Max Chats Simultaneos'] || row.maxChats || 5,
          autoAssign: row['Auto Atribuir']?.toLowerCase() === 'sim' || true,
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
    toast.warning(`${failed} departamento(s) falharam ao importar`)
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
        <p class="text-gray-500">Organize sua equipe em setores de atendimento</p>
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

    <!-- Stats Cards -->
    <div v-if="!isLoading && departments.length > 0" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <Building2 class="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900">{{ stats.total }}</p>
            <p class="text-xs text-gray-500">Total</p>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
            <Zap class="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900">{{ stats.active }}</p>
            <p class="text-xs text-gray-500">Ativos</p>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
            <Shield class="w-5 h-5 text-gray-500" />
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900">{{ stats.inactive }}</p>
            <p class="text-xs text-gray-500">Inativos</p>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
            <Users class="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900">{{ stats.totalOperators }}</p>
            <p class="text-xs text-gray-500">Operadores</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Search -->
    <div v-if="!isLoading && departments.length > 0" class="relative">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        v-model="searchQuery"
        type="text"
        class="input pl-10"
        placeholder="Buscar departamento..."
      />
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <LoadingSpinner size="lg" />
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else-if="departments.length === 0"
      title="Nenhum departamento"
      description="Crie departamentos para organizar seu atendimento por setores."
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

    <!-- No results -->
    <div
      v-else-if="filteredDepartments.length === 0"
      class="text-center py-12 text-gray-500"
    >
      <Search class="w-8 h-8 mx-auto mb-2 text-gray-300" />
      <p class="text-sm">Nenhum departamento encontrado para "{{ searchQuery }}"</p>
    </div>

    <!-- Departments List -->
    <div v-else class="space-y-3">
      <div
        v-for="dept in filteredDepartments"
        :key="dept._id"
        class="bg-white rounded-xl border border-gray-200 overflow-hidden transition-shadow hover:shadow-md"
      >
        <!-- Card Header -->
        <div
          class="p-4 flex items-center justify-between cursor-pointer"
          @click="toggleExpand(dept._id)"
        >
          <div class="flex items-center gap-4 min-w-0">
            <!-- Color accent + icon -->
            <div
              class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              :style="{ backgroundColor: dept.color + '15', border: `2px solid ${dept.color}30` }"
            >
              <Building2 class="w-5 h-5" :style="{ color: dept.color }" />
            </div>

            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-semibold text-gray-900 truncate">{{ dept.name }}</h3>
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                  :class="dept.isActive
                    ? 'bg-green-50 text-green-700 ring-1 ring-green-200'
                    : 'bg-gray-50 text-gray-500 ring-1 ring-gray-200'"
                >
                  {{ dept.isActive ? 'Ativo' : 'Inativo' }}
                </span>
              </div>
              <div class="flex items-center gap-3 mt-0.5">
                <span class="text-xs text-gray-500 flex items-center gap-1">
                  <Users class="w-3 h-3" />
                  {{ dept.operators.length }} operador{{ dept.operators.length !== 1 ? 'es' : '' }}
                </span>
                <span v-if="dept.settings.businessHours.enabled" class="text-xs text-gray-500 flex items-center gap-1">
                  <Clock class="w-3 h-3" />
                  Horario comercial
                </span>
                <span v-if="dept.settings.autoAssign" class="text-xs text-gray-500 flex items-center gap-1">
                  <Zap class="w-3 h-3" />
                  Auto-atribuir
                </span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1 flex-shrink-0 ml-4">
            <button
              @click.stop="openEditModal(dept)"
              class="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              title="Editar"
            >
              <Edit2 class="w-4 h-4" />
            </button>
            <button
              @click.stop="deleteConfirm = dept"
              class="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
              title="Excluir"
            >
              <Trash2 class="w-4 h-4" />
            </button>
            <div class="w-px h-6 bg-gray-200 mx-1" />
            <component
              :is="expandedDepartment === dept._id ? ChevronUp : ChevronDown"
              class="w-5 h-5 text-gray-400"
            />
          </div>
        </div>

        <!-- Description bar -->
        <div v-if="dept.description && expandedDepartment !== dept._id" class="px-4 pb-3 -mt-1">
          <p class="text-xs text-gray-400 truncate pl-16">{{ dept.description }}</p>
        </div>

        <!-- Expanded Content -->
        <div
          v-if="expandedDepartment === dept._id"
          class="border-t border-gray-100"
        >
          <!-- Description -->
          <div v-if="dept.description" class="px-6 pt-4 pb-2">
            <p class="text-sm text-gray-600">{{ dept.description }}</p>
          </div>

          <!-- Settings Grid -->
          <div class="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="bg-gray-50 rounded-lg p-3">
              <p class="text-xs text-gray-500 mb-1">Chats simultaneos</p>
              <p class="text-lg font-bold text-gray-900">{{ dept.settings.maxConcurrentChats }}</p>
            </div>
            <div class="bg-gray-50 rounded-lg p-3">
              <p class="text-xs text-gray-500 mb-1">Prioridade</p>
              <p class="text-lg font-bold text-gray-900">{{ dept.settings.priority }}</p>
            </div>
            <div class="bg-gray-50 rounded-lg p-3">
              <p class="text-xs text-gray-500 mb-1">Auto-atribuir</p>
              <div class="flex items-center gap-1.5 mt-0.5">
                <component :is="dept.settings.autoAssign ? ToggleRight : ToggleLeft"
                  class="w-5 h-5"
                  :class="dept.settings.autoAssign ? 'text-green-600' : 'text-gray-400'"
                />
                <span class="text-sm font-medium" :class="dept.settings.autoAssign ? 'text-green-700' : 'text-gray-500'">
                  {{ dept.settings.autoAssign ? 'Sim' : 'Nao' }}
                </span>
              </div>
            </div>
            <div class="bg-gray-50 rounded-lg p-3">
              <p class="text-xs text-gray-500 mb-1">Horario comercial</p>
              <div class="flex items-center gap-1.5 mt-0.5">
                <component :is="dept.settings.businessHours.enabled ? ToggleRight : ToggleLeft"
                  class="w-5 h-5"
                  :class="dept.settings.businessHours.enabled ? 'text-green-600' : 'text-gray-400'"
                />
                <span class="text-sm font-medium" :class="dept.settings.businessHours.enabled ? 'text-green-700' : 'text-gray-500'">
                  {{ dept.settings.businessHours.enabled ? 'Ativo' : 'Inativo' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Operators Section -->
          <div class="px-6 pb-5 border-t border-gray-100 pt-4">
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Users class="w-4 h-4" />
                Operadores ({{ dept.operators.length }})
              </h4>
            </div>

            <div v-if="dept.operators.length === 0" class="text-center py-4 bg-gray-50 rounded-lg">
              <Users class="w-6 h-6 text-gray-300 mx-auto mb-1" />
              <p class="text-xs text-gray-400">Nenhum operador neste departamento</p>
            </div>

            <div v-else class="flex flex-wrap gap-2 mb-3">
              <div
                v-for="opId in dept.operators"
                :key="opId"
                class="flex items-center gap-2 bg-gray-50 rounded-full pl-1 pr-2 py-1 group"
              >
                <div
                  class="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                  :style="{ backgroundColor: dept.color }"
                >
                  {{ getInitials(getOperatorById(opId)?.name) }}
                </div>
                <span class="text-xs font-medium text-gray-700">
                  {{ getOperatorById(opId)?.name || 'Desconhecido' }}
                </span>
                <button
                  @click="removeOperatorFromDepartment(dept._id, opId)"
                  class="w-5 h-5 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                  title="Remover"
                >
                  <UserMinus class="w-3 h-3" />
                </button>
              </div>
            </div>

            <!-- Add operator -->
            <div v-if="operators.filter(op => !dept.operators.includes(op._id)).length > 0">
              <select
                class="input text-sm"
                @change="(e: any) => { if (e.target.value) { addOperatorToDepartment(dept._id, e.target.value); e.target.value = '' } }"
              >
                <option value="">
                  <UserPlus class="w-3 h-3" />
                  Adicionar operador...
                </option>
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

    <!-- Create/Edit Modal -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
        @click.self="showModal = false"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
          <!-- Modal Header -->
          <div class="p-5 border-b border-gray-200 flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-xl flex items-center justify-center"
              :style="{ backgroundColor: form.color + '15', border: `2px solid ${form.color}30` }"
            >
              <Building2 class="w-5 h-5" :style="{ color: form.color }" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-gray-900">
                {{ editingDepartment ? 'Editar Departamento' : 'Novo Departamento' }}
              </h2>
              <p class="text-xs text-gray-500">Preencha as informacoes do departamento</p>
            </div>
          </div>

          <form @submit.prevent="saveDepartment" class="p-5 space-y-6 max-h-[70vh] overflow-y-auto">
            <!-- Basic Info -->
            <div>
              <label class="label">Nome *</label>
              <input v-model="form.name" type="text" class="input" placeholder="Ex: Comercial, Suporte, Financeiro..." required />
            </div>

            <div>
              <label class="label">Descricao</label>
              <textarea v-model="form.description" class="input min-h-[60px] resize-y" rows="2" placeholder="Uma breve descricao do departamento..." />
            </div>

            <!-- Color -->
            <div>
              <label class="label">Cor</label>
              <div class="flex items-center gap-3">
                <div class="flex gap-1.5 flex-wrap">
                  <button
                    v-for="c in colorPresets"
                    :key="c"
                    type="button"
                    class="w-7 h-7 rounded-lg transition-all"
                    :class="form.color === c ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-105'"
                    :style="{ backgroundColor: c, ringColor: c }"
                    @click="form.color = c"
                  />
                </div>
                <input v-model="form.color" type="color" class="w-8 h-8 rounded-lg cursor-pointer border-0 p-0" />
              </div>
            </div>

            <!-- Active toggle -->
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                :class="form.isActive ? 'bg-green-500' : 'bg-gray-300'"
                @click="form.isActive = !form.isActive"
              >
                <span
                  class="inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm"
                  :class="form.isActive ? 'translate-x-6' : 'translate-x-1'"
                />
              </button>
              <span class="text-sm text-gray-700">Departamento {{ form.isActive ? 'ativo' : 'inativo' }}</span>
            </div>

            <!-- Settings Section -->
            <div class="border-t border-gray-200 pt-5">
              <h3 class="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Settings2 class="w-4 h-4" />
                Configuracoes
              </h3>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="label">Max. chats simultaneos</label>
                  <input v-model.number="form.settings.maxConcurrentChats" type="number" min="1" max="50" class="input" />
                </div>
                <div>
                  <label class="label">Prioridade</label>
                  <input v-model.number="form.settings.priority" type="number" min="1" max="10" class="input" />
                  <p class="text-[10px] text-gray-400 mt-1">Menor = maior prioridade</p>
                </div>
              </div>

              <div class="flex items-center gap-3 mt-4">
                <button
                  type="button"
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                  :class="form.settings.autoAssign ? 'bg-green-500' : 'bg-gray-300'"
                  @click="form.settings.autoAssign = !form.settings.autoAssign"
                >
                  <span
                    class="inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm"
                    :class="form.settings.autoAssign ? 'translate-x-6' : 'translate-x-1'"
                  />
                </button>
                <span class="text-sm text-gray-700">Auto-atribuir conversas aos operadores</span>
              </div>

            </div>

            <!-- Business Hours -->
            <div class="border-t border-gray-200 pt-5">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Clock class="w-4 h-4" />
                  Horario de Atendimento
                </h3>
                <button
                  type="button"
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                  :class="form.settings.businessHours.enabled ? 'bg-green-500' : 'bg-gray-300'"
                  @click="form.settings.businessHours.enabled = !form.settings.businessHours.enabled"
                >
                  <span
                    class="inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm"
                    :class="form.settings.businessHours.enabled ? 'translate-x-6' : 'translate-x-1'"
                  />
                </button>
              </div>

              <div v-if="form.settings.businessHours.enabled" class="space-y-2">
                <div
                  v-for="day in weekDays"
                  :key="day.key"
                  class="flex items-center gap-3 py-1.5"
                >
                  <button
                    type="button"
                    class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0"
                    :class="form.settings.businessHours.schedule[day.key].enabled ? 'bg-green-500' : 'bg-gray-300'"
                    @click="form.settings.businessHours.schedule[day.key].enabled = !form.settings.businessHours.schedule[day.key].enabled"
                  >
                    <span
                      class="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform shadow-sm"
                      :class="form.settings.businessHours.schedule[day.key].enabled ? 'translate-x-4.5' : 'translate-x-0.5'"
                    />
                  </button>
                  <span
                    class="text-sm w-20 flex-shrink-0"
                    :class="form.settings.businessHours.schedule[day.key].enabled ? 'text-gray-900 font-medium' : 'text-gray-400'"
                  >
                    {{ day.label }}
                  </span>
                  <input
                    v-model="form.settings.businessHours.schedule[day.key].start"
                    type="time"
                    class="input w-28 text-sm"
                    :disabled="!form.settings.businessHours.schedule[day.key].enabled"
                  />
                  <span class="text-gray-400 text-xs">ate</span>
                  <input
                    v-model="form.settings.businessHours.schedule[day.key].end"
                    type="time"
                    class="input w-28 text-sm"
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
                {{ editingDepartment ? 'Salvar alteracoes' : 'Criar departamento' }}
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
        :message="`Tem certeza que deseja excluir o departamento '${deleteConfirm.name}'? Esta acao nao pode ser desfeita.`"
        variant="danger"
        @confirm="deleteDepartment"
        @cancel="deleteConfirm = null"
      />
    </Teleport>
  </div>
</template>
