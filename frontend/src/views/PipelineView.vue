<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useToast } from 'vue-toastification'
import {
  Settings, KanbanSquare, Search, Filter, CheckSquare,
  ArrowRightLeft, X, RefreshCw
} from 'lucide-vue-next'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import PipelineCard from '@/components/pipeline/PipelineCard.vue'
import PipelineStageModal from '@/components/pipeline/PipelineStageModal.vue'
import PipelineBulkMoveMenu from '@/components/pipeline/PipelineBulkMoveMenu.vue'
import { pipelineApi, pipelineStagesApi, tagsApi, operatorsApi } from '@/api'
import type { PipelineBoardColumn, PipelineStage, Tag, Operator } from '@/types'

const toast = useToast()

// Board data
const columns = ref<PipelineBoardColumn[]>([])
const stages = ref<PipelineStage[]>([])
const isLoading = ref(true)
const showStageModal = ref(false)
const dragOverStageId = ref<string | null>(null)
const isDragging = ref(false)

// Search & filters
const searchQuery = ref('')
const searchTimeout = ref<ReturnType<typeof setTimeout>>()
const showFilters = ref(false)
const filterProviders = ref<string[]>([])
const filterOperatorId = ref('')
const filterTag = ref('')

// Tags & operators for filters
const availableTags = ref<Tag[]>([])
const availableOperators = ref<Operator[]>([])

// Selection mode
const selectedConversations = ref<Set<string>>(new Set())
const isSelectionMode = ref(false)
const showBulkMoveMenu = ref(false)

// Tag color map
const tagColorMap = computed(() => {
  const map: Record<string, string> = {}
  for (const tag of availableTags.value) {
    map[tag.name] = tag.color
  }
  return map
})

// Only real stages (exclude __no_stage__)
const realStages = computed(() => {
  return stages.value.filter(s => s._id !== '__no_stage__')
})

// Active filters count
const activeFiltersCount = computed(() => {
  let count = 0
  if (filterProviders.value.length > 0) count += filterProviders.value.length
  if (filterOperatorId.value) count++
  if (filterTag.value) count++
  return count
})

// Filtered columns
const filteredColumns = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  const hasFilters = query || filterProviders.value.length > 0 || filterOperatorId.value || filterTag.value

  if (!hasFilters) return columns.value

  return columns.value.map(col => {
    const filtered = col.conversations.filter(conv => {
      // Search
      if (query) {
        const name = (conv.name || '').toLowerCase()
        const identifier = (conv.identifier || '').toLowerCase()
        if (!name.includes(query) && !identifier.includes(query)) return false
      }

      // Provider filter
      if (filterProviders.value.length > 0) {
        const provider = conv.provider?.toLowerCase() || ''
        const match = filterProviders.value.some(fp => {
          if (fp === 'whatsapp') return provider.includes('whatsapp') || provider === 'wpp'
          if (fp === 'instagram') return provider.includes('instagram') || provider === 'ig'
          if (fp === 'facebook') return provider.includes('facebook') || provider.includes('meta') || provider === 'fb'
          return false
        })
        if (!match) return false
      }

      // Operator filter
      if (filterOperatorId.value) {
        if (conv.operatorId !== filterOperatorId.value) return false
      }

      // Tag filter
      if (filterTag.value) {
        const convTags = Array.isArray(conv.tags) ? conv.tags : (conv.tags ? [conv.tags] : [])
        if (!convTags.includes(filterTag.value)) return false
      }

      return true
    })

    return { ...col, conversations: filtered, total: filtered.length }
  })
})

// Data fetching
async function fetchBoard() {
  try {
    const response = await pipelineApi.getBoard()
    if (response.data) {
      columns.value = response.data
    }
  } catch {
    toast.error('Erro ao carregar o quadro')
  } finally {
    isLoading.value = false
  }
}

async function fetchStages() {
  try {
    const response = await pipelineStagesApi.list()
    if (response.data) {
      stages.value = response.data
    }
  } catch {
    // silent
  }
}

async function fetchTags() {
  try {
    const response = await tagsApi.list()
    if (response.data) {
      availableTags.value = response.data
    }
  } catch {
    // silent
  }
}

async function fetchOperators() {
  try {
    const response = await operatorsApi.list()
    if (response.data) {
      availableOperators.value = response.data
    }
  } catch {
    // silent
  }
}

function refreshAll() {
  fetchBoard()
}

// Search handler (debounced)
function handleSearch() {
  clearTimeout(searchTimeout.value)
  searchTimeout.value = setTimeout(() => {
    // filteredColumns computed handles this reactively
  }, 300)
}

// Provider filter toggle
function toggleProvider(provider: string) {
  const idx = filterProviders.value.indexOf(provider)
  if (idx >= 0) {
    filterProviders.value.splice(idx, 1)
  } else {
    filterProviders.value.push(provider)
  }
}

function clearFilters() {
  filterProviders.value = []
  filterOperatorId.value = ''
  filterTag.value = ''
  searchQuery.value = ''
}

// Drag and drop
function onDragStart(event: DragEvent, conversationId: string) {
  isDragging.value = true
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', conversationId)
  }
}

function onDragEnter(stageId: string) {
  dragOverStageId.value = stageId
}

function onDragLeave(event: DragEvent, stageId: string) {
  const relatedTarget = event.relatedTarget as HTMLElement | null
  const currentTarget = event.currentTarget as HTMLElement | null
  if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
    return
  }
  if (dragOverStageId.value === stageId) {
    dragOverStageId.value = null
  }
}

async function onDrop(event: DragEvent, stageId: string) {
  dragOverStageId.value = null
  isDragging.value = false
  const conversationId = event.dataTransfer?.getData('text/plain')
  if (!conversationId) return

  // Check if already in this stage
  const targetColumn = columns.value.find(col => col.stage._id === stageId)
  if (targetColumn?.conversations.some(c => c._id === conversationId)) {
    return
  }

  // Map __no_stage__ to null
  const effectiveStageId = stageId === '__no_stage__' ? null : stageId

  try {
    await pipelineApi.move(conversationId, effectiveStageId)
    toast.success('Conversa movida com sucesso')
    refreshAll()
  } catch {
    toast.error('Erro ao mover conversa')
  }
}

function onDragEnd() {
  isDragging.value = false
  dragOverStageId.value = null
}

// Selection
function toggleSelection(conversationId: string) {
  const newSet = new Set(selectedConversations.value)
  if (newSet.has(conversationId)) {
    newSet.delete(conversationId)
  } else {
    newSet.add(conversationId)
  }
  selectedConversations.value = newSet
}

function clearSelection() {
  selectedConversations.value = new Set()
  isSelectionMode.value = false
  showBulkMoveMenu.value = false
}

async function bulkMove(stageId: string | null) {
  if (selectedConversations.value.size === 0) return

  try {
    await pipelineApi.bulkMove([...selectedConversations.value], stageId)
    toast.success(`${selectedConversations.value.size} conversas movidas`)
    clearSelection()
    refreshAll()
  } catch {
    toast.error('Erro ao mover conversas')
  }
  showBulkMoveMenu.value = false
}

// Stage modal callback
function onStagesUpdated() {
  showStageModal.value = false
  fetchStages()
  refreshAll()
}

// WebSocket real-time
function onPipelineUpdate() {
  if (isDragging.value) return
  refreshAll()
  fetchStages()
}

onMounted(() => {
  isLoading.value = true
  fetchBoard()
  fetchStages()
  fetchTags()
  fetchOperators()
  window.addEventListener('ws:pipeline', onPipelineUpdate)
})

onUnmounted(() => {
  window.removeEventListener('ws:pipeline', onPipelineUpdate)
  clearTimeout(searchTimeout.value)
})
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Quadro</h1>
        <p class="text-gray-500 text-sm">Organize suas conversas em etapas.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <!-- Search -->
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            v-model="searchQuery"
            @input="handleSearch"
            class="input pl-10 w-56 text-sm"
            placeholder="Buscar por nome ou telefone..."
          />
        </div>

        <!-- Filters toggle -->
        <button
          @click="showFilters = !showFilters"
          class="btn-outline relative text-sm"
          :class="{ 'bg-primary-50 border-primary-300': showFilters }"
        >
          <Filter class="w-4 h-4" />
          Filtros
          <span
            v-if="activeFiltersCount > 0"
            class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary-600 text-white rounded-full text-[10px] flex items-center justify-center font-bold"
          >
            {{ activeFiltersCount }}
          </span>
        </button>

        <!-- Selection toggle -->
        <button
          @click="isSelectionMode = !isSelectionMode; if (!isSelectionMode) clearSelection()"
          class="btn-ghost text-sm"
          :class="{ 'bg-primary-50 text-primary-700': isSelectionMode }"
          title="Modo de selecao"
        >
          <CheckSquare class="w-4 h-4" />
        </button>

        <!-- Bulk move button -->
        <div v-if="selectedConversations.size > 0" class="relative">
          <button
            @click="showBulkMoveMenu = !showBulkMoveMenu"
            class="btn-primary text-sm"
          >
            <ArrowRightLeft class="w-4 h-4" />
            Mover {{ selectedConversations.size }}
          </button>
          <PipelineBulkMoveMenu
            v-if="showBulkMoveMenu"
            :stages="realStages"
            :selected-count="selectedConversations.size"
            @move="bulkMove"
            @close="showBulkMoveMenu = false"
          />
        </div>

        <!-- Refresh -->
        <button @click="refreshAll" class="btn-ghost text-sm" title="Atualizar">
          <RefreshCw class="w-4 h-4" />
        </button>

        <!-- Stage config -->
        <button @click="showStageModal = true" class="btn-outline text-sm">
          <Settings class="w-4 h-4" />
          Etapas
        </button>
      </div>
    </div>

    <!-- Filter Panel -->
    <div v-if="showFilters" class="card card-body flex flex-wrap items-end gap-4">
      <!-- Provider chips -->
      <div>
        <p class="text-xs font-medium text-gray-500 mb-1.5">Canal</p>
        <div class="flex gap-1.5">
          <button
            v-for="p in [{ key: 'whatsapp', label: 'WhatsApp', color: 'emerald' }, { key: 'instagram', label: 'Instagram', color: 'pink' }, { key: 'facebook', label: 'Facebook', color: 'blue' }]"
            :key="p.key"
            @click="toggleProvider(p.key)"
            class="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
            :class="filterProviders.includes(p.key)
              ? `bg-${p.color}-100 text-${p.color}-700 border-${p.color}-300`
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'"
          >
            {{ p.label }}
          </button>
        </div>
      </div>

      <!-- Operator select -->
      <div>
        <p class="text-xs font-medium text-gray-500 mb-1.5">Operador</p>
        <select v-model="filterOperatorId" class="select text-sm w-44">
          <option value="">Todos</option>
          <option v-for="op in availableOperators" :key="op._id" :value="op._id">
            {{ op.name }}
          </option>
        </select>
      </div>

      <!-- Tag select -->
      <div>
        <p class="text-xs font-medium text-gray-500 mb-1.5">Tag</p>
        <select v-model="filterTag" class="select text-sm w-44">
          <option value="">Todas</option>
          <option v-for="tag in availableTags" :key="tag._id" :value="tag.name">
            {{ tag.name }}
          </option>
        </select>
      </div>

      <!-- Clear -->
      <button
        v-if="activeFiltersCount > 0"
        @click="clearFilters"
        class="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
      >
        <X class="w-3 h-3" />
        Limpar filtros
      </button>
    </div>

    <!-- Loading State -->
    <div
      v-if="isLoading"
      class="bg-white rounded-xl border border-gray-200 flex items-center justify-center py-32"
    >
      <LoadingSpinner size="lg" />
    </div>

    <!-- Empty State -->
    <div
      v-else-if="columns.length === 0"
      class="bg-white rounded-xl border border-gray-200 p-12 text-center"
    >
      <div class="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <KanbanSquare class="w-8 h-8 text-gray-400" />
      </div>
      <h3 class="font-semibold text-gray-900 mb-1">Nenhuma etapa configurada</h3>
      <p class="text-sm text-gray-500 mb-4">
        Configure as etapas do quadro para comecar a organizar suas conversas.
      </p>
      <button @click="showStageModal = true" class="btn-primary">
        <Settings class="w-4 h-4" />
        Configurar Etapas
      </button>
    </div>

    <!-- Kanban Board -->
    <div v-else class="overflow-x-auto pb-4">
      <div class="flex gap-4" style="min-width: max-content;">
        <div
          v-for="column in filteredColumns"
          :key="column.stage._id"
          class="w-80 flex-shrink-0 rounded-xl transition-all duration-200"
          :class="[
            dragOverStageId === column.stage._id
              ? 'ring-2 ring-primary-400 bg-primary-50'
              : column.stage._id === '__no_stage__'
                ? 'bg-gray-100/50'
                : 'bg-gray-50'
          ]"
          @dragover.prevent
          @dragenter="onDragEnter(column.stage._id)"
          @dragleave="onDragLeave($event, column.stage._id)"
          @drop="onDrop($event, column.stage._id)"
        >
          <!-- Column Header -->
          <div
            class="p-4 rounded-t-xl"
            :class="column.stage._id === '__no_stage__' ? 'border-t-4 border-dashed' : 'border-t-4'"
            :style="{ borderTopColor: column.stage.color }"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <h3 class="font-semibold text-gray-900 truncate">
                  {{ column.stage.name }}
                </h3>
                <span
                  class="text-xs px-2 py-0.5 rounded-full font-medium"
                  :style="{
                    backgroundColor: column.stage.color + '20',
                    color: column.stage.color
                  }"
                >
                  {{ column.total }}
                </span>
              </div>
            </div>
          </div>

          <!-- Column Body -->
          <div
            class="p-3 space-y-3 overflow-y-auto"
            style="max-height: calc(100vh - 16rem); min-height: 200px;"
          >
            <div
              v-for="conversation in column.conversations"
              :key="conversation._id"
              @dragstart="onDragStart($event, conversation._id)"
              @dragend="onDragEnd"
              draggable="true"
              class="cursor-grab active:cursor-grabbing"
            >
              <PipelineCard
                :conversation="conversation"
                :stage-color="column.stage.color"
                :is-selectable="isSelectionMode"
                :is-selected="selectedConversations.has(conversation._id)"
                :tag-colors="tagColorMap"
                @select="toggleSelection"
              />
            </div>

            <!-- Empty Column State -->
            <div
              v-if="column.conversations.length === 0"
              class="flex flex-col items-center justify-center py-8 text-center"
            >
              <p class="text-sm text-gray-400">
                {{ column.stage._id === '__no_stage__' ? 'Todas as conversas estao em etapas' : 'Nenhuma conversa nesta etapa' }}
              </p>
              <p class="text-xs text-gray-300 mt-1">Arraste conversas para ca</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pipeline Stage Modal -->
    <PipelineStageModal
      v-model="showStageModal"
      @updated="onStagesUpdated"
    />
  </div>
</template>
