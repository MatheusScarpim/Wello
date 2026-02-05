<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  User,
  X,
  MessageSquare,
  Image,
  FileText,
  Mic,
  Video,
  MapPin,
  Tag as TagIcon,
  Sticker
} from 'lucide-vue-next'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import type { Conversation, Message, Tag } from '@/types'

export interface FinalizationInfo {
  type: 'gain' | 'loss'
  name: string
  date?: string
  notes?: string
  operatorName?: string
}

const props = defineProps<{
  show: boolean
  conversation: Conversation | null
  messages: Message[]
  loading?: boolean
  finalizationInfo?: FinalizationInfo
  availableTags?: Tag[]
}>()

const emit = defineEmits<{
  close: []
}>()

const previewMedia = ref<{ url: string; type: 'image' | 'video' | 'sticker' | 'audio' } | null>(null)

function openMediaPreview(url: string, type: 'image' | 'video' | 'sticker' | 'audio') {
  previewMedia.value = { url, type }
}

function closeMediaPreview() {
  previewMedia.value = null
}

function handleEscapeKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && previewMedia.value) {
    closeMediaPreview()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEscapeKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEscapeKeydown)
})

// Helpers
function formatDateTime(date?: string) {
  if (!date) return '-'
  return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: ptBR })
}

function formatMessageTime(date?: string) {
  if (!date) return ''
  return format(new Date(date), 'HH:mm', { locale: ptBR })
}

function getConversationFinalizationEntries(conversation?: Conversation) {
  if (!conversation) return []
  if (Array.isArray(conversation.finalizations) && conversation.finalizations.length) {
    return conversation.finalizations
  }
  if (conversation.finalizationId) {
    return [
      {
        finalizationId: conversation.finalizationId,
        finalizationName: conversation.finalizationName,
        finalizationType: conversation.finalizationType as 'gain' | 'loss',
      },
    ]
  }
  return []
}

function getConversationFinalizationTooltip(conversation?: Conversation) {
  return getConversationFinalizationEntries(conversation)
    .map((entry) => entry.finalizationName || entry.finalizationId || '-')
    .join(', ')
}

function getConversationFinalizationBadgeType(conversation?: Conversation) {
  return getConversationFinalizationEntries(conversation)[0]?.finalizationType ?? 'gain'
}

const conversationFinalizations = computed(() => getConversationFinalizationEntries(props.conversation))

function getQuotedMessage(msg: Message): Message | null {
  if (!msg.quotedMessageId) return null
  return props.messages.find(m => m._id === msg.quotedMessageId) || null
}

function getMessagePreview(message: Message): string {
  if (message.type === 'text' || message.type === 'chat') return message.message
  if (message.type === 'image') return '[Imagem]'
  if (message.type === 'sticker') return '[Sticker]'
  if (message.type === 'audio' || message.type === 'ptt') return '[Áudio]'
  if (message.type === 'video') return '[Vídeo]'
  if (message.type === 'document') return `[Documento: ${message.filename || 'arquivo'}]`
  if (message.type === 'location') return '[Localização]'
  return `[${message.type}]`
}

function getMessageIcon(type: string) {
  switch (type) {
    case 'image': return Image
    case 'sticker': return Sticker
    case 'document': return FileText
    case 'audio':
    case 'ptt': return Mic
    case 'video': return Video
    case 'location': return MapPin
    default: return MessageSquare
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

function getProviderInfo(provider?: string) {
  const p = provider?.toLowerCase()
  if (p?.includes('whatsapp') || p === 'wpp') {
    return { label: 'WhatsApp', color: 'bg-emerald-500', textColor: 'text-white' }
  }
  if (p?.includes('instagram') || p === 'ig') {
    return { label: 'Instagram', color: 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400', textColor: 'text-white' }
  }
  if (p?.includes('telegram')) {
    return { label: 'Telegram', color: 'bg-sky-500', textColor: 'text-white' }
  }
  if (p?.includes('facebook') || p === 'fb') {
    return { label: 'Facebook', color: 'bg-blue-600', textColor: 'text-white' }
  }
  return null
}

function getFinalizationBadgeClass(entry?: { finalizationType?: 'gain' | 'loss' }) {
  if (entry?.finalizationType === 'loss') {
    return 'bg-red-50 text-red-700 border border-red-100'
  }
  return 'bg-emerald-50 text-emerald-700 border border-emerald-100'
}

function getTagColor(tagName: string): string {
  if (!props.availableTags) return '#6B7280'
  const tag = props.availableTags.find(t => t.name === tagName)
  return tag?.color || '#6B7280'
}

// Tags helper
const conversationTags = computed<string[]>(() => {
  if (!props.conversation?.tags) return []
  if (Array.isArray(props.conversation.tags)) return props.conversation.tags
  if (typeof props.conversation.tags === 'string') {
    try {
      const parsed = JSON.parse(props.conversation.tags)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
})

// Show finalization badge when we have finalization info
const showFinalizationBadge = computed(() => {
  return props.finalizationInfo?.type
})

// Show status badge when no finalization info
const showStatusBadge = computed(() => {
  return !props.finalizationInfo && props.conversation?.status
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/50"
        @click="emit('close')"
      />

      <!-- Modal Content -->
      <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-200">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
              <img
                v-if="conversation?.photo"
                :src="conversation.photo"
                :alt="conversation?.name || 'Contato'"
                class="w-10 h-10 object-cover"
              />
              <User v-else class="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <h3 class="font-semibold text-gray-900">
                {{ conversation?.name || 'Sem nome' }}
              </h3>
              <p class="text-sm text-gray-500">{{ conversation?.identifier }}</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <!-- Finalization Badge -->
            <span
              v-if="showFinalizationBadge"
              class="badge"
              :class="finalizationInfo?.type === 'gain' ? 'badge-success' : 'badge-danger'"
            >
              {{ finalizationInfo?.type === 'gain' ? 'Ganho' : 'Perda' }}
            </span>
            <!-- Status Badge -->
            <span
              v-if="showStatusBadge"
              :class="getStatusBadgeClass(conversation!.status)"
              class="px-2.5 py-1 rounded-full text-xs font-medium"
            >
              {{ getStatusLabel(conversation!.status) }}
            </span>
            <button
              @click="emit('close')"
              class="p-2 rounded-lg hover:bg-gray-100"
            >
              <X class="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <!-- Info Bar -->
        <div class="px-4 py-2 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-4 text-sm">
          <div>
            <span class="text-gray-500">Operador:</span>
            <span class="ml-1 font-medium">{{ finalizationInfo?.operatorName || conversation?.operatorName || '-' }}</span>
          </div>
          <div v-if="conversation?.protocolNumber">
            <span class="text-gray-500">Protocolo:</span>
            <span class="ml-1 font-medium">{{ conversation.protocolNumber }}</span>
          </div>
          <div v-if="conversation?.provider">
            <span
              v-if="getProviderInfo(conversation.provider)"
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-sm"
              :class="[getProviderInfo(conversation.provider)?.color, getProviderInfo(conversation.provider)?.textColor]"
            >
              {{ getProviderInfo(conversation.provider)?.label }}
            </span>
            <span v-else class="ml-1 font-medium">{{ conversation.provider }}</span>
          </div>
          <div v-if="conversation?.createdAt">
            <span class="text-gray-500">Criado em:</span>
            <span class="ml-1 font-medium">{{ formatDateTime(conversation.createdAt) }}</span>
          </div>
        </div>

        <!-- Finalization Info (when available) -->
        <div
          v-if="finalizationInfo"
          class="px-4 py-2 border-b border-gray-200 flex flex-wrap gap-4 text-sm"
          :class="finalizationInfo.type === 'gain' ? 'bg-emerald-50' : 'bg-red-50'"
        >
          <div>
            <span class="text-gray-500">Finalização:</span>
            <span
              class="ml-1 font-medium"
              :class="finalizationInfo.type === 'gain' ? 'text-emerald-700' : 'text-red-700'"
            >
              {{ finalizationInfo.name }}
            </span>
          </div>
          <div v-if="finalizationInfo.date">
            <span class="text-gray-500">Data:</span>
            <span class="ml-1 font-medium">{{ formatDateTime(finalizationInfo.date) }}</span>
          </div>
          <div v-if="finalizationInfo.notes">
            <span class="text-gray-500">Notas:</span>
            <span class="ml-1 font-medium">{{ finalizationInfo.notes }}</span>
          </div>
        </div>

        <div
          v-if="conversationFinalizations.length > 0"
          class="px-4 py-2 border-b border-gray-200 flex flex-wrap items-center gap-2 text-sm"
        >
          <span class="text-gray-500">Finalizações registradas:</span>
          <div class="flex flex-wrap items-center gap-2">
            <span
              v-for="entry in conversationFinalizations.slice(0, 2)"
              :key="entry.finalizationId || entry.finalizationName"
              class="inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-medium border shadow-sm"
              :class="getFinalizationBadgeClass(entry)"
              :title="entry.finalizationName || entry.finalizationId || '-'"
            >
              {{ entry.finalizationName || entry.finalizationId || '-' }}
            </span>
            <div
              v-if="conversationFinalizations.length > 2"
              class="relative group/finalizations inline-flex"
            >
              <span class="text-xs px-2 py-0.5 rounded-full border border-gray-200 bg-gray-100 text-gray-600">
                +{{ conversationFinalizations.length - 2 }}
              </span>
              <div
                class="absolute left-0 top-full mt-1 z-[100] hidden min-w-[220px] flex-col gap-1 rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-lg group-hover/finalizations:flex"
              >
                <p class="text-xs font-semibold text-gray-500">Outras finalizações</p>
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="entry in conversationFinalizations.slice(2)"
                    :key="entry.finalizationId || entry.finalizationName"
                    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="getFinalizationBadgeClass(entry)"
                  >
                    {{ entry.finalizationName || entry.finalizationId || '-' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Conversation Finalization Info (from conversation object) -->
        <div
          v-else-if="conversation?.status === 'finalized' && conversation?.finalizationName"
          class="px-4 py-2 border-b border-gray-200 flex flex-wrap gap-4 text-sm"
          :class="conversation.finalizationType === 'gain' ? 'bg-emerald-50' : 'bg-red-50'"
        >
          <div>
            <span class="text-gray-500">Finalização:</span>
            <span
              class="ml-1 font-medium"
              :class="conversation.finalizationType === 'gain' ? 'text-emerald-700' : 'text-red-700'"
            >
              {{ conversation.finalizationName }}
            </span>
          </div>
          <div>
            <span class="text-gray-500">Tipo:</span>
            <span
              class="ml-1 font-medium px-2 py-0.5 rounded-full text-xs"
              :class="conversation.finalizationType === 'gain'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700'"
            >
              {{ conversation.finalizationType === 'gain' ? 'Ganho' : 'Perda' }}
            </span>
          </div>
          <div v-if="conversation.finalizationAt">
            <span class="text-gray-500">Finalizado em:</span>
            <span class="ml-1 font-medium">{{ formatDateTime(conversation.finalizationAt) }}</span>
          </div>
        </div>

        <!-- Tags -->
        <div
          v-if="conversationTags.length > 0"
          class="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2"
        >
          <span class="text-sm text-gray-500">Tags:</span>
          <div class="relative group/tags flex items-center gap-1">
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
              :style="{ backgroundColor: getTagColor(conversationTags[0]) }"
            >
              <TagIcon class="w-3 h-3" />
              {{ conversationTags[0] }}
            </span>
            <span
              v-if="conversationTags.length > 1"
              class="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600 cursor-default"
            >
              +{{ conversationTags.length - 1 }}
            </span>
            <!-- Tooltip com todas as tags -->
            <div
              v-if="conversationTags.length > 1"
              class="absolute left-0 top-full mt-1 z-[100] hidden group-hover/tags:block pointer-events-none"
            >
              <div class="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg whitespace-nowrap">
                <p class="font-medium mb-1.5 text-gray-300">Todas as tags:</p>
                <div class="flex flex-wrap gap-1 max-w-[200px]">
                  <span
                    v-for="tagName in conversationTags"
                    :key="tagName"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white"
                    :style="{ backgroundColor: getTagColor(tagName) }"
                  >
                    <TagIcon class="w-3 h-3" />
                    {{ tagName }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Messages -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-100" style="min-height: 300px; max-height: 500px;">
          <div v-if="loading" class="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>

          <template v-else-if="messages.length > 0">
            <div
              v-for="msg in messages"
              :key="msg._id"
              class="flex flex-col"
              :class="msg.direction === 'outgoing' ? 'items-end' : 'items-start'"
            >
              <!-- Operator name for outgoing messages -->
              <p
                v-if="msg.direction === 'outgoing' && msg.operatorName"
                class="text-xs text-gray-500 mb-1 mr-1"
              >
                {{ msg.operatorName }}
              </p>
              <div
                class="max-w-[70%] rounded-lg px-4 py-2 shadow-sm"
                :class="msg.direction === 'outgoing'
                  ? 'bg-blue-500 text-white rounded-br-none'
                  : 'bg-white text-gray-900 rounded-bl-none'"
              >
                <!-- Quoted/Reply Message -->
                <div
                  v-if="getQuotedMessage(msg)"
                  class="mb-2 p-2 rounded border-l-4"
                  :class="msg.direction === 'outgoing'
                    ? 'bg-blue-400/30 border-blue-300'
                    : 'bg-gray-100 border-gray-300'"
                >
                  <p class="text-xs font-medium opacity-75 mb-0.5">
                    {{ getQuotedMessage(msg)?.direction === 'incoming' ? 'Cliente' : 'Operador' }}
                  </p>
                  <p class="text-sm opacity-90 line-clamp-2">
                    {{ getMessagePreview(getQuotedMessage(msg)!) || '[Mídia]' }}
                  </p>
                </div>

                <!-- Media indicator -->
                <div
                  v-if="msg.type !== 'text' && msg.type !== 'chat'"
                  class="flex items-center gap-1.5 mb-1"
                  :class="msg.direction === 'outgoing' ? 'opacity-75' : 'text-gray-500'"
                >
                  <component :is="getMessageIcon(msg.type)" class="w-3.5 h-3.5" />
                  <span class="text-xs">{{ msg.type === 'ptt' ? 'áudio' : msg.type }}</span>
                </div>

                <!-- Image preview -->
                <button
                  v-if="msg.type === 'image' && msg.mediaUrl"
                  type="button"
                  class="relative mb-1 block w-full max-w-[220px] rounded-lg overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                  @click="openMediaPreview(msg.mediaUrl, 'image')"
                >
                  <img
                    :src="msg.mediaUrl"
                    class="w-full h-full object-cover"
                    style="max-height: 200px;"
                    loading="lazy"
                    alt="Imagem enviada"
                  />
                </button>

                <!-- Sticker preview -->
                <button
                  v-else-if="msg.type === 'sticker' && msg.mediaUrl"
                  type="button"
                  class="relative mb-1 block w-full max-w-[220px] rounded-lg overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                  @click="openMediaPreview(msg.mediaUrl, 'sticker')"
                >
                  <img
                    :src="msg.mediaUrl"
                    class="w-full h-full object-cover"
                    style="max-height: 200px;"
                    loading="lazy"
                    alt="Sticker enviado"
                  />
                </button>

                <!-- Video preview -->
                <button
                  v-else-if="msg.type === 'video' && msg.mediaUrl"
                  type="button"
                  class="relative mb-1 flex w-full max-w-[220px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-xs font-semibold uppercase tracking-wide text-gray-500 transition hover:border-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                  @click="openMediaPreview(msg.mediaUrl, 'video')"
                >
                  <Video class="w-4 h-4 text-gray-500" />
                  <span class="ml-1">Vídeo</span>
                </button>

                <!-- Audio preview -->
                <button
                  v-else-if="(msg.type === 'audio' || msg.type === 'ptt') && msg.mediaUrl"
                  type="button"
                  class="relative mb-1 flex w-full max-w-[220px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-xs font-semibold uppercase tracking-wide text-gray-500 transition hover:border-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                  @click="openMediaPreview(msg.mediaUrl, 'audio')"
                >
                  <Mic class="w-4 h-4 text-gray-500" />
                  <span class="ml-1">Áudio</span>
                </button>

                <!-- Message text -->
                <p class="whitespace-pre-wrap break-words">{{ msg.message }}</p>
                <p
                  class="text-xs mt-1"
                  :class="msg.direction === 'outgoing' ? 'text-blue-100' : 'text-gray-400'"
                >
                  {{ formatMessageTime(msg.createdAt) }}
                </p>
              </div>
            </div>
          </template>

          <div v-else class="flex flex-col items-center justify-center py-12 text-gray-500">
            <MessageSquare class="w-8 h-8 mb-2 opacity-50" />
            <p>Nenhuma mensagem encontrada</p>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-4 border-t border-gray-200 flex justify-between items-center">
          <p class="text-sm text-gray-500">
            {{ messages.length }} mensagens
          </p>
          <button @click="emit('close')" class="btn-primary">
            Fechar
          </button>
        </div>
      </div>
    </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="previewMedia"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6"
        @click.self="closeMediaPreview"
      >
        <button
          type="button"
          class="absolute top-4 right-4 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          @click="closeMediaPreview"
        >
          <X class="w-4 h-4" />
        </button>
        <div class="relative max-h-full max-w-full" @click.stop>
          <img
            v-if="previewMedia?.type === 'image' || previewMedia?.type === 'sticker'"
            :src="previewMedia.url"
            class="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
            loading="eager"
            alt="Visualização da mídia"
          />
          <audio
            v-else-if="previewMedia?.type === 'audio'"
            :src="previewMedia.url"
            controls
            autoplay
            class="max-w-[90vw] rounded-lg bg-white px-3 py-2 shadow-2xl"
          />
          <video
            v-else
            :src="previewMedia?.url"
            controls
            autoplay
            playsinline
            class="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
          />
        </div>
      </div>
    </Teleport>
</template>
