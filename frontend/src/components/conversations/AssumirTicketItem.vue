<script setup lang="ts">
import { computed } from 'vue'
import { Clock, MessageSquare, Tag, User, ChevronRight, Loader2, Smartphone } from 'lucide-vue-next'
import type { QueueItem } from '@/types'

const props = defineProps<{
  item: QueueItem
  currentOperatorId?: string
  claiming?: boolean
  now?: number
}>()

const emit = defineEmits<{
  claim: [item: QueueItem]
  preview: [item: QueueItem]
}>()

function handleCardClick() {
  // No mobile, abre o preview ao clicar no card
  if (window.innerWidth < 640 && !isLockedByOther.value) {
    emit('preview', props.item)
  }
}

const contactName = computed(() =>
  props.item.conversation.name || props.item.conversation.identifier
)

const contactInitial = computed(() =>
  contactName.value?.charAt(0)?.toUpperCase() || '?'
)

const channelInfo = computed(() => {
  const p = props.item.conversation.provider?.toLowerCase()
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
})

const lastMessagePreview = computed(() => {
  const msg = props.item.conversation.lastMessage
  if (!msg) return null
  if (msg.type !== 'text') return `[${msg.type}]`
  const text = msg.message || ''
  return text.length > 80 ? text.slice(0, 80) + '...' : text
})

const waitTimeFormatted = computed(() => {
  const seconds = props.item.waitTime
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
})

const isLockedByOther = computed(() => {
  if (!props.currentOperatorId) return false
  return (
    props.item.operatorId != null &&
    props.item.operatorId !== props.currentOperatorId
  )
})

const isOfferedToMe = computed(() => {
  if (!props.item.offerOperatorId || !props.currentOperatorId) return false
  return props.item.offerOperatorId === props.currentOperatorId
})

const isOfferedToOther = computed(() => {
  if (!props.item.offerOperatorId || !props.currentOperatorId) return false
  return props.item.offerOperatorId !== props.currentOperatorId
})

const offerLabel = computed(() => {
  if (!props.item.offerOperatorId) return null
  return isOfferedToMe.value
    ? 'Oferta para você'
    : `Reservado para ${props.item.offerOperatorName || 'outro operador'}`
})

const offerCountdown = computed(() => {
  const baseNow = props.now ?? Date.now()
  if (props.item.offerRemainingSeconds != null) {
    const receivedAt = props.item._receivedAt ?? baseNow
    const elapsedSeconds = Math.max(
      0,
      Math.floor((baseNow - receivedAt) / 1000),
    )
    const remaining = Math.max(
      0,
      Math.round(props.item.offerRemainingSeconds - elapsedSeconds),
    )
    if (remaining <= 0) return null
    if (remaining >= 60) {
      const minutes = Math.floor(remaining / 60)
      const seconds = remaining % 60
      return `${minutes}m${seconds > 0 ? ` ${seconds}s` : ''}`
    }
    return `${remaining}s`
  }

  if (!props.item.offerExpiresAt) return null
  const raw = props.item.offerExpiresAt
  let expiresAt: Date
  if (typeof raw === 'string' && /^\d+$/.test(raw)) {
    const numeric = Number(raw)
    expiresAt = new Date(numeric < 1e12 ? numeric * 1000 : numeric)
  } else {
    expiresAt = new Date(raw)
  }
  const diffSeconds = Math.max(
    0,
    Math.round((expiresAt.getTime() - baseNow) / 1000),
  )
  if (diffSeconds <= 0) return null
  if (diffSeconds >= 60) {
    const minutes = Math.floor(diffSeconds / 60)
    const seconds = diffSeconds % 60
    return `${minutes}m${seconds > 0 ? ` ${seconds}s` : ''}`
  }
  return `${diffSeconds}s`
})

const canClaim = computed(
  () => !isLockedByOther.value && !props.claiming && !isOfferedToOther.value,
)
</script>

<template>
  <div
    class="group p-4 border-b border-gray-100 last:border-b-0 transition-all duration-200 cursor-pointer sm:cursor-default"
    :class="isLockedByOther
      ? 'bg-gray-50/80 opacity-60'
      : 'bg-white hover:bg-gradient-to-r hover:from-primary-50/50 hover:to-transparent sm:hover:shadow-sm'"
    @click="handleCardClick"
  >
    <div class="flex items-center gap-4">
      <!-- Avatar com indicador de canal -->
      <div class="relative flex-shrink-0">
        <div
          class="w-12 h-12 rounded-full flex items-center justify-center ring-2 ring-offset-2 transition-all"
          :class="channelInfo
            ? `ring-${channelInfo.color.includes('emerald') ? 'emerald' : channelInfo.color.includes('sky') ? 'sky' : channelInfo.color.includes('blue') ? 'blue' : 'pink'}-200`
            : 'ring-gray-200'"
          :style="!item.conversation.photo ? { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' } : {}"
        >
          <img
            v-if="item.conversation.photo"
            :src="item.conversation.photo"
            :alt="contactName"
            class="w-12 h-12 rounded-full object-cover"
          />
          <span v-else class="text-lg font-bold text-white">
            {{ contactInitial }}
          </span>
        </div>
        <!-- Badge de prioridade -->
        <span
          v-if="item.priority > 1"
          class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold shadow-lg animate-pulse"
        >
          !
        </span>
        <!-- Indicador de canal no avatar (mobile) -->
        <span
          v-if="channelInfo"
          class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md sm:hidden"
          :class="[channelInfo.color, channelInfo.textColor]"
        >
          {{ channelInfo.label.charAt(0) }}
        </span>
      </div>

      <!-- Info -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <h4 class="font-semibold text-gray-900 truncate text-base">{{ contactName }}</h4>
          <!-- Badge do canal (desktop) -->
          <span
            v-if="channelInfo"
            class="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-sm"
            :class="[channelInfo.color, channelInfo.textColor]"
          >
            {{ channelInfo.label }}
          </span>
        </div>

        <p
          v-if="lastMessagePreview"
          class="text-sm text-gray-600 truncate mt-1 leading-relaxed"
        >
          {{ lastMessagePreview }}
        </p>

        <div class="flex items-center gap-3 mt-2 flex-wrap">
          <!-- Tempo de espera com cor dinâmica -->
          <span
            class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
            :class="item.waitTime > 300
              ? 'bg-red-100 text-red-700'
              : item.waitTime > 120
                ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-gray-600'"
          >
            <Clock class="w-3.5 h-3.5" />
            {{ waitTimeFormatted }}
          </span>

          <span
            v-if="item.department"
            class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 truncate max-w-[120px]"
          >
            {{ item.department.name }}
          </span>

          <!-- Instance badge -->
          <span
            v-if="item.conversation.instanceName"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700"
          >
            <Smartphone class="w-3 h-3" />
            {{ item.conversation.instanceName }}
          </span>

          <div
            v-if="item.tags.length > 0"
            class="relative group/tags"
          >
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 cursor-default"
            >
              <Tag class="w-3 h-3" />
              {{ item.tags[0] }}
              <span v-if="item.tags.length > 1" class="opacity-70">+{{ item.tags.length - 1 }}</span>
            </span>
            <!-- Tooltip com todas as tags -->
            <div
              v-if="item.tags.length > 1"
              class="absolute left-0 top-full mt-1 z-[100] hidden group-hover/tags:block pointer-events-none"
            >
              <div class="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg whitespace-nowrap">
                <p class="font-medium mb-1 text-gray-300">Todas as tags:</p>
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="tag in item.tags"
                    :key="tag"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <span
            v-if="offerLabel"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
            :class="isOfferedToMe ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'"
          >
            {{ offerLabel }}
            <span v-if="offerCountdown" class="opacity-80 text-[10px]">· {{ offerCountdown }}</span>
          </span>
        </div>
      </div>

      <!-- Action -->
      <div class="flex-shrink-0">
        <template v-if="isLockedByOther">
          <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 whitespace-nowrap">
            <User class="w-3.5 h-3.5" />
            Em atendimento
          </span>
        </template>
        <template v-else>
          <!-- Desktop: botao assumir melhorado -->
          <button
            @click.stop="emit('claim', item)"
            :disabled="!canClaim"
            class="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Loader2 v-if="claiming" class="w-4 h-4 animate-spin" />
            <MessageSquare v-else class="w-4 h-4" />
            <span>{{ isOfferedToOther ? 'Reservado' : 'Assumir' }}</span>
          </button>
          <!-- Mobile: indicador de toque melhorado -->
          <div class="sm:hidden flex items-center gap-1 text-primary-500 group-hover:translate-x-1 transition-transform">
            <span class="text-xs font-medium">Ver</span>
            <ChevronRight class="w-5 h-5" />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
