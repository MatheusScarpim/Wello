<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { GitBranch } from 'lucide-vue-next'

const props = defineProps<{
  id: string
  data: Record<string, any>
}>()

const label = computed(() => props.data?.label || 'Condicao')

const conditions = computed<Array<{ id: string; label: string }>>(() => {
  return props.data?.conditions || []
})

const handleStyle = computed(() => {
  const count = conditions.value.length + 1
  return (index: number) => {
    const offset = ((index + 1) / (count + 1)) * 100
    return { left: `${offset}%` }
  }
})
</script>

<template>
  <div
    class="bg-fuchsia-50 border-2 border-fuchsia-300 rounded-xl shadow-sm min-w-[180px] max-w-[220px]"
  >
    <Handle
      type="target"
      :position="Position.Top"
      class="!bg-fuchsia-500 !w-3 !h-3 !border-2 !border-white"
    />

    <div class="flex items-center gap-2 py-2 px-3">
      <div class="flex items-center justify-center w-6 h-6 rounded-md bg-fuchsia-200 text-fuchsia-700">
        <GitBranch class="w-3.5 h-3.5" />
      </div>
      <span class="text-sm font-semibold text-fuchsia-800 truncate">{{ label }}</span>
    </div>

    <div v-if="conditions.length > 0" class="px-3 pb-2">
      <div class="flex flex-col gap-1">
        <span
          v-for="cond in conditions"
          :key="cond.id"
          class="text-[10px] font-medium text-fuchsia-700 bg-fuchsia-200 rounded-md px-2 py-0.5 truncate"
        >
          {{ cond.label }}
        </span>
        <span
          class="text-[10px] font-medium text-fuchsia-500 bg-fuchsia-100 rounded-md px-2 py-0.5 italic"
        >
          Senao (else)
        </span>
      </div>
    </div>

    <!-- Dynamic output handles per condition -->
    <Handle
      v-for="(cond, index) in conditions"
      :key="cond.id"
      :id="cond.id"
      type="source"
      :position="Position.Bottom"
      :style="handleStyle(index)"
      class="!bg-fuchsia-500 !w-3 !h-3 !border-2 !border-white"
    />

    <!-- Else output handle -->
    <Handle
      id="else"
      type="source"
      :position="Position.Bottom"
      :style="handleStyle(conditions.length)"
      class="!bg-fuchsia-400 !w-3 !h-3 !border-2 !border-white"
    />
  </div>
</template>
