<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { Clock } from 'lucide-vue-next'

const props = defineProps<{
  id: string
  data: Record<string, any>
}>()

const label = computed(() => props.data?.label || 'Atraso')

const formattedDelay = computed(() => {
  const seconds = props.data?.delay
  if (!seconds && seconds !== 0) return null

  const num = Number(seconds)
  if (isNaN(num)) return null

  if (num >= 3600) {
    const hours = Math.floor(num / 3600)
    const mins = Math.floor((num % 3600) / 60)
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }
  if (num >= 60) {
    const mins = Math.floor(num / 60)
    const secs = num % 60
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  }
  return `${num}s`
})
</script>

<template>
  <div
    class="bg-slate-100 border-2 border-slate-300 rounded-xl shadow-sm min-w-[180px] max-w-[220px]"
  >
    <Handle
      type="target"
      :position="Position.Top"
      class="!bg-slate-500 !w-3 !h-3 !border-2 !border-white"
    />

    <div class="flex items-center gap-2 py-2 px-3">
      <div class="flex items-center justify-center w-6 h-6 rounded-md bg-slate-200 text-slate-700">
        <Clock class="w-3.5 h-3.5" />
      </div>
      <span class="text-sm font-semibold text-slate-800 truncate">{{ label }}</span>
    </div>

    <div v-if="formattedDelay" class="px-3 pb-2">
      <span class="inline-block text-xs font-semibold text-slate-700 bg-slate-200 rounded-md px-2 py-1">
        {{ formattedDelay }}
      </span>
    </div>

    <Handle
      type="source"
      :position="Position.Bottom"
      class="!bg-slate-500 !w-3 !h-3 !border-2 !border-white"
    />
  </div>
</template>
