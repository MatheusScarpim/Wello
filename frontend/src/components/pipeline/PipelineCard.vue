<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
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

const lastMessageText = computed(() => {
  const msg = props.conversation.lastMessage
  if (!msg) return 'Nenhuma mensagem'

  if (msg.type === 'text' || msg.type === 'chat') return msg.message
  if (msg.type === 'image') return '[Imagem]'
  if (msg.type === 'audio' || msg.type === 'ptt') return '[Audio]'
  if (msg.type === 'video') return '[Video]'
  if (msg.type === 'document') return `[Documento: ${msg.filename || 'arquivo'}]`
  if (msg.type === 'sticker') return '[Sticker]'
  if (msg.type === 'location') return '[Localização]'
  if (msg.type === 'contact') return '[Contato]'
  return `[${msg.type}]`
})

const timeAgo = computed(() => {
  const date = props.conversation.lastMessage?.createdAt || props.conversation.updatedAt
  if (!date) return ''
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR })
})

const providerBadge = computed(() => {
  const provider = props.conversation.provider?.toLowerCase()
  if (provider?.includes('whatsapp') || provider === 'wpp') {
    return { label: 'WA', classes: 'bg-emerald-100 text-emerald-700' }
  }
  if (provider?.includes('instagram') || provider === 'ig') {
    return { label: 'IG', classes: 'bg-pink-100 text-pink-700' }
  }
  if (provider?.includes('meta') || provider?.includes('facebook') || provider === 'fb') {
    return { label: 'FB', classes: 'bg-blue-100 text-blue-700' }
  }
  return { label: provider?.slice(0, 2)?.toUpperCase() || '??', classes: 'bg-gray-100 text-gray-600' }
})

const tags = computed(() => {
  if (!props.conversation.tags) return []
  if (typeof props.conversation.tags === 'string') return [props.conversation.tags]
  return props.conversation.tags
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
    class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md transition-all"
    :class="{
      'cursor-pointer': isSelectable,
      'cursor-grab active:cursor-grabbing': !isSelectable,
      'ring-2 ring-primary-400 border-primary-300': isSelected,
      'border-l-4': stageColor
    }"
    :style="stageColor ? { borderLeftColor: stageColor } : {}"
    @click="handleClick"
    @dragstart="handleDragStart"
  >
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

    <!-- Top row: contact name + provider badge -->
    <div class="flex items-center justify-between gap-2 mb-1">
      <span class="font-semibold text-sm text-gray-900 truncate">
        {{ contactDisplayName }}
      </span>
      <span
        class="flex-shrink-0 inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none"
        :class="providerBadge.classes"
      >
        {{ providerBadge.label }}
      </span>
    </div>

    <!-- Phone/identifier -->
    <p v-if="conversation.name && conversation.identifier" class="text-xs text-gray-400 mb-1 truncate">
      {{ conversation.identifier }}
    </p>

    <!-- Last message preview -->
    <p class="text-sm text-gray-500 line-clamp-2 mb-2 break-words">
      {{ lastMessageText }}
    </p>

    <!-- Tags as colored pills -->
    <div v-if="tags.length > 0" class="flex flex-wrap gap-1 mb-2">
      <span
        v-for="tag in tags.slice(0, 3)"
        :key="tag"
        class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium"
        :style="{
          backgroundColor: (tagColors?.[tag] || '#6B7280') + '20',
          color: tagColors?.[tag] || '#6B7280'
        }"
      >
        {{ tag }}
      </span>
      <span v-if="tags.length > 3" class="text-[10px] text-gray-400">
        +{{ tags.length - 3 }}
      </span>
    </div>

    <!-- Bottom row: operator badge + time -->
    <div class="flex items-center justify-between gap-2">
      <span
        v-if="conversation.operatorName"
        class="inline-flex items-center px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 text-xs font-medium truncate max-w-[60%]"
      >
        {{ conversation.operatorName }}
      </span>
      <span v-else class="text-xs text-gray-300">Sem operador</span>

      <span class="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
        {{ timeAgo }}
      </span>
    </div>
  </div>
</template>
