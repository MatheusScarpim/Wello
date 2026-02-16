<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { Globe } from 'lucide-vue-next'

const props = defineProps<{
  id: string
  data: Record<string, any>
}>()

const label = computed(() => props.data?.label || 'Requisicao HTTP')

const method = computed(() => props.data?.method?.toUpperCase() || 'GET')

const urlPreview = computed(() => {
  const url = props.data?.url
  if (!url) return null
  return url.length > 30 ? url.substring(0, 30) + '...' : url
})

const methodColor = computed(() => {
  switch (method.value) {
    case 'GET':
      return 'bg-green-200 text-green-800'
    case 'POST':
      return 'bg-blue-200 text-blue-800'
    case 'PUT':
      return 'bg-yellow-200 text-yellow-800'
    case 'PATCH':
      return 'bg-purple-200 text-purple-800'
    case 'DELETE':
      return 'bg-red-200 text-red-800'
    default:
      return 'bg-gray-200 text-gray-800'
  }
})
</script>

<template>
  <div
    class="bg-orange-50 border-2 border-orange-300 rounded-xl shadow-sm min-w-[180px] max-w-[220px]"
  >
    <Handle
      type="target"
      :position="Position.Top"
      class="!bg-orange-500 !w-3 !h-3 !border-2 !border-white"
    />

    <div class="flex items-center gap-2 py-2 px-3">
      <div class="flex items-center justify-center w-6 h-6 rounded-md bg-orange-200 text-orange-700">
        <Globe class="w-3.5 h-3.5" />
      </div>
      <span class="text-sm font-semibold text-orange-800 truncate">{{ label }}</span>
    </div>

    <div class="px-3 pb-2 space-y-1">
      <div class="flex items-center gap-1.5">
        <span
          class="text-[10px] font-bold rounded px-1.5 py-0.5"
          :class="methodColor"
        >
          {{ method }}
        </span>
        <span v-if="urlPreview" class="text-[10px] text-orange-600 font-mono truncate">
          {{ urlPreview }}
        </span>
      </div>
    </div>

    <Handle
      type="source"
      :position="Position.Bottom"
      class="!bg-orange-500 !w-3 !h-3 !border-2 !border-white"
    />
  </div>
</template>
