<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { operatorsApi, departmentsApi } from '@/api'
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Mail,
  Shield,
  Clock,
  MessageSquare,
  Star,
  Search,
  Filter,
  X
} from 'lucide-vue-next'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import { useToast } from 'vue-toastification'
import type { Operator, OperatorPayload, OperatorRole, OperatorStatus, Department } from '@/types'
import ExcelActions from '@/components/ui/ExcelActions.vue'

const toast = useToast()

const operators = ref<Operator[]>([])
const departments = ref<Department[]>([])
const isLoading = ref(true)
const showModal = ref(false)
const editingOperator = ref<Operator | null>(null)
const deleteConfirm = ref<Operator | null>(null)
const searchQuery = ref('')
const filterStatus = ref<OperatorStatus | ''>('')
const filterDepartment = ref('')

const form = ref<OperatorPayload>({
  name: '',
  email: '',
  password: '',
  role: 'operator',
  status: 'offline',
  departmentIds: [],
  settings: {
    maxConcurrentChats: 5,
    receiveNotifications: true,
    soundEnabled: true,
    autoAcceptChats: false
  }
})

const filteredOperators = computed(() => {
  return operators.value.filter(op => {
    const matchesSearch = !searchQuery.value ||
      op.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      op.email.toLowerCase().includes(searchQuery.value.toLowerCase())

    const matchesStatus = !filterStatus.value || op.status === filterStatus.value

    const matchesDepartment = !filterDepartment.value ||
      op.departmentIds.includes(filterDepartment.value)

    return matchesSearch && matchesStatus && matchesDepartment
  })
})

const activeFiltersCount = computed(() => {
  let count = 0
  if (searchQuery.value) count++
  if (filterStatus.value) count++
  if (filterDepartment.value) count++
  return count
})

function clearOperatorFilters() {
  searchQuery.value = ''
  filterStatus.value = ''
  filterDepartment.value = ''
}

const statusColors = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
  offline: 'bg-gray-400'
}

const statusLabels = {
  online: 'Online',
  away: 'Ausente',
  busy: 'Ocupado',
  offline: 'Offline'
}

const roleLabels = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  operator: 'Operador'
}

async function fetchData() {
  isLoading.value = true
  try {
    const [opRes, deptRes] = await Promise.all([
      operatorsApi.list(),
      departmentsApi.list()
    ])
    if (opRes.data) operators.value = opRes.data as Operator[]
    if (deptRes.data) departments.value = deptRes.data as Department[]
  } catch {
    toast.error('Erro ao carregar operadores')
  } finally {
    isLoading.value = false
  }
}

function openCreateModal() {
  editingOperator.value = null
  resetForm()
  showModal.value = true
}

function openEditModal(op: Operator) {
  editingOperator.value = op
  form.value = {
    name: op.name,
    email: op.email,
    password: '',
    role: op.role,
    status: op.status,
    departmentIds: [...op.departmentIds],
    settings: { ...op.settings }
  }
  showModal.value = true
}

function resetForm() {
  form.value = {
    name: '',
    email: '',
    password: '',
    role: 'operator',
    status: 'offline',
    departmentIds: [],
    settings: {
      maxConcurrentChats: 5,
      receiveNotifications: true,
      soundEnabled: true,
      autoAcceptChats: false
    }
  }
}

async function saveOperator() {
  if (!form.value.name.trim() || !form.value.email.trim()) {
    toast.error('Nome e email são obrigatórios')
    return
  }

  if (!editingOperator.value && !form.value.password) {
    toast.error('Senha é obrigatória para novos operadores')
    return
  }

  try {
    const payload = { ...form.value }
    if (editingOperator.value && !payload.password) {
      delete payload.password
    }

    if (editingOperator.value) {
      await operatorsApi.update(editingOperator.value._id, payload)
      toast.success('Operador atualizado')
    } else {
      await operatorsApi.create(payload)
      toast.success('Operador criado')
    }
    showModal.value = false
    fetchData()
  } catch {
    toast.error('Erro ao salvar operador')
  }
}

async function deleteOperator() {
  if (!deleteConfirm.value) return
  try {
    await operatorsApi.delete(deleteConfirm.value._id)
    toast.success('Operador excluído')
    deleteConfirm.value = null
    fetchData()
  } catch {
    toast.error('Erro ao excluir operador')
  }
}

async function updateOperatorStatus(op: Operator, status: OperatorStatus) {
  try {
    await operatorsApi.updateStatus(op._id, status)
    toast.success('Status atualizado')
    fetchData()
  } catch {
    toast.error('Erro ao atualizar status')
  }
}

function getDepartmentById(id: string) {
  return departments.value.find(d => d._id === id)
}

function formatTime(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h`
}

// Excel handlers
const exportData = computed(() => {
  return filteredOperators.value.map(op => ({
    Nome: op.name,
    Email: op.email,
    Role: roleLabels[op.role],
    Status: statusLabels[op.status],
    Departamentos: op.departmentIds.map(id => getDepartmentById(id)?.name || id).join(', '),
    'Max Chats': op.settings.maxConcurrentChats,
    'Criado em': op.createdAt ? new Date(op.createdAt).toLocaleString('pt-BR') : '',
  }))
})

async function handleImport(data: any[]) {
  const validOperators = data.filter(row => row.Email || row.email)

  if (validOperators.length === 0) {
    toast.error('Nenhum operador válido encontrado no arquivo')
    return
  }

  let created = 0
  let failed = 0

  for (const row of validOperators) {
    try {
      const email = row.Email || row.email
      const name = row.Nome || row.name || email
      const roleStr = row.Role || row.role || 'operator'
      const role = (roleStr.toLowerCase() === 'administrador' ? 'admin' :
                   roleStr.toLowerCase() === 'supervisor' ? 'supervisor' : 'operator') as OperatorRole

      await operatorsApi.create({
        name,
        email,
        password: 'changeme123',
        role,
        status: 'offline',
        departmentIds: [],
        settings: {
          maxConcurrentChats: row['Max Chats'] || row.maxChats || 5,
          receiveNotifications: true,
          soundEnabled: true,
          autoAcceptChats: false
        }
      })
      created++
    } catch (error) {
      console.error('Erro ao criar operador:', error)
      failed++
    }
  }

  if (created > 0) {
    toast.success(`${created} operador(es) importado(s) com sucesso! Senha padrão: changeme123`)
    fetchData()
  }

  if (failed > 0) {
    toast.warning(`${failed} operador(es) falharam ao importar (podem já existir)`)
  }
}

onMounted(fetchData)
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Operadores</h1>
        <p class="text-gray-500">Gerencie os operadores de atendimento</p>
      </div>
      <div class="flex flex-col sm:flex-row gap-2">
        <ExcelActions
          :data="exportData"
          :export-options="{
            filename: 'operadores.xlsx',
            sheetName: 'Operadores'
          }"
          :on-import="handleImport"
        />
        <button @click="openCreateModal" class="btn-primary">
          <Plus class="w-4 h-4" />
          Novo Operador
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="card overflow-hidden">
      <div class="flex items-center justify-between px-5 py-3 bg-gray-50/80 border-b border-gray-100">
        <div class="flex items-center gap-2 text-gray-600">
          <Filter class="w-4 h-4" />
          <span class="text-sm font-semibold">Filtros</span>
          <span
            v-if="activeFiltersCount > 0"
            class="ml-1 w-5 h-5 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center"
          >
            {{ activeFiltersCount }}
          </span>
        </div>
        <button
          v-if="activeFiltersCount > 0"
          @click="clearOperatorFilters"
          class="text-xs text-gray-500 hover:text-primary-600 flex items-center gap-1 transition-colors"
        >
          <X class="w-3.5 h-3.5" />
          Limpar filtros
        </button>
      </div>
      <div class="p-5">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="sm:col-span-2">
            <label class="label">Buscar</label>
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                v-model="searchQuery"
                type="text"
                class="input pl-10"
                placeholder="Buscar por nome ou email..."
              />
            </div>
          </div>
          <div>
            <label class="label">Status</label>
            <select v-model="filterStatus" class="select">
              <option value="">Todos os status</option>
              <option value="online">Online</option>
              <option value="away">Ausente</option>
              <option value="busy">Ocupado</option>
              <option value="offline">Offline</option>
            </select>
          </div>
          <div>
            <label class="label">Departamento</label>
            <select v-model="filterDepartment" class="select">
              <option value="">Todos</option>
              <option v-for="dept in departments" :key="dept._id" :value="dept._id">
                {{ dept.name }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <LoadingSpinner size="lg" />
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else-if="filteredOperators.length === 0"
      :title="searchQuery || filterStatus || filterDepartment ? 'Nenhum operador encontrado' : 'Nenhum operador'"
      :description="searchQuery || filterStatus || filterDepartment ? 'Tente ajustar os filtros.' : 'Adicione operadores para gerenciar seu atendimento.'"
    >
      <template #icon>
        <Users class="w-8 h-8 text-gray-400" />
      </template>
      <template v-if="!searchQuery && !filterStatus && !filterDepartment" #action>
        <button @click="openCreateModal" class="btn-primary">
          <Plus class="w-4 h-4" />
          Adicionar Operador
        </button>
      </template>
    </EmptyState>

    <!-- Operators Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="op in filteredOperators"
        :key="op._id"
        class="card card-body"
      >
        <!-- Header -->
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="relative">
              <div
                v-if="op.avatar"
                class="w-12 h-12 rounded-full bg-cover bg-center"
                :style="{ backgroundImage: `url(${op.avatar})` }"
              />
              <div
                v-else
                class="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center"
              >
                <span class="text-lg font-semibold text-primary-700">
                  {{ op.name.charAt(0).toUpperCase() }}
                </span>
              </div>
              <span
                class="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white"
                :class="statusColors[op.status]"
              />
            </div>
            <div>
              <h3 class="font-semibold text-gray-900">{{ op.name }}</h3>
              <p class="text-sm text-gray-500">{{ roleLabels[op.role] }}</p>
            </div>
          </div>

          <div class="flex gap-1">
            <button @click="openEditModal(op)" class="btn-ghost btn-sm">
              <Edit2 class="w-4 h-4" />
            </button>
            <button @click="deleteConfirm = op" class="btn-ghost btn-sm text-red-600">
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Info -->
        <div class="space-y-2 text-sm mb-4">
          <div class="flex items-center gap-2 text-gray-600">
            <Mail class="w-4 h-4" />
            <span class="truncate">{{ op.email }}</span>
          </div>
          <div class="flex items-center gap-2 text-gray-600">
            <Shield class="w-4 h-4" />
            <span>{{ statusLabels[op.status] }}</span>
          </div>
        </div>

        <!-- Departments -->
        <div v-if="op.departmentIds.length > 0" class="flex flex-wrap gap-1 mb-4">
          <span
            v-for="deptId in op.departmentIds.slice(0, 3)"
            :key="deptId"
            class="px-2 py-0.5 text-xs rounded-full"
            :style="{
              backgroundColor: (getDepartmentById(deptId)?.color || '#6b7280') + '20',
              color: getDepartmentById(deptId)?.color || '#6b7280'
            }"
          >
            {{ getDepartmentById(deptId)?.name || 'N/A' }}
          </span>
          <span
            v-if="op.departmentIds.length > 3"
            class="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600"
          >
            +{{ op.departmentIds.length - 3 }}
          </span>
        </div>

        <!-- Metrics -->
        <div class="grid grid-cols-3 gap-2 pt-4 border-t border-gray-200">
          <div class="text-center">
            <div class="flex items-center justify-center gap-1 text-gray-600">
              <MessageSquare class="w-4 h-4" />
              <span class="font-semibold">{{ op.metrics.activeChats }}</span>
            </div>
            <p class="text-xs text-gray-500">Ativos</p>
          </div>
          <div class="text-center">
            <div class="flex items-center justify-center gap-1 text-gray-600">
              <Clock class="w-4 h-4" />
              <span class="font-semibold">{{ formatTime(op.metrics.avgResponseTime) }}</span>
            </div>
            <p class="text-xs text-gray-500">Resp.</p>
          </div>
          <div class="text-center">
            <div class="flex items-center justify-center gap-1 text-gray-600">
              <Star class="w-4 h-4" />
              <span class="font-semibold">{{ op.metrics.satisfaction.toFixed(1) }}</span>
            </div>
            <p class="text-xs text-gray-500">Sat.</p>
          </div>
        </div>

        <!-- Status Actions -->
        <div class="flex gap-2 mt-4">
          <button
            v-for="status in (['online', 'away', 'busy', 'offline'] as OperatorStatus[])"
            :key="status"
            @click="updateOperatorStatus(op, status)"
            class="flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors"
            :class="op.status === status
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
          >
            {{ statusLabels[status] }}
          </button>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg">
          <div class="p-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">
              {{ editingOperator ? 'Editar Operador' : 'Novo Operador' }}
            </h2>
          </div>

          <form @submit.prevent="saveOperator" class="p-4 space-y-4">
            <div>
              <label class="label">Nome *</label>
              <input v-model="form.name" type="text" class="input" required />
            </div>

            <div>
              <label class="label">Email *</label>
              <input v-model="form.email" type="email" class="input" required />
            </div>

            <div>
              <label class="label">
                Senha {{ editingOperator ? '(deixe em branco para manter)' : '*' }}
              </label>
              <input
                v-model="form.password"
                type="password"
                class="input"
                :required="!editingOperator"
              />
            </div>

            <div>
              <label class="label">Função</label>
              <select v-model="form.role" class="select">
                <option value="operator">Operador</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div>
              <label class="label">Departamentos</label>
              <div class="space-y-2 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                <label
                  v-for="dept in departments"
                  :key="dept._id"
                  class="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    :value="dept._id"
                    v-model="form.departmentIds"
                    class="w-4 h-4"
                  />
                  <span
                    class="w-3 h-3 rounded-full"
                    :style="{ backgroundColor: dept.color }"
                  />
                  <span class="text-sm">{{ dept.name }}</span>
                </label>
              </div>
            </div>

            <div>
              <label class="label">Máx. chats simultâneos</label>
              <input
                v-model.number="form.settings!.maxConcurrentChats"
                type="number"
                min="1"
                class="input"
              />
            </div>

            <div class="space-y-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="form.settings!.receiveNotifications" class="w-4 h-4" />
                <span class="text-sm text-gray-700">Receber notificações</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="form.settings!.soundEnabled" class="w-4 h-4" />
                <span class="text-sm text-gray-700">Som de notificação</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="form.settings!.autoAcceptChats" class="w-4 h-4" />
                <span class="text-sm text-gray-700">Aceitar chats automaticamente</span>
              </label>
            </div>

            <div class="flex gap-3 pt-4">
              <button type="button" @click="showModal = false" class="btn-secondary flex-1">
                Cancelar
              </button>
              <button type="submit" class="btn-primary flex-1">
                {{ editingOperator ? 'Salvar' : 'Criar' }}
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
        title="Excluir operador"
        :message="`Tem certeza que deseja excluir o operador '${deleteConfirm.name}'?`"
        variant="danger"
        @confirm="deleteOperator"
        @cancel="deleteConfirm = null"
      />
    </Teleport>
  </div>
</template>
