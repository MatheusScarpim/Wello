<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { Square, UserCheck } from 'lucide-vue-next'

const props = defineProps<{
  id: string
  data: Record<string, any>
}>()

const label = computed(() => props.data?.label || 'Fim')

const messagePreview = computed(() => {
  const msg = props.data?.finalMessage
  if (!msg) return null
  return msg.length > 50 ? msg.substring(0, 50) + '...' : msg
})

const showTransferBadge = computed(() => props.data?.transferToHuman === true)
</script>

<template>
  <div
    class="bg-red-50 border-2 border-red-300 rounded-xl shadow-sm min-w-[180px] max-w-[220px]"
  >
    <Handle
      type="target"
      :position="Position.Top"
      class="!bg-red-500 !w-3 !h-3 !border-2 !border-white"
    />

    <div class="flex items-center gap-2 py-2 px-3">
      <div class="flex items-center justify-center w-6 h-6 rounded-md bg-red-200 text-red-700">
        <Square class="w-3.5 h-3.5" />
      </div>
      <span class="text-sm font-semibold text-red-800 truncate">{{ label }}</span>
    </div>

    <div class="px-3 pb-2 space-y-1">
      <p v-if="messagePreview" class="text-xs text-red-600 bg-red-100 rounded-md px-2 py-1 truncate">
        {{ messagePreview }}
      </p>
      <div
        v-if="showTransferBadge"
        class="flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-100 rounded-full px-2 py-0.5 w-fit"
      >
        <UserCheck class="w-3 h-3" />
        <span>Transferir</span>
      </div>
    </div>
  </div>
</template>
