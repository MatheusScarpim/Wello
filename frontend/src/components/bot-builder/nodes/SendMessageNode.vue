<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { MessageSquare } from 'lucide-vue-next'

const props = defineProps<{
  id: string
  data: Record<string, any>
}>()

const label = computed(() => props.data?.label || 'Enviar Mensagem')

const messagePreview = computed(() => {
  const msg = props.data?.message
  if (!msg) return null
  return msg.length > 50 ? msg.substring(0, 50) + '...' : msg
})
</script>

<template>
  <div
    class="bg-blue-50 border-2 border-blue-300 rounded-xl shadow-sm min-w-[180px] max-w-[220px]"
  >
    <Handle
      type="target"
      :position="Position.Top"
      class="!bg-blue-500 !w-3 !h-3 !border-2 !border-white"
    />

    <div class="flex items-center gap-2 py-2 px-3">
      <div class="flex items-center justify-center w-6 h-6 rounded-md bg-blue-200 text-blue-700">
        <MessageSquare class="w-3.5 h-3.5" />
      </div>
      <span class="text-sm font-semibold text-blue-800 truncate">{{ label }}</span>
    </div>

    <div v-if="messagePreview" class="px-3 pb-2">
      <p class="text-xs text-blue-600 bg-blue-100 rounded-md px-2 py-1 truncate">
        {{ messagePreview }}
      </p>
    </div>

    <Handle
      type="source"
      :position="Position.Bottom"
      class="!bg-blue-500 !w-3 !h-3 !border-2 !border-white"
    />
  </div>
</template>
