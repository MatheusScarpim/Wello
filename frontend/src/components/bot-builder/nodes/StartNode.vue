<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { Play } from 'lucide-vue-next'

const props = defineProps<{
  id: string
  data: Record<string, any>
}>()

const label = computed(() => props.data?.label || 'Inicio')

const welcomePreview = computed(() => {
  const msg = props.data?.welcomeMessage
  if (!msg) return null
  return msg.length > 50 ? msg.substring(0, 50) + '...' : msg
})
</script>

<template>
  <div
    class="bg-green-50 border-2 border-green-300 rounded-xl shadow-sm min-w-[180px] max-w-[220px]"
  >
    <div class="flex items-center gap-2 py-2 px-3">
      <div class="flex items-center justify-center w-6 h-6 rounded-md bg-green-200 text-green-700">
        <Play class="w-3.5 h-3.5" />
      </div>
      <span class="text-sm font-semibold text-green-800 truncate">{{ label }}</span>
    </div>

    <div v-if="welcomePreview" class="px-3 pb-2">
      <p class="text-xs text-green-600 bg-green-100 rounded-md px-2 py-1 truncate">
        {{ welcomePreview }}
      </p>
    </div>

    <Handle
      type="source"
      :position="Position.Bottom"
      class="!bg-green-500 !w-3 !h-3 !border-2 !border-white"
    />
  </div>
</template>
