<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { queueApi, tagsApi, whatsappInstancesApi } from '@/api'
import type { Tag, WhatsAppInstance } from '@/types'
import { useOperatorStore } from '@/stores/operator'
import { useToast } from 'vue-toastification'
import { getSocket } from '@/services/socket'
import {
  Inbox,
  Search,
  RefreshCw,
  Clock,
  Tag as TagIcon,
  Smartphone,
} from 'lucide-vue-next'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import AssumirTicketItem from '@/components/conversations/AssumirTicketItem.vue'
import ConversationPreviewDrawer from '@/components/conversations/ConversationPreviewDrawer.vue'
import type { QueueItem } from '@/types'

const router = useRouter()
const toast = useToast()
const operatorStore = useOperatorStore()

type FilterTab = 'all' | 'new' | 'released'

const queue = ref<QueueItem[]>([])
const isLoading = ref(true)
const hasError = ref(false)
const searchQuery = ref('')
const activeFilter = ref<FilterTab>('all')
const claimingId = ref<string | null>(null)
const selectedItem = ref<QueueItem | null>(null)
const showPreview = ref(false)
const availableTags = ref<Tag[]>([])
const selectedTags = ref<string[]>([])
const availableInstances = ref<WhatsAppInstance[]>([])
const selectedInstance = ref<string | null>(null)
const now = ref(Date.now())

let refreshInterval: ReturnType<typeof setInterval>
let nowInterval: ReturnType<typeof setInterval>
let socketRefreshTimeout: ReturnType<typeof setTimeout> | null = null
let fetchSeq = 0
const socket = getSocket()
const handleSocketUpdate = () => {
  if (socketRefreshTimeout) {
    clearTimeout(socketRefreshTimeout)
  }
  socketRefreshTimeout = setTimeout(() => {
    fetchQueue()
  }, 600)
}

const currentOperatorId = computed(() => operatorStore.currentOperator?._id)

// Filter: "Novos" = waiting + never assigned; "Liberados" = waiting + previously assigned
const filteredQueue = computed(() => {
  let items = queue.value

  // Apply tab filter
  if (activeFilter.value === 'new') {
    items = items.filter(i => !i.assignedAt)
  } else if (activeFilter.value === 'released') {
    items = items.filter(i => !!i.assignedAt)
  }

  // Apply search
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    items = items.filter(i => {
      const name = i.conversation.name?.toLowerCase() || ''
      const identifier = i.conversation.identifier?.toLowerCase() || ''
      return name.includes(q) || identifier.includes(q)
    })
  }

  // Apply tag filter
  if (selectedTags.value.length > 0) {
    items = items.filter(i =>
      selectedTags.value.some(tag => i.tags.includes(tag))
    )
  }

  // Apply instance filter
  if (selectedInstance.value) {
    items = items.filter(i => i.conversation.instanceName === selectedInstance.value)
  }

  return items
})

const waitingCount = computed(() => queue.value.length)

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Tudo' },
  { key: 'new', label: 'Novos' },
  { key: 'released', label: 'Liberados' },
]

async function fetchQueue() {
  hasError.value = false
  const seq = ++fetchSeq
  try {
    const response = await queueApi.list({ status: 'waiting' })
    if (response.data) {
      if (seq !== fetchSeq) return
      const receivedAt = Date.now()
      queue.value = response.data.items.map(item => ({
        ...item,
        _receivedAt: receivedAt,
      }))
    }
  } catch {
    hasError.value = true
    if (!isLoading.value) {
      toast.error('Erro ao carregar fila')
    }
  } finally {
    isLoading.value = false
  }
}

async function handleClaim(item: QueueItem) {
  if (claimingId.value) return
  claimingId.value = item._id

  try {
    await operatorStore.assumeConversation(item.conversation._id)
    toast.success('Conversa assumida com sucesso')
    router.push(`/conversations/${item.conversation._id}`)
  } catch {
    toast.error('Já foi assumido por outro atendente')
    // Refresh the list to reflect current state
    fetchQueue()
  } finally {
    claimingId.value = null
  }
}

function handleRefresh() {
  isLoading.value = true
  fetchQueue()
}

function handlePreview(item: QueueItem) {
  selectedItem.value = item
  showPreview.value = true
}

function handleClaimFromPreview(item: QueueItem) {
  showPreview.value = false
  handleClaim(item)
}

function handleTagsUpdated(tags: string[]) {
  if (selectedItem.value) {
    // Update the item in the queue with new tags
    const index = queue.value.findIndex(q => q._id === selectedItem.value?._id)
    if (index !== -1) {
      queue.value[index].tags = tags
    }
    // Update selectedItem as well
    selectedItem.value.tags = tags
  }
}

async function fetchTags() {
  try {
    const response = await tagsApi.list()
    if (response.data) {
      availableTags.value = response.data
    }
  } catch (error) {
    console.error('Erro ao carregar tags:', error)
  }
}

function toggleTagFilter(tagName: string) {
  const index = selectedTags.value.indexOf(tagName)
  if (index === -1) {
    selectedTags.value.push(tagName)
  } else {
    selectedTags.value.splice(index, 1)
  }
}

async function fetchInstances() {
  try {
    const response = await whatsappInstancesApi.list()
    if (response.data) {
      availableInstances.value = response.data
    }
  } catch (error) {
    console.error('Erro ao carregar instâncias:', error)
  }
}

function selectInstance(instanceName: string | null) {
  selectedInstance.value = selectedInstance.value === instanceName ? null : instanceName
}

// Re-fetch when filter tab changes (in case we want server-side filtering later)
watch(activeFilter, () => {
  // Client-side filtering, no need to re-fetch
})

onMounted(async () => {
  // Ensure we have the current operator loaded
  if (!operatorStore.currentOperator) {
    await operatorStore.fetchCurrentOperator()
  }

  fetchQueue()
  fetchTags()
  fetchInstances()
  // Auto-refresh every 15 seconds
  refreshInterval = setInterval(fetchQueue, 15000)
  nowInterval = setInterval(() => {
    now.value = Date.now()
  }, 1000)

  window.addEventListener('ws:message', handleSocketUpdate)
  window.addEventListener('ws:conversation', handleSocketUpdate)
})

onUnmounted(() => {
  clearInterval(refreshInterval)
  if (socketRefreshTimeout) {
    clearTimeout(socketRefreshTimeout)
  }
  clearInterval(nowInterval)
  window.removeEventListener('ws:message', handleSocketUpdate)
  window.removeEventListener('ws:conversation', handleSocketUpdate)
})
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header com gradiente -->
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 p-4 sm:p-6 text-white shadow-xl">
      <!-- Elementos decorativos -->
      <div class="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
      <div class="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>

      <div class="relative flex items-center justify-between">
        <div>
          <div class="flex items-center gap-3">
            <div class="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
              <Inbox class="w-6 h-6" />
            </div>
            <div>
              <h1 class="text-xl sm:text-2xl font-bold">Assumir Atendimento</h1>
              <p class="text-primary-100 text-sm mt-0.5">
                Fila de espera
              </p>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- Contador animado -->
          <div class="text-center px-4 py-2 bg-white/10 rounded-xl backdrop-blur-sm">
            <p class="text-3xl sm:text-4xl font-bold">{{ waitingCount }}</p>
            <p class="text-xs text-primary-200 uppercase tracking-wide">aguardando</p>
          </div>

          <button
            @click="handleRefresh"
            class="p-3 bg-white/20 hover:bg-white/30 rounded-xl transition-all duration-200 backdrop-blur-sm"
            :disabled="isLoading"
          >
            <RefreshCw class="w-5 h-5" :class="{ 'animate-spin': isLoading }" />
          </button>
        </div>
      </div>
    </div>

    <!-- Filtros e busca -->
    <div class="space-y-3">
      <!-- Filter Tabs melhorados -->
      <div class="flex gap-1 bg-gray-100 rounded-xl p-1.5 shadow-inner">
        <button
          v-for="tab in filterTabs"
          :key="tab.key"
          @click="activeFilter = tab.key"
          class="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200"
          :class="
            activeFilter === tab.key
              ? 'bg-white text-primary-700 shadow-md'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          "
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Search melhorado -->
      <div class="relative">
        <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar por nome ou telefone..."
          class="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
        />
      </div>

      <!-- Tags Filter melhorado -->
      <div v-if="availableTags.length > 0" class="flex flex-wrap gap-2">
        <button
          v-for="tag in availableTags"
          :key="tag._id"
          @click="toggleTagFilter(tag.name)"
          class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 shadow-sm"
          :class="selectedTags.includes(tag.name)
            ? 'text-white shadow-md scale-105'
            : 'bg-white text-gray-700 hover:shadow-md border border-gray-200'"
          :style="selectedTags.includes(tag.name) ? { backgroundColor: tag.color } : {}"
        >
          <div
            v-if="!selectedTags.includes(tag.name)"
            class="w-3 h-3 rounded-full"
            :style="{ backgroundColor: tag.color }"
          />
          <TagIcon v-else class="w-3.5 h-3.5" />
          {{ tag.name }}
        </button>
      </div>

      <!-- Instance Filter -->
      <div v-if="availableInstances.length > 1" class="flex flex-wrap gap-2">
        <span class="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mr-1">
          <Smartphone class="w-3.5 h-3.5" />
          Instância:
        </span>
        <button
          v-for="instance in availableInstances"
          :key="instance.id"
          @click="selectInstance(instance.name)"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
          :class="selectedInstance === instance.name
            ? 'bg-emerald-500 text-white shadow-md scale-105'
            : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'"
        >
          <span
            class="w-2 h-2 rounded-full"
            :class="instance.connected ? 'bg-emerald-400' : 'bg-gray-300'"
          />
          {{ instance.name }}
        </button>
      </div>
    </div>

    <!-- Loading skeleton melhorado -->
    <div v-if="isLoading" class="space-y-3">
      <div
        v-for="n in 4"
        :key="n"
        class="bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse overflow-hidden"
      >
        <div class="p-4 flex items-center gap-4">
          <div class="w-12 h-12 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex-shrink-0" />
          <div class="flex-1 space-y-3">
            <div class="flex items-center gap-2">
              <div class="h-4 bg-gray-200 rounded-lg w-1/3" />
              <div class="h-5 bg-emerald-100 rounded-full w-16" />
            </div>
            <div class="h-3 bg-gray-100 rounded w-2/3" />
            <div class="flex gap-2">
              <div class="h-5 bg-gray-100 rounded-full w-16" />
              <div class="h-5 bg-gray-100 rounded-full w-20" />
            </div>
          </div>
          <div class="w-24 h-10 bg-primary-100 rounded-xl flex-shrink-0" />
        </div>
      </div>
    </div>

    <!-- Error state melhorado -->
    <div v-else-if="hasError" class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="p-8 sm:p-12 text-center">
        <div class="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-2xl flex items-center justify-center">
          <Inbox class="w-8 h-8 text-red-500" />
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Erro ao carregar</h3>
        <p class="text-gray-500 mb-6">Não foi possível carregar a fila de atendimento.</p>
        <button
          @click="handleRefresh"
          class="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
        >
          <RefreshCw class="w-4 h-4" />
          Tentar novamente
        </button>
      </div>
    </div>

    <!-- Empty state melhorado -->
    <div v-else-if="filteredQueue.length === 0" class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="p-8 sm:p-12 text-center">
        <div class="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center">
          <Clock v-if="!searchQuery" class="w-10 h-10 text-gray-400" />
          <Search v-else class="w-10 h-10 text-gray-400" />
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">
          {{ searchQuery ? 'Nenhum resultado' : 'Fila vazia' }}
        </h3>
        <p class="text-gray-500 max-w-sm mx-auto">
          {{ searchQuery
            ? 'Nenhuma conversa encontrada para essa busca.'
            : 'Todas as conversas estão sendo atendidas no momento. Bom trabalho!' }}
        </p>
      </div>
    </div>

    <!-- Queue List melhorado -->
    <div v-else class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
      <TransitionGroup name="list">
        <AssumirTicketItem
          v-for="item in filteredQueue"
          :key="item._id"
          :item="item"
          :now="now"
          :current-operator-id="currentOperatorId"
          :claiming="claimingId === item._id"
          @claim="handleClaim"
          @preview="handlePreview"
        />
      </TransitionGroup>
    </div>

    <!-- Preview Drawer (Mobile) -->
    <ConversationPreviewDrawer
      :item="selectedItem"
      :open="showPreview"
      @close="showPreview = false"
      @claim="handleClaimFromPreview"
      @tags-updated="handleTagsUpdated"
    />
  </div>
</template>

<style scoped>
/* Animações de lista */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.list-move {
  transition: transform 0.3s ease;
}
</style>
