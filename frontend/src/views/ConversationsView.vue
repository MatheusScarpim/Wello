<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { conversationsApi, tagsApi } from '@/api'
import type { Tag } from '@/types'
import {
  Search,
  Plus,
  MessageSquare,
  Archive,
  User,
  Clock,
  ChevronRight,
  Filter,
  X,
  Phone,
  Hash,
  Tag as TagIcon
} from 'lucide-vue-next'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Pagination from '@/components/ui/Pagination.vue'
import CreateConversationModal from '@/components/conversations/CreateConversationModal.vue'
import { useToast } from 'vue-toastification'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Conversation, Pagination as PaginationType } from '@/types'
import ExcelActions from '@/components/ui/ExcelActions.vue'

const router = useRouter()
const toast = useToast()

const conversations = ref<Conversation[]>([])
const pagination = ref<PaginationType>({
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0
})
const isLoading = ref(true)
const showCreateModal = ref(false)
const showFilters = ref(false)

// Filters
const search = ref('')
const statusFilter = ref('')
const searchTimeout = ref<ReturnType<typeof setTimeout>>()

// Tags
const availableTags = ref<Tag[]>([])

// Tooltip state
const activeTooltip = ref<string | null>(null)
const tooltipPosition = ref({ x: 0, y: 0 })
const tooltipTags = ref<string[]>([])

function showTagsTooltip(event: MouseEvent, conversationId: string, tags: string[]) {
  const rect = (event.target as HTMLElement).getBoundingClientRect()
  tooltipPosition.value = {
    x: rect.left,
    y: rect.bottom + 4
  }
  tooltipTags.value = tags
  activeTooltip.value = conversationId
}

function hideTagsTooltip() {
  activeTooltip.value = null
}

function getTagColor(tagName: string) {
  const tag = availableTags.value.find(t => t.name === tagName)
  return tag?.color || '#6B7280'
}

async function fetchTags() {
  try {
    const response = await tagsApi.list()
    if (response.data) {
      availableTags.value = response.data
    }
  } catch {
    // Silently fail
  }
}

// Computed
const activeFiltersCount = computed(() => {
  let count = 0
  if (statusFilter.value) count++
  return count
})

// Filter out finalized conversations
const filteredConversations = computed(() => {
  return conversations.value.filter(conv => conv.status !== 'finalized')
})

async function fetchConversations() {
  isLoading.value = true
  try {
    const response = await conversationsApi.list({
      page: pagination.value.page,
      limit: pagination.value.pageSize,
      status: statusFilter.value || undefined,
      search: search.value || undefined
    })

    if (response.data) {
      conversations.value = response.data.items
      pagination.value = response.data.pagination
    }
  } catch (error) {
    toast.error('Erro ao carregar conversas')
  } finally {
    isLoading.value = false
  }
}

function handleSearch() {
  clearTimeout(searchTimeout.value)
  searchTimeout.value = setTimeout(() => {
    pagination.value.page = 1
    fetchConversations()
  }, 300)
}

function handlePageChange(page: number) {
  pagination.value.page = page
  fetchConversations()
}

function openConversation(conversation: Conversation) {
  router.push(`/conversations/${conversation._id}`)
}

async function archiveConversation(conversation: Conversation, event: Event) {
  event.stopPropagation()
  try {
    await conversationsApi.archive(conversation._id)
    toast.success('Conversa arquivada')
    fetchConversations()
  } catch {
    toast.error('Erro ao arquivar conversa')
  }
}

function formatDate(date?: string) {
  if (!date) return 'N/A'
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR })
}

// Excel handlers
const exportData = computed(() => {
  return filteredConversations.value.map(conv => ({
    ID: conv._id,
    Nome: conv.name || '',
    Identificador: conv.identifier,
    Status: conv.status,
    Operador: conv.operatorName || '',
    Departamento: conv.departmentId || '',
    Tags: Array.isArray(conv.tags) ? conv.tags.join(', ') : (conv.tags || ''),
    'Última mensagem': conv.lastMessage || '',
    'Criado em': conv.createdAt ? new Date(conv.createdAt).toLocaleString('pt-BR') : '',
    'Atualizado em': conv.updatedAt ? new Date(conv.updatedAt).toLocaleString('pt-BR') : '',
  }))
})

async function handleImport(_data: any[]) {
  toast.info('Importação de conversas não é suportada. As conversas são criadas automaticamente.')
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active': return 'bg-green-500'
    case 'waiting': return 'bg-yellow-500'
    case 'inactive': return 'bg-gray-400'
    default: return 'bg-gray-400'
  }
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-700'
    case 'waiting': return 'bg-yellow-100 text-yellow-700'
    case 'inactive': return 'bg-gray-100 text-gray-600'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'active': return 'Ativa'
    case 'waiting': return 'Aguardando'
    case 'inactive': return 'Inativa'
    default: return status
  }
}

function clearFilters() {
  statusFilter.value = ''
  showFilters.value = false
  fetchConversations()
}

watch(statusFilter, () => {
  pagination.value.page = 1
  fetchConversations()
})

onMounted(() => {
  fetchConversations()
  fetchTags()
})

const handleSocketUpdate = () => {
  fetchConversations()
}

onMounted(() => {
  window.addEventListener('ws:message', handleSocketUpdate)
  window.addEventListener('ws:conversation', handleSocketUpdate)
})

onUnmounted(() => {
  window.removeEventListener('ws:message', handleSocketUpdate)
  window.removeEventListener('ws:conversation', handleSocketUpdate)
})
</script>

<template>
  <div class="conversations-page">
    <!-- Mobile Header -->
    <div class="sticky top-0 z-20 bg-white border-b border-gray-200 -mx-4 px-4 py-3 lg:hidden">
      <div class="flex items-center justify-between mb-3">
        <h1 class="text-xl font-bold text-gray-900">Conversas</h1>
        <button
          @click="showCreateModal = true"
          class="w-10 h-10 flex items-center justify-center rounded-full bg-primary-500 text-white shadow-lg active:scale-95 transition-transform"
        >
          <Plus class="w-5 h-5" />
        </button>
      </div>

      <!-- Search & Filter Row -->
      <div class="flex gap-2">
        <div class="flex-1 relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            v-model="search"
            @input="handleSearch"
            type="text"
            placeholder="Buscar conversa..."
            class="w-full pl-9 pr-4 py-2.5 bg-gray-100 border-0 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
          />
        </div>
        <button
          @click="showFilters = true"
          class="relative flex items-center justify-center w-11 h-11 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
        >
          <Filter class="w-5 h-5 text-gray-600" />
          <span
            v-if="activeFiltersCount > 0"
            class="absolute -top-1 -right-1 w-5 h-5 bg-primary-500 text-white text-xs rounded-full flex items-center justify-center"
          >
            {{ activeFiltersCount }}
          </span>
        </button>
      </div>
    </div>

    <!-- Desktop Header -->
    <div class="hidden lg:flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Conversas</h1>
        <p class="text-gray-500">Gerencie suas conversas do WhatsApp</p>
      </div>
      <div class="flex flex-col sm:flex-row gap-2">
        <ExcelActions
          :data="exportData"
          :export-options="{
            filename: 'conversas.xlsx',
            sheetName: 'Conversas'
          }"
          :on-import="handleImport"
        />
        <button @click="showCreateModal = true" class="btn-primary">
          <Plus class="w-4 h-4" />
          Nova Conversa
        </button>
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
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="lg:col-span-2">
            <label class="label">Buscar</label>
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                v-model="search"
                @input="handleSearch"
                type="text"
                placeholder="Buscar por nome ou número..."
                class="input pl-10"
              />
            </div>
          </div>
          <div>
            <label class="label">Status</label>
            <select v-model="statusFilter" class="select">
              <option value="">Todos os status</option>
              <option value="active">Ativas</option>
              <option value="waiting">Aguardando</option>
              <option value="inactive">Inativas</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-16">
      <LoadingSpinner size="lg" />
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else-if="filteredConversations.length === 0"
      title="Nenhuma conversa encontrada"
      description="Não há conversas que correspondam aos filtros aplicados."
    >
      <template #icon>
        <MessageSquare class="w-8 h-8 text-gray-400" />
      </template>
      <template #action>
        <button @click="showCreateModal = true" class="btn-primary">
          <Plus class="w-4 h-4" />
          Criar Conversa
        </button>
      </template>
    </EmptyState>

    <!-- Conversations List -->
    <template v-else>
      <!-- Mobile Cards -->
      <div class="lg:hidden space-y-2 mt-4">
        <div
          v-for="conversation in filteredConversations"
          :key="conversation._id"
          @click="openConversation(conversation)"
          class="conversation-card bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:bg-gray-50 transition-colors"
        >
          <div class="flex items-start gap-3">
            <!-- Avatar with status indicator -->
            <div class="relative flex-shrink-0">
              <div class="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                <User class="w-6 h-6 text-white" />
              </div>
              <div
                :class="getStatusColor(conversation.status)"
                class="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white"
              />
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <h3 class="font-semibold text-gray-900 truncate">
                    {{ conversation.name || 'Sem nome' }}
                  </h3>
                  <div class="flex items-center gap-1.5 text-gray-500 text-sm mt-0.5">
                    <Phone class="w-3.5 h-3.5" />
                    <span class="truncate">{{ conversation.identifier }}</span>
                  </div>
                </div>
                <ChevronRight class="w-5 h-5 text-gray-400 flex-shrink-0" />
              </div>

              <!-- Info row -->
              <div class="flex items-center gap-3 mt-2.5">
                <span
                  :class="getStatusBadgeClass(conversation.status)"
                  class="px-2 py-0.5 rounded-full text-xs font-medium"
                >
                  {{ getStatusLabel(conversation.status) }}
                </span>

                <div v-if="conversation.protocolNumber" class="flex items-center gap-1 text-xs text-gray-500">
                  <Hash class="w-3 h-3" />
                  {{ conversation.protocolNumber }}
                </div>

                <div class="flex items-center gap-1 text-xs text-gray-400 ml-auto">
                  <Clock class="w-3 h-3" />
                  {{ formatDate(conversation.updatedAt) }}
                </div>
              </div>

              <!-- Tags -->
              <div v-if="conversation.tags && conversation.tags.length > 0" class="flex items-center gap-1 mt-2">
                <span
                  class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white"
                  :style="{ backgroundColor: getTagColor(conversation.tags[0]) }"
                >
                  {{ conversation.tags[0] }}
                </span>
                <span
                  v-if="conversation.tags.length > 1"
                  class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-200 text-gray-600 cursor-pointer hover:bg-gray-300"
                  @mouseenter="showTagsTooltip($event, conversation._id, conversation.tags)"
                  @mouseleave="hideTagsTooltip"
                  @click.stop
                >
                  +{{ conversation.tags.length - 1 }}
                </span>
              </div>

              <!-- Operator -->
              <div v-if="conversation.operatorName" class="mt-2 text-xs text-gray-500">
                Atendido por <span class="font-medium text-gray-700">{{ conversation.operatorName }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Desktop Table -->
      <div class="hidden lg:block card">
        <div class="table-container overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Contato</th>
                <th>Número</th>
                <th>Protocolo</th>
                <th>Status</th>
                <th>Tags</th>
                <th>Operador</th>
                <th>Atualização</th>
                <th class="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="conversation in filteredConversations"
                :key="conversation._id"
                class="cursor-pointer"
                @click="openConversation(conversation)"
              >
                <td>
                  <div class="flex items-center gap-3">
                    <div class="relative">
                      <div class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <User class="w-5 h-5 text-primary-600" />
                      </div>
                      <div
                        :class="getStatusColor(conversation.status)"
                        class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                      />
                    </div>
                    <div>
                      <p class="font-medium text-gray-900">
                        {{ conversation.name || 'Sem nome' }}
                      </p>
                      <p class="text-xs text-gray-500">{{ conversation.provider }}</p>
                    </div>
                  </div>
                </td>
                <td class="font-mono text-sm">{{ conversation.identifier }}</td>
                <td class="font-mono text-sm">{{ conversation.protocolNumber || '-' }}</td>
                <td>
                  <span
                    :class="getStatusBadgeClass(conversation.status)"
                    class="px-2.5 py-1 rounded-full text-xs font-medium"
                  >
                    {{ getStatusLabel(conversation.status) }}
                  </span>
                </td>
                <td>
                  <div v-if="conversation.tags && conversation.tags.length > 0" class="flex items-center gap-1">
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                      :style="{ backgroundColor: getTagColor(conversation.tags[0]) }"
                    >
                      {{ conversation.tags[0] }}
                    </span>
                    <span
                      v-if="conversation.tags.length > 1"
                      class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-200 text-gray-600 cursor-pointer hover:bg-gray-300"
                      @mouseenter="showTagsTooltip($event, conversation._id, conversation.tags)"
                      @mouseleave="hideTagsTooltip"
                      @click.stop
                    >
                      +{{ conversation.tags.length - 1 }}
                    </span>
                  </div>
                  <span v-else class="text-gray-400">-</span>
                </td>
                <td>
                  <span v-if="conversation.operatorName" class="text-gray-900">
                    {{ conversation.operatorName }}
                  </span>
                  <span v-else class="text-gray-400">-</span>
                </td>
                <td>
                  <div class="flex items-center gap-1 text-gray-500 text-sm">
                    <Clock class="w-4 h-4" />
                    {{ formatDate(conversation.updatedAt) }}
                  </div>
                </td>
                <td class="text-right">
                  <button
                    v-if="!conversation.archived"
                    @click="archiveConversation(conversation, $event)"
                    class="btn-ghost btn-sm"
                    title="Arquivar"
                  >
                    <Archive class="w-4 h-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Pagination -->
      <div class="mt-4">
        <Pagination
          v-if="pagination.totalPages > 1"
          :pagination="pagination"
          @page-change="handlePageChange"
        />
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
          class="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 lg:hidden max-h-[70vh] overflow-y-auto"
        >
          <div class="p-4">
            <!-- Handle -->
            <div class="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />

            <!-- Header -->
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
                  @click="statusFilter = ''"
                  :class="statusFilter === '' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700'"
                  class="px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                >
                  Todos
                </button>
                <button
                  @click="statusFilter = 'active'"
                  :class="statusFilter === 'active' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700'"
                  class="px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                >
                  Ativas
                </button>
                <button
                  @click="statusFilter = 'waiting'"
                  :class="statusFilter === 'waiting' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-700'"
                  class="px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                >
                  Aguardando
                </button>
                <button
                  @click="statusFilter = 'inactive'"
                  :class="statusFilter === 'inactive' ? 'bg-gray-500 text-white' : 'bg-gray-100 text-gray-700'"
                  class="px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                >
                  Inativas
                </button>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-3 pt-4 border-t border-gray-100">
              <button
                @click="clearFilters"
                class="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Limpar
              </button>
              <button
                @click="showFilters = false"
                class="flex-1 py-3 px-4 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Tags Tooltip -->
    <Teleport to="body">
      <div
        v-if="activeTooltip"
        class="fixed z-[9999] pointer-events-none"
        :style="{ left: tooltipPosition.x + 'px', top: tooltipPosition.y + 'px' }"
      >
        <div class="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-xl">
          <p class="font-medium mb-1.5 text-gray-300">Todas as tags:</p>
          <div class="flex flex-wrap gap-1 max-w-[200px]">
            <span
              v-for="tagName in tooltipTags"
              :key="tagName"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-white"
              :style="{ backgroundColor: getTagColor(tagName) }"
            >
              {{ tagName }}
            </span>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Create Modal -->
    <CreateConversationModal
      v-if="showCreateModal"
      @close="showCreateModal = false"
      @created="fetchConversations"
    />
  </div>
</template>

<style scoped>
.conversations-page {
  min-height: 100%;
}

/* Mobile optimizations */
@media (max-width: 1023px) {
  .conversations-page {
    padding-bottom: 2rem;
  }
}

.conversation-card {
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
