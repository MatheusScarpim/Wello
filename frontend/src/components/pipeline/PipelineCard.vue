<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MessageSquare, Clock, User, Image, Mic, Video, FileText, MapPin, UserCircle, Sparkles } from 'lucide-vue-next'
import type { Conversation } from '@/types'

const props = defineProps<{
  conversation: Conversation
  stageColor?: string
  isSelectable?: boolean
  isSelected?: boolean
  tagColors?: Record<string, string>
}>()

const emit = defineEmits<{
  dragstart: [conversationId: string]
  select: [conversationId: string]
}>()

const router = useRouter()

const contactDisplayName = computed(() => {
  return props.conversation.name || props.conversation.identifier || 'Sem nome'
})

const contactInitial = computed(() => {
  return contactDisplayName.value.charAt(0).toUpperCase()
})

const lastMessageInfo = computed(() => {
  const msg = props.conversation.lastMessage
  if (!msg) return { text: 'Nenhuma mensagem', icon: MessageSquare }

  if (msg.type === 'text' || msg.type === 'chat') return { text: msg.message, icon: null }
  if (msg.type === 'image') return { text: 'Imagem', icon: Image }
  if (msg.type === 'audio' || msg.type === 'ptt') return { text: 'Áudio', icon: Mic }
  if (msg.type === 'video') return { text: 'Vídeo', icon: Video }
  if (msg.type === 'document') return { text: msg.filename || 'Documento', icon: FileText }
  if (msg.type === 'sticker') return { text: 'Sticker', icon: Image }
  if (msg.type === 'location') return { text: 'Localização', icon: MapPin }
  if (msg.type === 'contact') return { text: 'Contato', icon: UserCircle }
  return { text: msg.type, icon: MessageSquare }
})

const timeAgo = computed(() => {
  const date = props.conversation.lastMessage?.createdAt || props.conversation.updatedAt
  if (!date) return ''
  return formatDistanceToNow(new Date(date), { addSuffix: false, locale: ptBR })
})

const providerBadge = computed(() => {
  const provider = props.conversation.provider?.toLowerCase()
  if (provider?.includes('whatsapp') || provider === 'wpp') {
    return { label: 'WA', bg: 'bg-emerald-500', text: 'text-white' }
  }
  if (provider?.includes('instagram') || provider === 'ig') {
    return { label: 'IG', bg: 'bg-gradient-to-r from-purple-500 to-pink-500', text: 'text-white' }
  }
  if (provider?.includes('meta') || provider?.includes('facebook') || provider === 'fb') {
    return { label: 'FB', bg: 'bg-blue-600', text: 'text-white' }
  }
  return { label: provider?.slice(0, 2)?.toUpperCase() || '??', bg: 'bg-gray-400', text: 'text-white' }
})

const tags = computed(() => {
  if (!props.conversation.tags) return []
  if (typeof props.conversation.tags === 'string') return [props.conversation.tags]
  return props.conversation.tags
})

const hasUnread = computed(() => {
  const msg = props.conversation.lastMessage
  return msg && msg.direction === 'incoming' && !props.conversation.operatorId
})

function handleClick() {
  if (props.isSelectable) {
    emit('select', props.conversation._id)
    return
  }
  router.push(`/conversations/${props.conversation._id}`)
}

function handleDragStart(event: DragEvent) {
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', props.conversation._id)
  }
  emit('dragstart', props.conversation._id)
}
</script>

<template>
  <div
    draggable="true"
    class="group bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-200 overflow-hidden"
    :class="{
      'cursor-pointer': isSelectable,
      'cursor-grab active:cursor-grabbing': !isSelectable,
      'ring-2 ring-primary-400 border-primary-300 shadow-md': isSelected,
    }"
    @click="handleClick"
    @dragstart="handleDragStart"
  >
    <!-- Color accent bar -->
    <div
      v-if="stageColor"
      class="h-1 w-full"
      :style="{ backgroundColor: stageColor }"
    />

    <div class="p-3">
      <!-- Selection checkbox -->
      <div v-if="isSelectable" class="flex items-center gap-2 mb-2">
        <input
          type="checkbox"
          :checked="isSelected"
          class="rounded border-gray-300 text-primary-600 w-4 h-4"
          @click.stop="emit('select', conversation._id)"
        />
        <span class="text-xs text-gray-400">Selecionar</span>
      </div>

      <!-- Header: Avatar + Name + Provider -->
      <div class="flex items-start gap-2.5 mb-2">
        <!-- Mini avatar -->
        <div
          class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white shadow-sm"
          :style="{ background: stageColor ? `linear-gradient(135deg, ${stageColor}, ${stageColor}dd)` : 'linear-gradient(135deg, #667eea, #764ba2)' }"
        >
          {{ contactInitial }}
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="font-semibold text-sm text-gray-900 truncate">
              {{ contactDisplayName }}
            </span>
            <!-- Unread dot -->
            <span
              v-if="hasUnread"
              class="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 animate-pulse"
            />
          </div>
          <!-- Phone/identifier -->
          <p v-if="conversation.name && conversation.identifier" class="text-[11px] text-gray-400 truncate leading-tight">
            {{ conversation.identifier }}
          </p>
        </div>

        <!-- Provider badge -->
        <span
          class="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md text-[9px] font-bold leading-none"
          :class="[providerBadge.bg, providerBadge.text]"
        >
          {{ providerBadge.label }}
        </span>
      </div>

      <!-- AI Summary (notes) -->
      <div
        v-if="conversation.notes"
        class="flex items-start gap-1.5 text-[11px] text-teal-700 bg-teal-50/80 border border-teal-100 rounded-lg px-2 py-1.5 mb-2 line-clamp-2 break-words"
      >
        <Sparkles class="w-3 h-3 flex-shrink-0 mt-0.5 text-teal-500" />
        <span>{{ conversation.notes }}</span>
      </div>

      <!-- Last message preview -->
      <div class="flex items-start gap-1.5 mb-2">
        <component
          v-if="lastMessageInfo.icon"
          :is="lastMessageInfo.icon"
          class="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5"
        />
        <p class="text-[12px] text-gray-500 line-clamp-2 break-words leading-relaxed">
          {{ lastMessageInfo.text }}
        </p>
      </div>

      <!-- Tags -->
      <div v-if="tags.length > 0" class="flex flex-wrap gap-1 mb-2">
        <span
          v-for="tag in tags.slice(0, 3)"
          :key="tag"
          class="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
          :style="{
            backgroundColor: (tagColors?.[tag] || '#6B7280') + '15',
            color: tagColors?.[tag] || '#6B7280',
            border: `1px solid ${(tagColors?.[tag] || '#6B7280')}30`
          }"
        >
          {{ tag }}
        </span>
        <span v-if="tags.length > 3" class="text-[10px] text-gray-400 self-center">
          +{{ tags.length - 3 }}
        </span>
      </div>

      <!-- Footer: operator + time -->
      <div class="flex items-center justify-between gap-2 pt-2 border-t border-gray-50">
        <div class="flex items-center gap-1.5 min-w-0">
          <User class="w-3 h-3 flex-shrink-0" :class="conversation.operatorName ? 'text-primary-500' : 'text-gray-300'" />
          <span
            v-if="conversation.operatorName"
            class="text-[11px] font-medium text-primary-700 truncate"
          >
            {{ conversation.operatorName }}
          </span>
          <span v-else class="text-[11px] text-gray-300 italic">Sem operador</span>
        </div>

        <div class="flex items-center gap-1 text-gray-400 flex-shrink-0">
          <Clock class="w-3 h-3" />
          <span class="text-[11px]">{{ timeAgo }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
