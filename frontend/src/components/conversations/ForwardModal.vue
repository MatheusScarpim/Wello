<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { X, Search, Forward, Loader2 } from 'lucide-vue-next'
import { conversationsApi } from '@/api'
import { useToast } from 'vue-toastification'
import type { Conversation } from '@/types'

const props = defineProps<{
  modelValue: boolean
  messageId: string
  sessionName: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'forward', toChatId: string): void
}>()

const toast = useToast()
const search = ref('')
const conversations = ref<Conversation[]>([])
const isLoading = ref(false)
const isForwarding = ref(false)
const selectedConversation = ref<string | null>(null)

const filteredConversations = computed(() => {
  if (!search.value.trim()) return conversations.value
  const q = search.value.toLowerCase()
  return conversations.value.filter(c =>
    (c.name || '').toLowerCase().includes(q) ||
    (c.identifier || '').toLowerCase().includes(q)
  )
})

async function loadConversations() {
  isLoading.value = true
  try {
    const response = await conversationsApi.list({ limit: 100, page: 1 })
    conversations.value = response.data?.items || []
  } catch {
    toast.error('Erro ao carregar conversas')
  } finally {
    isLoading.value = false
  }
}

async function confirmForward() {
  if (!selectedConversation.value) return
  const conv = conversations.value.find(c => c._id === selectedConversation.value)
  if (!conv) return

  isForwarding.value = true
  try {
    emit('forward', conv.identifier)
    close()
  } finally {
    isForwarding.value = false
  }
}

function close() {
  emit('update:modelValue', false)
  selectedConversation.value = null
  search.value = ''
}

onMounted(() => {
  if (props.modelValue) loadConversations()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
      @click.self="close"
    >
      <div class="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[80vh] flex flex-col animate-slide-up sm:animate-none sm:m-4">
        <!-- Header -->
        <div class="flex items-center justify-between p-3 border-b border-gray-100">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Forward class="w-4 h-4 text-blue-600" />
            </div>
            <h2 class="font-semibold text-gray-900 text-sm">Encaminhar Mensagem</h2>
          </div>
          <button @click="close" class="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Search -->
        <div class="px-3 py-2 border-b border-gray-100">
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              v-model="search"
              type="text"
              class="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="Buscar conversa..."
              @input="!conversations.length && loadConversations()"
            />
          </div>
        </div>

        <!-- Conversation list -->
        <div class="flex-1 overflow-y-auto">
          <div v-if="isLoading" class="flex items-center justify-center py-8">
            <Loader2 class="w-6 h-6 text-primary-500 animate-spin" />
          </div>
          <div v-else-if="filteredConversations.length === 0" class="text-center py-8 text-sm text-gray-400">
            Nenhuma conversa encontrada
          </div>
          <button
            v-for="conv in filteredConversations"
            :key="conv._id"
            @click="selectedConversation = conv._id"
            class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
            :class="selectedConversation === conv._id ? 'bg-primary-50 border-l-2 border-primary-500' : ''"
          >
            <div class="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
              <span class="text-sm font-medium text-gray-600">{{ (conv.name || conv.identifier || '?')[0].toUpperCase() }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 truncate">{{ conv.name || conv.identifier }}</p>
              <p class="text-xs text-gray-500 truncate">{{ conv.identifier }}</p>
            </div>
          </button>
        </div>

        <!-- Footer -->
        <div class="p-3 border-t border-gray-100 flex gap-2">
          <button @click="close" class="btn-secondary flex-1 py-2.5 text-sm">
            Cancelar
          </button>
          <button
            @click="confirmForward"
            :disabled="!selectedConversation || isForwarding"
            class="btn-primary flex-1 justify-center py-2.5 text-sm"
          >
            <Loader2 v-if="isForwarding" class="w-4 h-4 animate-spin" />
            <Forward v-else class="w-4 h-4" />
            <span>Encaminhar</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
