<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { queueApi, departmentsApi, operatorsApi, finalizationsApi } from '@/api'
import { useOperatorStore } from '@/stores/operator'
import { getSocket } from '@/services/socket'
import {
  Inbox,
  Clock,
  User,
  Building2,
  ArrowRight,
  Check,
  X,
  RefreshCw,
  MessageSquare,
  Filter,
  Tag,
  StickyNote,
  ChevronRight,
  Phone,
  Play,
  Undo2,
  TrendingUp,
  TrendingDown,
  CheckCircle2
} from 'lucide-vue-next'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import TransferModal from '@/components/modals/TransferModal.vue'
import { useToast } from 'vue-toastification'
import type { QueueItem, QueueStatus, Department, Operator, Finalization } from '@/types'

const router = useRouter()
const toast = useToast()
const operatorStore = useOperatorStore()

const queue = ref<QueueItem[]>([])
const departments = ref<Department[]>([])
const operators = ref<Operator[]>([])
const isLoading = ref(true)
const stats = ref({ waiting: 0, inProgress: 0, resolved: 0, avgWaitTime: 0 })
const finalizations = ref<Finalization[]>([])
const showFinalizationModal = ref(false)
const finalizeTarget = ref<QueueItem | null>(null)
const selectedFinalizationIds = ref<string[]>([])
const selectedFinalizationType = ref<'gain' | 'loss' | null>(null)
const finalizationNotes = ref('')
const isResolving = ref(false)
const showFilters = ref(false)

// Filters
const filterStatus = ref<QueueStatus | ''>('')
const filterDepartment = ref('')

// Modals
const showTransferModal = ref(false)
const transferTarget = ref<QueueItem | null>(null)

const showNotesModal = ref(false)
const notesTarget = ref<QueueItem | null>(null)
const noteText = ref('')

let refreshInterval: ReturnType<typeof setInterval>
const socket = getSocket()

const activeFiltersCount = computed(() => {
  let count = 0
  if (filterStatus.value) count++
  if (filterDepartment.value) count++
  return count
})

const filteredQueue = computed(() => {
  return queue.value.filter(item => {
    const matchesStatus = !filterStatus.value || item.status === filterStatus.value
    const matchesDepartment = !filterDepartment.value || item.departmentId === filterDepartment.value
    return matchesStatus && matchesDepartment
  })
})

const waitingQueue = computed(() => filteredQueue.value.filter(i => i.status === 'waiting'))
const inProgressQueue = computed(() => filteredQueue.value.filter(i => i.status === 'in_progress' || i.status === 'assigned'))

async function fetchData() {
  try {
    const [queueRes, deptRes, opRes, statsRes] = await Promise.all([
      queueApi.list({ status: filterStatus.value || undefined, departmentId: filterDepartment.value || undefined }),
      departmentsApi.list(),
      operatorsApi.list(),
      queueApi.getStats()
    ])

    if (queueRes.data) queue.value = queueRes.data.items
    if (deptRes.data) departments.value = deptRes.data as Department[]
    if (opRes.data) operators.value = opRes.data as Operator[]
    if (statsRes.data) stats.value = statsRes.data
  } catch {
    toast.error('Erro ao carregar fila')
  } finally {
    isLoading.value = false
  }
}

async function fetchFinalizations() {
  try {
    const response = await finalizationsApi.list()
    if (response.data) {
      finalizations.value = response.data
      selectedFinalizationIds.value = []
    }
  } catch {
    toast.error('Erro ao carregar finalizacoes')
  }
}

const handleQueueSocketUpdate = () => {
  fetchData()
}

async function assumeConversation(item: QueueItem) {
  try {
    await operatorStore.assumeConversation(item.conversation._id)
    toast.success('Conversa assumida')
    fetchData()
    router.push(`/conversations/${item.conversation._id}`)
  } catch {
    toast.error('Erro ao assumir conversa')
  }
}

async function releaseConversation(item: QueueItem) {
  try {
    await operatorStore.releaseConversation(item.conversation._id)
    toast.success('Conversa liberada para a fila')
    fetchData()
  } catch {
    toast.error('Erro ao liberar conversa')
  }
}

function openTransferModal(item: QueueItem) {
  transferTarget.value = item
  showTransferModal.value = true
}

function onTransferComplete() {
  showTransferModal.value = false
  transferTarget.value = null
  fetchData()
}

function openNotesModal(item: QueueItem) {
  notesTarget.value = item
  noteText.value = ''
  showNotesModal.value = true
}

async function addNote() {
  if (!notesTarget.value || !noteText.value.trim()) return

  try {
    await queueApi.addNote(notesTarget.value.conversation._id, noteText.value)
    toast.success('Nota adicionada')
    showNotesModal.value = false
    fetchData()
  } catch {
    toast.error('Erro ao adicionar nota')
  }
}

function openFinalizationModal(item: QueueItem) {
  finalizeTarget.value = item
  finalizationNotes.value = ''
  showFinalizationModal.value = true
  selectedFinalizationIds.value = []
  selectedFinalizationType.value = null
}

function closeFinalizationModal() {
  showFinalizationModal.value = false
  finalizeTarget.value = null
  finalizationNotes.value = ''
  selectedFinalizationIds.value = []
  selectedFinalizationType.value = null
}

function toggleQueueFinalizationSelection(id: string, type: 'gain' | 'loss') {
  if (selectedFinalizationType.value && selectedFinalizationType.value !== type) {
    selectedFinalizationIds.value = [id]
    selectedFinalizationType.value = type
    return
  }

  const index = selectedFinalizationIds.value.indexOf(id)
  if (index >= 0) {
    selectedFinalizationIds.value.splice(index, 1)
    if (selectedFinalizationIds.value.length === 0) {
      selectedFinalizationType.value = null
    }
  } else {
    selectedFinalizationIds.value.push(id)
    selectedFinalizationType.value = type
  }
}

function isQueueFinalizationSelected(id: string) {
  return selectedFinalizationIds.value.includes(id)
}

async function handleFinalizationSubmit() {
  if (!finalizeTarget.value) return

  if (finalizations.value.length > 0 && selectedFinalizationIds.value.length === 0) {
    toast.error('Selecione uma finalizacao')
    return
  }

  isResolving.value = true
  try {
    await operatorStore.resolveConversation(
      finalizeTarget.value.conversation._id,
      finalizationNotes.value,
      selectedFinalizationIds.value.length > 0
        ? selectedFinalizationIds.value
        : undefined
    )
    toast.success('Conversa finalizada')
    closeFinalizationModal()
    fetchData()
  } catch {
    toast.error('Erro ao finalizar conversa')
  } finally {
    isResolving.value = false
  }
}

function formatWaitTime(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

function getDepartmentById(id: string) {
  return departments.value.find(d => d._id === id)
}

function goToConversation(item: QueueItem) {
  router.push(`/conversations/${item.conversation._id}`)
}

function clearFilters() {
  filterStatus.value = ''
  filterDepartment.value = ''
  showFilters.value = false
  fetchData()
}

onMounted(() => {
  fetchData()
  fetchFinalizations()
  refreshInterval = setInterval(fetchData, 30000)
  window.addEventListener('ws:conversation', handleQueueSocketUpdate)
})

onUnmounted(() => {
  clearInterval(refreshInterval)
  window.removeEventListener('ws:conversation', handleQueueSocketUpdate)
})
</script>

<template>
  <div class="queue-page">
    <!-- Mobile Header -->
    <div class="sticky top-0 z-20 bg-white border-b border-gray-200 -mx-4 px-4 py-3 lg:hidden">
      <div class="flex items-center justify-between mb-3">
        <h1 class="text-xl font-bold text-gray-900">Fila</h1>
        <div class="flex items-center gap-2">
          <button
            @click="showFilters = true"
            class="relative flex items-center justify-center w-10 h-10 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
          >
            <Filter class="w-5 h-5 text-gray-600" />
            <span
              v-if="activeFiltersCount > 0"
              class="absolute -top-1 -right-1 w-5 h-5 bg-primary-500 text-white text-xs rounded-full flex items-center justify-center"
            >
              {{ activeFiltersCount }}
            </span>
          </button>
          <button
            @click="fetchData"
            class="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
          >
            <RefreshCw class="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <!-- Mobile Stats -->
      <div class="grid grid-cols-4 gap-2">
        <div class="bg-yellow-50 rounded-xl p-2 text-center">
          <p class="text-lg font-bold text-yellow-700">{{ stats.waiting }}</p>
          <p class="text-[10px] text-yellow-600">Aguardando</p>
        </div>
        <div class="bg-blue-50 rounded-xl p-2 text-center">
          <p class="text-lg font-bold text-blue-700">{{ stats.inProgress }}</p>
          <p class="text-[10px] text-blue-600">Atendendo</p>
        </div>
        <div class="bg-green-50 rounded-xl p-2 text-center">
          <p class="text-lg font-bold text-green-700">{{ stats.resolved }}</p>
          <p class="text-[10px] text-green-600">Finalizados</p>
        </div>
        <div class="bg-purple-50 rounded-xl p-2 text-center">
          <p class="text-lg font-bold text-purple-700">{{ formatWaitTime(stats.avgWaitTime) }}</p>
          <p class="text-[10px] text-purple-600">Média</p>
        </div>
      </div>
    </div>

    <!-- Desktop Header -->
    <div class="hidden lg:flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Fila de Atendimento</h1>
        <p class="text-gray-500">Gerencie as conversas em espera</p>
      </div>
      <button @click="fetchData" class="btn-outline">
        <RefreshCw class="w-4 h-4" />
        Atualizar
      </button>
    </div>

    <!-- Desktop Stats -->
    <div class="hidden lg:grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="card card-body">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
            <Clock class="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900">{{ stats.waiting }}</p>
            <p class="text-sm text-gray-500">Aguardando</p>
          </div>
        </div>
      </div>

      <div class="card card-body">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <MessageSquare class="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900">{{ stats.inProgress }}</p>
            <p class="text-sm text-gray-500">Em atendimento</p>
          </div>
        </div>
      </div>

      <div class="card card-body">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <Check class="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900">{{ stats.resolved }}</p>
            <p class="text-sm text-gray-500">Finalizados hoje</p>
          </div>
        </div>
      </div>

      <div class="card card-body">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
            <Clock class="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900">{{ formatWaitTime(stats.avgWaitTime) }}</p>
            <p class="text-sm text-gray-500">Tempo médio</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Desktop Filters -->
    <div class="hidden lg:block card overflow-hidden mb-6">
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
          @click="clearFilters"
          class="text-xs text-gray-500 hover:text-primary-600 flex items-center gap-1 transition-colors"
        >
          <X class="w-3.5 h-3.5" />
          Limpar filtros
        </button>
      </div>
      <div class="p-5">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="label">Status</label>
            <select v-model="filterStatus" @change="fetchData" class="select">
              <option value="">Todos os status</option>
              <option value="waiting">Aguardando</option>
              <option value="assigned">Atribuído</option>
              <option value="in_progress">Em atendimento</option>
            </select>
          </div>
          <div>
            <label class="label">Departamento</label>
            <select v-model="filterDepartment" @change="fetchData" class="select">
              <option value="">Todos os departamentos</option>
              <option v-for="dept in departments" :key="dept._id" :value="dept._id">
                {{ dept.name }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-16">
      <LoadingSpinner size="lg" />
    </div>

    <template v-else>
      <!-- Waiting Queue Section -->
      <div class="mb-6">
        <!-- Section Header -->
        <div class="flex items-center gap-2 mb-3 px-1 lg:px-0">
          <div class="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center lg:hidden">
            <Clock class="w-4 h-4 text-yellow-600" />
          </div>
          <h2 class="text-base lg:text-lg font-semibold text-gray-900">
            Aguardando <span class="text-yellow-600">({{ waitingQueue.length }})</span>
          </h2>
        </div>

        <!-- Empty State -->
        <div
          v-if="waitingQueue.length === 0"
          class="bg-white lg:card rounded-2xl p-6 text-center"
        >
          <Inbox class="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p class="text-gray-500 text-sm">Nenhuma conversa aguardando</p>
        </div>

        <!-- Mobile Cards -->
        <div v-else class="lg:hidden space-y-2">
          <div
            v-for="item in waitingQueue"
            :key="item._id"
            class="queue-card bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
          >
            <div class="flex items-start gap-3">
              <!-- Avatar -->
              <div class="relative flex-shrink-0">
                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                  <span class="text-lg font-semibold text-white">
                    {{ item.conversation.name?.charAt(0).toUpperCase() || '?' }}
                  </span>
                </div>
                <span
                  v-if="item.priority > 1"
                  class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold"
                >
                  !
                </span>
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-gray-900 truncate">
                  {{ item.conversation.name || item.conversation.identifier }}
                </h3>
                <div class="flex items-center gap-1.5 text-gray-500 text-sm mt-0.5">
                  <Phone class="w-3.5 h-3.5" />
                  <span class="truncate">{{ item.conversation.identifier }}</span>
                </div>

                <!-- Meta info -->
                <div class="flex items-center flex-wrap gap-2 mt-2">
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
                    <Clock class="w-3 h-3" />
                    {{ formatWaitTime(item.waitTime) }}
                  </span>
                  <span
                    v-if="item.department"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs"
                  >
                    <Building2 class="w-3 h-3" />
                    {{ item.department.name }}
                  </span>
                </div>

                <!-- Actions -->
                <div class="flex items-center gap-2 mt-3">
                  <button
                    @click="assumeConversation(item)"
                    class="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white text-sm font-medium shadow-sm active:scale-[0.98] transition-all"
                  >
                    <Play class="w-4 h-4" />
                    Assumir
                  </button>
                  <button
                    @click="openNotesModal(item)"
                    class="p-2.5 rounded-xl bg-gray-100 text-gray-600 active:bg-gray-200 transition-colors"
                    title="Adicionar nota"
                  >
                    <StickyNote class="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Desktop List -->
        <div v-if="waitingQueue.length > 0" class="hidden lg:block card overflow-hidden">
          <div class="divide-y divide-gray-100">
            <div
              v-for="item in waitingQueue"
              :key="item._id"
              class="p-4 hover:bg-gray-50 transition-colors"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                  <div class="relative">
                    <div class="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                      <span class="text-lg font-medium text-gray-600">
                        {{ item.conversation.name?.charAt(0) || '?' }}
                      </span>
                    </div>
                    <span
                      v-if="item.priority > 1"
                      class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center"
                    >
                      !
                    </span>
                  </div>

                  <div>
                    <h4 class="font-medium text-gray-900">
                      {{ item.conversation.name || item.conversation.identifier }}
                    </h4>
                    <div class="flex items-center gap-3 text-sm text-gray-500">
                      <span class="flex items-center gap-1">
                        <Clock class="w-4 h-4" />
                        {{ formatWaitTime(item.waitTime) }}
                      </span>
                      <span v-if="item.department" class="flex items-center gap-1">
                        <Building2 class="w-4 h-4" />
                        {{ item.department.name }}
                      </span>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    v-if="item.tags.length > 0"
                    class="btn-ghost btn-sm"
                    :title="item.tags.join(', ')"
                  >
                    <Tag class="w-4 h-4" />
                  </button>
                  <button
                    @click="openNotesModal(item)"
                    class="btn-ghost btn-sm"
                    title="Adicionar nota"
                  >
                    <StickyNote class="w-4 h-4" />
                  </button>
                  <button
                    @click="assumeConversation(item)"
                    class="btn-primary btn-sm"
                  >
                    Assumir
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- In Progress Section -->
      <div>
        <!-- Section Header -->
        <div class="flex items-center gap-2 mb-3 px-1 lg:px-0">
          <div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center lg:hidden">
            <MessageSquare class="w-4 h-4 text-blue-600" />
          </div>
          <h2 class="text-base lg:text-lg font-semibold text-gray-900">
            Em Atendimento <span class="text-blue-600">({{ inProgressQueue.length }})</span>
          </h2>
        </div>

        <!-- Empty State -->
        <div
          v-if="inProgressQueue.length === 0"
          class="bg-white lg:card rounded-2xl p-6 text-center"
        >
          <MessageSquare class="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p class="text-gray-500 text-sm">Nenhuma conversa em atendimento</p>
        </div>

        <!-- Mobile Cards -->
        <div v-else class="lg:hidden space-y-2">
          <div
            v-for="item in inProgressQueue"
            :key="item._id"
            class="queue-card bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
          >
            <div class="flex items-start gap-3" @click="goToConversation(item)">
              <!-- Avatar -->
              <div class="relative flex-shrink-0">
                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                  <span class="text-lg font-semibold text-white">
                    {{ item.conversation.name?.charAt(0).toUpperCase() || '?' }}
                  </span>
                </div>
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between">
                  <div class="min-w-0">
                    <h3 class="font-semibold text-gray-900 truncate">
                      {{ item.conversation.name || item.conversation.identifier }}
                    </h3>
                    <div class="flex items-center gap-1.5 text-gray-500 text-sm mt-0.5">
                      <Phone class="w-3.5 h-3.5" />
                      <span class="truncate">{{ item.conversation.identifier }}</span>
                    </div>
                  </div>
                  <ChevronRight class="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>

                <!-- Meta info -->
                <div class="flex items-center flex-wrap gap-2 mt-2">
                  <span
                    v-if="item.operator"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium"
                  >
                    <User class="w-3 h-3" />
                    {{ item.operator.name }}
                  </span>
                  <span
                    v-if="item.department"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs"
                  >
                    <Building2 class="w-3 h-3" />
                    {{ item.department.name }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
              <button
                @click="openTransferModal(item)"
                class="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium active:bg-gray-50 transition-colors"
              >
                <ArrowRight class="w-4 h-4" />
                Transferir
              </button>
              <button
                @click="releaseConversation(item)"
                class="p-2 rounded-xl border border-gray-200 text-gray-500 active:bg-gray-50 transition-colors"
                title="Devolver à fila"
              >
                <Undo2 class="w-4 h-4" />
              </button>
              <button
                @click="openFinalizationModal(item)"
                class="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-green-500 text-white text-sm font-medium active:bg-green-600 transition-colors"
              >
                <Check class="w-4 h-4" />
                Finalizar
              </button>
            </div>
          </div>
        </div>

        <!-- Desktop List -->
        <div v-if="inProgressQueue.length > 0" class="hidden lg:block card overflow-hidden">
          <div class="divide-y divide-gray-100">
            <div
              v-for="item in inProgressQueue"
              :key="item._id"
              class="p-4 hover:bg-gray-50 transition-colors"
            >
              <div class="flex items-center justify-between">
                <div
                  class="flex items-center gap-4 flex-1 cursor-pointer"
                  @click="goToConversation(item)"
                >
                  <div class="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <span class="text-lg font-medium text-blue-600">
                      {{ item.conversation.name?.charAt(0) || '?' }}
                    </span>
                  </div>
                  <div>
                    <h4 class="font-medium text-gray-900">
                      {{ item.conversation.name || item.conversation.identifier }}
                    </h4>
                    <div class="flex items-center gap-3 text-sm text-gray-500">
                      <span v-if="item.operator" class="flex items-center gap-1">
                        <User class="w-4 h-4" />
                        {{ item.operator.name }}
                      </span>
                      <span v-if="item.department" class="flex items-center gap-1">
                        <Building2 class="w-4 h-4" />
                        {{ item.department.name }}
                      </span>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    @click="openTransferModal(item)"
                    class="btn-outline btn-sm"
                  >
                    <ArrowRight class="w-4 h-4" />
                    Transferir
                  </button>
                  <button
                    @click="releaseConversation(item)"
                    class="btn-ghost btn-sm"
                    title="Devolver à fila"
                  >
                    <X class="w-4 h-4" />
                  </button>
                  <button
                    @click="openFinalizationModal(item)"
                    class="btn-success btn-sm"
                  >
                    <Check class="w-4 h-4" />
                    Finalizar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Mobile Filter Sheet -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showFilters"
          class="fixed inset-0 bg-black/50 z-50 lg:hidden"
          @click="showFilters = false"
        />
      </Transition>
      <Transition name="slide-up">
        <div
          v-if="showFilters"
          class="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 lg:hidden max-h-[80vh] overflow-y-auto"
        >
          <div class="p-4">
            <div class="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />

            <div class="flex items-center justify-between mb-6">
              <h2 class="text-lg font-semibold text-gray-900">Filtros</h2>
              <button @click="showFilters = false" class="p-2 hover:bg-gray-100 rounded-full">
                <X class="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <!-- Status Filter -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-3">Status</label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  @click="filterStatus = ''"
                  :class="filterStatus === '' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700'"
                  class="px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                >
                  Todos
                </button>
                <button
                  @click="filterStatus = 'waiting'"
                  :class="filterStatus === 'waiting' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-700'"
                  class="px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                >
                  Aguardando
                </button>
                <button
                  @click="filterStatus = 'assigned'"
                  :class="filterStatus === 'assigned' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'"
                  class="px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                >
                  Atribuído
                </button>
                <button
                  @click="filterStatus = 'in_progress'"
                  :class="filterStatus === 'in_progress' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700'"
                  class="px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                >
                  Em atendimento
                </button>
              </div>
            </div>

            <!-- Department Filter -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-3">Departamento</label>
              <div class="space-y-2">
                <button
                  @click="filterDepartment = ''"
                  :class="filterDepartment === '' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700'"
                  class="w-full px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left"
                >
                  Todos os departamentos
                </button>
                <button
                  v-for="dept in departments"
                  :key="dept._id"
                  @click="filterDepartment = dept._id"
                  :class="filterDepartment === dept._id ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700'"
                  class="w-full px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left"
                >
                  {{ dept.name }}
                </button>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-3 pt-4 border-t border-gray-100">
              <button
                @click="clearFilters"
                class="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-700 font-medium"
              >
                Limpar
              </button>
              <button
                @click="showFilters = false; fetchData()"
                class="flex-1 py-3 px-4 rounded-xl bg-primary-500 text-white font-medium"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Transfer Modal -->
    <TransferModal
      v-model="showTransferModal"
      :conversation-id="transferTarget?.conversation._id || ''"
      :current-operator-id="transferTarget?.conversation.operatorId"
      @transferred="onTransferComplete"
    />

    <!-- Notes Modal -->
    <Teleport to="body">
      <div
        v-if="showNotesModal"
        class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
        @click.self="showNotesModal = false"
      >
        <div class="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full sm:max-w-md sm:m-4">
          <div class="p-4 sm:p-6">
            <div class="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4 sm:hidden" />
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Adicionar Nota</h2>

            <div class="space-y-4">
              <div>
                <label class="label">Nota</label>
                <textarea v-model="noteText" class="textarea" rows="4" placeholder="Digite sua nota..." />
              </div>

              <div class="flex gap-3 pt-2">
                <button @click="showNotesModal = false" class="btn-secondary flex-1">
                  Cancelar
                </button>
                <button @click="addNote" class="btn-primary flex-1">
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Finalization Modal -->
    <Teleport to="body">
      <div
        v-if="showFinalizationModal"
        class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
        @click.self="closeFinalizationModal"
      >
        <div class="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full sm:max-w-md sm:m-4 max-h-[90vh] overflow-y-auto">
          <div class="p-4 sm:p-6 space-y-4">
            <div class="w-10 h-1 bg-gray-300 rounded-full mx-auto sm:hidden" />
            <h2 class="text-lg font-semibold text-gray-900">Finalizar Conversa</h2>
            <p class="text-sm text-gray-500">
              {{ finalizeTarget?.conversation.name || finalizeTarget?.conversation.identifier }}
            </p>

            <div class="space-y-4">
              <div>
                <label class="label">Finalizações</label>
                <p
                  v-if="finalizations.length === 0"
                  class="text-xs text-gray-500 mt-1"
                >
                  Crie finalizações para habilitar essa tela.
                </p>
                <div v-else class="space-y-3">
                  <div v-if="gainFinalizations.length > 0">
                    <div class="flex items-center gap-1.5 mb-2">
                      <TrendingUp class="w-3.5 h-3.5 text-emerald-600" />
                      <span class="text-xs font-medium text-gray-600">Ganhos</span>
                    </div>
                    <div class="grid gap-1.5">
                      <button
                        v-for="finalization in gainFinalizations"
                        :key="finalization._id"
                        @click="toggleQueueFinalizationSelection(finalization._id, finalization.type)"
                        class="flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all text-left"
                        :class="isQueueFinalizationSelected(finalization._id)
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-gray-200 active:bg-emerald-50/50'"
                      >
                        <div
                          class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                          :class="isQueueFinalizationSelected(finalization._id)
                            ? 'border-emerald-500 bg-emerald-500'
                            : 'border-gray-300'"
                        >
                          <CheckCircle2
                            v-if="isQueueFinalizationSelected(finalization._id)"
                            class="w-3 h-3 text-white"
                          />
                        </div>
                        <span class="text-sm font-medium text-gray-900">
                          {{ finalization.name }}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div v-if="lossFinalizations.length > 0">
                    <div class="flex items-center gap-1.5 mb-2">
                      <TrendingDown class="w-3.5 h-3.5 text-red-600" />
                      <span class="text-xs font-medium text-gray-600">Perdas</span>
                    </div>
                    <div class="grid gap-1.5">
                      <button
                        v-for="finalization in lossFinalizations"
                        :key="finalization._id"
                        @click="toggleQueueFinalizationSelection(finalization._id, finalization.type)"
                        class="flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all text-left"
                        :class="isQueueFinalizationSelected(finalization._id)
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 active:bg-red-50/50'"
                      >
                        <div
                          class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                          :class="isQueueFinalizationSelected(finalization._id)
                            ? 'border-red-500 bg-red-500'
                            : 'border-gray-300'"
                        >
                          <CheckCircle2
                            v-if="isQueueFinalizationSelected(finalization._id)"
                            class="w-3 h-3 text-white"
                          />
                        </div>
                        <span class="text-sm font-medium text-gray-900">
                          {{ finalization.name }}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label class="label">Notas (opcional)</label>
                <textarea
                  v-model="finalizationNotes"
                  class="textarea"
                  rows="3"
                  placeholder="Registrar observações..."
                />
              </div>

              <div class="flex gap-3 pt-2">
                <button @click="closeFinalizationModal" class="btn-secondary flex-1">
                  Cancelar
                </button>
                <button
                  @click="handleFinalizationSubmit"
                  :disabled="isResolving || (finalizations.length > 0 && selectedFinalizationIds.length === 0)"
                  class="btn-success flex-1 justify-center"
                >
                  <span v-if="!isResolving">Finalizar</span>
                  <LoadingSpinner v-else size="sm" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.queue-page {
  min-height: 100%;
}

@media (max-width: 1023px) {
  .queue-page {
    padding-bottom: 2rem;
  }
}

.queue-card {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

/* Animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
