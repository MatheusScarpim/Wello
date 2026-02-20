<script setup lang="ts">
import {
  Smile,
  Reply,
  Forward,
  Pencil,
  Trash2,
  Star,
  Copy,
} from 'lucide-vue-next'
import type { Message } from '@/types'

const props = defineProps<{
  message: Message
  x: number
  y: number
}>()

const emit = defineEmits<{
  (e: 'react', message: Message): void
  (e: 'reply', message: Message): void
  (e: 'forward', message: Message): void
  (e: 'edit', message: Message): void
  (e: 'delete', message: Message): void
  (e: 'star', message: Message): void
  (e: 'copy', message: Message): void
  (e: 'close'): void
}>()

const actions = [
  { icon: Smile, label: 'Reagir', event: 'react' as const, show: true },
  { icon: Reply, label: 'Responder', event: 'reply' as const, show: true },
  { icon: Forward, label: 'Encaminhar', event: 'forward' as const, show: true },
  { icon: Copy, label: 'Copiar', event: 'copy' as const, show: !!props.message.message },
  { icon: Pencil, label: 'Editar', event: 'edit' as const, show: props.message.direction === 'outgoing' && props.message.type === 'text' },
  { icon: Trash2, label: 'Apagar', event: 'delete' as const, show: true },
  { icon: Star, label: 'Favoritar', event: 'star' as const, show: true },
]

function handleAction(event: 'react' | 'reply' | 'forward' | 'edit' | 'delete' | 'star' | 'copy') {
  emit(event, props.message)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div class="fixed inset-0 z-[60]" @click="emit('close')" @contextmenu.prevent="emit('close')" />

    <!-- Menu -->
    <div
      class="fixed z-[61] bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 w-44 animate-scale-in"
      :style="{ left: `${x}px`, top: `${y}px` }"
      @click.stop
    >
      <button
        v-for="action in actions.filter(a => a.show)"
        :key="action.event"
        @click="handleAction(action.event)"
        class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
        :class="{ 'text-red-600 hover:bg-red-50': action.event === 'delete' }"
      >
        <component :is="action.icon" class="w-4 h-4" />
        <span>{{ action.label }}</span>
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.animate-scale-in {
  animation: scaleIn 0.12s ease-out;
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>
