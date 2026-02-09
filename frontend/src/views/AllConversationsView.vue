<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  RefreshCw,
  Search,
  Calendar,
  MessageSquare,
  User,
  Eye,
  X,
  Tag as TagIcon,
  CheckCircle,
  AlertCircle,
  Pause,
  Archive,
  ArchiveRestore,
  TrendingUp,
  TrendingDown,
  Filter
} from 'lucide-vue-next'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import Pagination from '@/components/ui/Pagination.vue'
import ConversationMessagesModal from '@/components/conversations/ConversationMessagesModal.vue'
import { conversationsApi, messagesApi, operatorsApi, tagsApi } from '@/api'
import { useToast } from 'vue-toastification'
import type {
  Conversation,
  Message,
  Operator,
  Tag,
  Pagination as PaginationType,
  MetricsPeriod
} from '@/types'

const route = useRoute()
const toast = useToast()
const isLoading = ref(true)
const conversations = ref<Conversation[]>([])
const pagination = ref<PaginationType>({
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0
})

// Modal state
const showConversationModal = ref(false)
const selectedConversation = ref<Conversation | null>(null)
const conversationMessages = ref<Message[]>([])
const loadingMessages = ref(false)

// Data for filters
const operators = ref<Operator[]>([])
const availableTags = ref<Tag[]>([])

// Filters
const selectedPeriod = ref<MetricsPeriod>('week')
const customStartDate = ref('')
const customEndDate = ref('')
const selectedOperator = ref('')
const selectedStatus = ref('')
const selectedTags = ref<string[]>([])
const searchQuery = ref('')
const showOnlyArchived = ref(false)
const hideFinalized = ref(false)
const showFiltersPanel = ref(false)

const periodOptions = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Ultima Semana' },
  { value: 'month', label: 'Ultimo Mes' },
  { value: 'custom', label: 'Personalizado' }
]

const statusOptions = [
  { value: '', label: 'Todos os Status' },
  { value: 'active', label: 'Ativas' },
  { value: 'waiting', label: 'Aguardando' },
  { value: 'inactive', label: 'Inativas' },
  { value: 'finalized', label: 'Finalizadas' }
]

// Helper to check if archived (handles string "True" or boolean true)
function isArchived(conv: Conversation): boolean {
  return conv.archived === true || conv.archived === 'True' || (conv.archived as unknown) === 'true'
}

// Computed
const activeFiltersCount = computed(() => {
  let count = 0
  if (selectedOperator.value) count++
  if (selectedStatus.value) count++
  if (selectedTags.value.length > 0) count++
  if (searchQuery.value) count++
  if (showOnlyArchived.value) count++
  if (hideFinalized.value) count++
  return count
})

const filteredConversations = computed(() => {
  let result = [...conversations.value]

  // Filter by archived status
  if (showOnlyArchived.value) {
    result = result.filter(conv => isArchived(conv))
  }

  // Filter to hide finalized
  if (hideFinalized.value) {
    result = result.filter(conv => conv.status !== 'finalized')
  }

  // Filter by tags (frontend filter since API might not support it)
  if (selectedTags.value.length > 0) {
    result = result.filter(conv => {
      // Handle tags as string array or JSON string
      let convTags = conv.tags
      if (typeof convTags === 'string') {
        try {
          convTags = JSON.parse(convTags)
        } catch {
          convTags = []
        }
      }
      return convTags && selectedTags.value.some(tag => convTags?.includes(tag))
    })
  }

  // Filter by operator (frontend filter)
  if (selectedOperator.value) {
    result = result.filter(conv => conv.operatorId === selectedOperator.value)
  }

  // Filter by date range
  if (selectedPeriod.value !== 'custom') {
    const now = new Date()
    let startDate: Date

    switch (selectedPeriod.value) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(0)
    }

    result = result.filter(conv => {
      const convDate = conv.updatedAt ? new Date(conv.updatedAt) : new Date(conv.createdAt || 0)
      return convDate >= startDate
    })
  } else if (customStartDate.value && customEndDate.value) {
    const start = new Date(customStartDate.value)
    const end = new Date(customEndDate.value)
    end.setHours(23, 59, 59, 999)

    result = result.filter(conv => {
      const convDate = conv.updatedAt ? new Date(conv.updatedAt) : new Date(conv.createdAt || 0)
      return convDate >= start && convDate <= end
    })
  }

  return result
})

async function fetchData() {
  isLoading.value = true
  try {
    // Fetch both archived and non-archived conversations to get ALL conversations
    const [convNotArchivedRes, convArchivedRes, opsRes, tagsRes] = await Promise.all([
      conversationsApi.list({
        page: 1,
        limit: 500,
        status: selectedStatus.value || undefined,
        search: searchQuery.value || undefined,
        archived: false
      }),
      conversationsApi.list({
        page: 1,
        limit: 500,
        status: selectedStatus.value || undefined,
        search: searchQuery.value || undefined,
        archived: true
      }),
      operatorsApi.list(),
      tagsApi.list()
    ])

    // Merge both results
    const allConversations: Conversation[] = []
    const seenIds = new Set<string>()

    if (convNotArchivedRes?.data?.items) {
      for (const conv of convNotArchivedRes.data.items) {
        if (!seenIds.has(conv._id)) {
          seenIds.add(conv._id)
          allConversations.push(conv)
        }
      }
    }

    if (convArchivedRes?.data?.items) {
      for (const conv of convArchivedRes.data.items) {
        if (!seenIds.has(conv._id)) {
          seenIds.add(conv._id)
          allConversations.push(conv)
        }
      }
    }

    // Sort by updatedAt desc
    allConversations.sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      return dateB - dateA
    })

    conversations.value = allConversations
    pagination.value = {
      total: allConversations.length,
      page: 1,
      pageSize: allConversations.length,
      totalPages: 1
    }

    if (opsRes?.data) {
      operators.value = opsRes.data
    }

    if (tagsRes?.data) {
      availableTags.value = tagsRes.data
    }
  } catch (err) {
    console.error('Erro ao carregar dados:', err)
  } finally {
    isLoading.value = false
  }
}

function handlePageChange(page: number) {
  pagination.value.page = page
  fetchData()
}

function formatDateTime(date?: string) {
  if (!date) return '-'
  return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: ptBR })
}

function formatDate(date?: string) {
  if (!date) return '-'
  return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR })
}

function applyCustomPeriod() {
  if (customStartDate.value && customEndDate.value) {
    pagination.value.page = 1
    fetchData()
  }
}

async function viewConversation(conversation: Conversation) {
  selectedConversation.value = conversation
  showConversationModal.value = true
  loadingMessages.value = true

  try {
    const msgsRes = await messagesApi.list({
      conversationId: conversation._id,
      limit: 100
    })

    if (msgsRes?.data?.items) {
      // Ordenar do mais antigo para o mais recente
      conversationMessages.value = [...msgsRes.data.items].reverse()
    }
  } catch (err) {
    console.error('Erro ao carregar mensagens:', err)
  } finally {
    loadingMessages.value = false
  }
}

function closeModal() {
  showConversationModal.value = false
  selectedConversation.value = null
  conversationMessages.value = []
}

async function unarchiveConversation(conversation: Conversation) {
  try {
    await conversationsApi.unarchive(conversation._id)
    toast.success('Conversa desarquivada com sucesso')
    // Remove from list or update the archived status
    const index = conversations.value.findIndex(c => c._id === conversation._id)
    if (index !== -1) {
      conversations.value[index].archived = false
    }
  } catch (err) {
    console.error('Erro ao desarquivar conversa:', err)
    toast.error('Erro ao desarquivar conversa')
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active': return 'bg-green-500'
    case 'waiting': return 'bg-yellow-500'
    case 'inactive': return 'bg-gray-400'
    case 'finalized': return 'bg-blue-500'
    default: return 'bg-gray-400'
  }
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-700'
    case 'waiting': return 'bg-yellow-100 text-yellow-700'
    case 'inactive': return 'bg-gray-100 text-gray-600'
    case 'finalized': return 'bg-blue-100 text-blue-700'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'active': return 'Ativa'
    case 'waiting': return 'Aguardando'
    case 'inactive': return 'Inativa'
    case 'finalized': return 'Finalizada'
    default: return status
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'active': return CheckCircle
    case 'waiting': return Pause
    case 'inactive': return AlertCircle
    case 'finalized': return Archive
    default: return AlertCircle
  }
}

function getTagColor(tagName: string) {
  const tag = availableTags.value.find(t => t.name === tagName)
  return tag?.color || '#6B7280'
}

// Helper to get tags as array (handles JSON string)
function getConversationTags(conv: Conversation): string[] {
  if (!conv.tags) return []
  if (Array.isArray(conv.tags)) return conv.tags
  if (typeof conv.tags === 'string') {
    try {
      const parsed = JSON.parse(conv.tags)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function toggleTag(tagName: string) {
  const index = selectedTags.value.indexOf(tagName)
  if (index === -1) {
    selectedTags.value.push(tagName)
  } else {
    selectedTags.value.splice(index, 1)
  }
}

function getFinalizationTypeLabel(type?: string) {
  return type === 'gain' ? 'Ganho' : type === 'loss' ? 'Perda' : '-'
}

function getFinalizationTypeClass(type?: string) {
  return type === 'gain'
    ? 'bg-emerald-100 text-emerald-700'
    : type === 'loss'
      ? 'bg-red-100 text-red-600'
      : 'bg-gray-100 text-gray-600'
}

function clearFilters() {
  selectedOperator.value = ''
  selectedStatus.value = ''
  selectedTags.value = []
  searchQuery.value = ''
  showOnlyArchived.value = false
  hideFinalized.value = false
  selectedPeriod.value = 'week'
  customStartDate.value = ''
  customEndDate.value = ''
  pagination.value.page = 1
  fetchData()
}

let searchTimeout: ReturnType<typeof setTimeout>
function handleSearch() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    pagination.value.page = 1
    fetchData()
  }, 300)
}

watch([selectedPeriod], () => {
  if (selectedPeriod.value !== 'custom') {
    pagination.value.page = 1
  }
})

watch([selectedStatus], () => {
  pagination.value.page = 1
  fetchData()
})

onMounted(() => {
  // Check if archived filter is set via query param
  if (route.query.archived === 'true') {
    showOnlyArchived.value = true
  }
  fetchData()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Todas as Conversas</h1>
        <p class="text-gray-500">Visualize e filtre todas as conversas do sistema</p>
      </div>
      <button @click="fetchData" class="btn-outline" :disabled="isLoading">
        <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
        Atualizar
      </button>
    </div>

    <!-- Filters Card -->
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
          @click="clearFilters"
          class="text-xs text-gray-500 hover:text-primary-600 flex items-center gap-1 transition-colors"
        >
          <X class="w-3.5 h-3.5" />
          Limpar filtros
        </button>
      </div>
      <div class="p-5 space-y-4">
        <!-- Row 1: Period + Search -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label class="label">Período</label>
            <select v-model="selectedPeriod" class="select">
              <option v-for="opt in periodOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <template v-if="selectedPeriod === 'custom'">
            <div>
              <label class="label">Data Início</label>
              <input v-model="customStartDate" type="date" class="input" />
            </div>
            <div>
              <label class="label">Data Fim</label>
              <input v-model="customEndDate" type="date" class="input" />
            </div>
            <div>
              <button @click="applyCustomPeriod" class="btn-primary w-full">
                <Calendar class="w-4 h-4" />
                Aplicar
              </button>
            </div>
          </template>

          <div v-if="selectedPeriod !== 'custom'" class="sm:col-span-1 lg:col-span-3">
            <label class="label">Buscar</label>
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                v-model="searchQuery"
                @input="handleSearch"
                type="text"
                placeholder="Nome ou número..."
                class="input pl-10"
              />
            </div>
          </div>
        </div>

        <!-- Row 1.5: Search when custom period is active -->
        <div v-if="selectedPeriod === 'custom'">
          <label class="label">Buscar</label>
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              v-model="searchQuery"
              @input="handleSearch"
              type="text"
              placeholder="Nome ou número..."
              class="input pl-10"
            />
          </div>
        </div>

        <!-- Row 2: Status + Operator + Checkboxes -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end pt-3 border-t border-gray-100">
          <div>
            <label class="label">Status</label>
            <select v-model="selectedStatus" class="select">
              <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <div>
            <label class="label">Operador</label>
            <select v-model="selectedOperator" class="select">
              <option value="">Todos Operadores</option>
              <option v-for="op in operators" :key="op._id" :value="op._id">
                {{ op.name }}
              </option>
            </select>
          </div>

          <div class="sm:col-span-2 flex items-end gap-5 pb-1">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                v-model="showOnlyArchived"
                class="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span class="text-sm text-gray-700">Somente arquivadas</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                v-model="hideFinalized"
                class="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span class="text-sm text-gray-700">Ocultar finalizadas</span>
            </label>
          </div>
        </div>

        <!-- Row 3: Tags -->
        <div v-if="availableTags.length > 0" class="pt-3 border-t border-gray-100">
          <label class="label mb-2">Tags</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="tag in availableTags"
              :key="tag._id"
              @click="toggleTag(tag.name)"
              class="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
              :class="selectedTags.includes(tag.name)
                ? 'ring-2 ring-offset-2 ring-gray-400'
                : 'opacity-70 hover:opacity-100'"
              :style="{
                backgroundColor: tag.color + '20',
                color: tag.color,
                borderColor: tag.color
              }"
            >
              <TagIcon class="w-3 h-3 inline-block mr-1" />
              {{ tag.name }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <LoadingSpinner size="lg" />
    </div>

    <template v-else>
      <!-- Stats Summary -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="card card-body">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">Total</p>
              <p class="text-2xl font-bold text-gray-900">{{ filteredConversations.length }}</p>
            </div>
            <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <MessageSquare class="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div class="card card-body">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">Ativas</p>
              <p class="text-2xl font-bold text-green-600">
                {{ filteredConversations.filter(c => c.status === 'active').length }}
              </p>
            </div>
            <div class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle class="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <div class="card card-body">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">Aguardando</p>
              <p class="text-2xl font-bold text-yellow-600">
                {{ filteredConversations.filter(c => c.status === 'waiting').length }}
              </p>
            </div>
            <div class="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Pause class="w-5 h-5 text-yellow-600" />
            </div>
          </div>
        </div>

        <div class="card card-body">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">Finalizadas</p>
              <p class="text-2xl font-bold text-blue-600">
                {{ filteredConversations.filter(c => c.status === 'finalized').length }}
              </p>
            </div>
            <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Archive class="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      <!-- Conversations Table -->
      <div class="card">
        <div class="p-4 border-b border-gray-200">
          <h3 class="font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare class="w-5 h-5 text-gray-400" />
            Lista de Conversas
            <span class="text-sm font-normal text-gray-500">
              ({{ filteredConversations.length }} resultados)
            </span>
          </h3>
        </div>

        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Contato</th>
                <th>Numero</th>
                <th>Protocolo</th>
                <th>Status</th>
                <th>Arquivada</th>
                <th>Tags</th>
                <th>Operador</th>
                <th>Atualizado em</th>
                <th class="w-20">Acoes</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="conv in filteredConversations" :key="conv._id">
                <td>
                  <div class="flex items-center gap-3">
                    <div class="relative">
                      <div class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <User class="w-5 h-5 text-primary-600" />
                      </div>
                      <div
                        :class="getStatusColor(conv.status)"
                        class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                      />
                    </div>
                    <div>
                      <p class="font-medium text-gray-900">{{ conv.name || 'Sem nome' }}</p>
                      <p class="text-xs text-gray-500">{{ conv.provider }}</p>
                    </div>
                  </div>
                </td>
                <td class="font-mono text-sm">{{ conv.identifier }}</td>
                <td class="font-mono text-sm">{{ conv.protocolNumber || '-' }}</td>
                <td>
                  <div class="relative" :class="{ 'group/finalization': conv.status === 'finalized' }">
                    <span
                      :class="getStatusBadgeClass(conv.status)"
                      class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium cursor-default"
                    >
                      <component :is="getStatusIcon(conv.status)" class="w-3 h-3" />
                      {{ getStatusLabel(conv.status) }}
                    </span>
                    <!-- Tooltip de Finalizações -->
                    <div
                      v-if="conv.status === 'finalized' && conv.finalizations && conv.finalizations.length > 0"
                      class="absolute left-0 top-full mt-1 z-[100] hidden group-hover/finalization:block pointer-events-none"
                    >
                      <div class="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg whitespace-nowrap min-w-[180px]">
                        <!-- Tipo baseado nas finalizações -->
                        <div class="flex items-center gap-2 mb-2">
                          <span class="text-gray-400">Tipo:</span>
                          <span
                            :class="getFinalizationTypeClass(conv.finalizations[0]?.finalizationType)"
                            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                          >
                            <TrendingUp v-if="conv.finalizations[0]?.finalizationType === 'gain'" class="w-3 h-3" />
                            <TrendingDown v-else-if="conv.finalizations[0]?.finalizationType === 'loss'" class="w-3 h-3" />
                            {{ getFinalizationTypeLabel(conv.finalizations[0]?.finalizationType) }}
                          </span>
                        </div>
                        <!-- Lista de Finalizações -->
                        <div>
                          <p class="text-gray-400 mb-1">Finalizações:</p>
                          <div class="flex flex-col gap-1">
                            <span
                              v-for="(fin, idx) in conv.finalizations"
                              :key="fin.finalizationId || idx"
                              :class="fin.finalizationType === 'gain' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'"
                              class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
                            >
                              <TrendingUp v-if="fin.finalizationType === 'gain'" class="w-3 h-3" />
                              <TrendingDown v-else class="w-3 h-3" />
                              {{ fin.finalizationName }}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <span
                    v-if="isArchived(conv)"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
                  >
                    <Archive class="w-3 h-3" />
                    Sim
                  </span>
                  <span v-else class="text-gray-400">Não</span>
                </td>
                <td>
                  <div v-if="getConversationTags(conv).length > 0" class="relative group/tags">
                    <div class="flex items-center gap-1">
                      <span
                        class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                        :style="{ backgroundColor: getTagColor(getConversationTags(conv)[0]) }"
                      >
                        {{ getConversationTags(conv)[0] }}
                      </span>
                      <span
                        v-if="getConversationTags(conv).length > 1"
                        class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-200 text-gray-600 cursor-default"
                      >
                        +{{ getConversationTags(conv).length - 1 }}
                      </span>
                    </div>
                    <!-- Tooltip com todas as tags -->
                    <div
                      v-if="getConversationTags(conv).length > 1"
                      class="absolute left-0 top-full mt-1 z-[100] hidden group-hover/tags:block pointer-events-none"
                    >
                      <div class="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg whitespace-nowrap">
                        <p class="font-medium mb-1.5 text-gray-300">Todas as tags:</p>
                        <div class="flex flex-wrap gap-1 max-w-[200px]">
                          <span
                            v-for="tagName in getConversationTags(conv)"
                            :key="tagName"
                            class="inline-flex items-center px-2 py-0.5 rounded-full text-white"
                            :style="{ backgroundColor: getTagColor(tagName) }"
                          >
                            {{ tagName }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <span v-else class="text-gray-400">-</span>
                </td>
                <td>
                  <span v-if="conv.operatorName" class="text-gray-900">
                    {{ conv.operatorName }}
                  </span>
                  <span v-else class="text-gray-400">-</span>
                </td>
                <td class="text-sm whitespace-nowrap">{{ formatDateTime(conv.updatedAt) }}</td>
                <td>
                  <div class="flex items-center gap-1">
                    <button
                      @click="viewConversation(conv)"
                      class="btn-ghost p-2 text-blue-600 hover:bg-blue-50"
                      title="Ver conversa"
                    >
                      <Eye class="w-4 h-4" />
                    </button>
                    <button
                      v-if="isArchived(conv)"
                      @click="unarchiveConversation(conv)"
                      class="btn-ghost p-2 text-green-600 hover:bg-green-50"
                      title="Desarquivar"
                    >
                      <ArchiveRestore class="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredConversations.length === 0">
                <td colspan="9" class="text-center text-gray-500 py-8">
                  Nenhuma conversa encontrada para os filtros aplicados
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <Pagination
          v-if="pagination.totalPages > 1"
          :pagination="pagination"
          @page-change="handlePageChange"
          class="p-4 border-t border-gray-200"
        />
      </div>
    </template>

    <!-- Modal de Detalhes da Conversa -->
    <ConversationMessagesModal
      :show="showConversationModal"
      :conversation="selectedConversation"
      :messages="conversationMessages"
      :loading="loadingMessages"
      :available-tags="availableTags"
      @close="closeModal"
    />
  </div>
</template>
