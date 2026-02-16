<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { MousePointerClick } from 'lucide-vue-next'

const props = defineProps<{
  id: string
  data: Record<string, any>
}>()

const label = computed(() => props.data?.label || 'Botoes')

const buttons = computed<Array<{ id: string; label: string }>>(() => {
  return props.data?.buttons || []
})

const handleStyle = computed(() => {
  const count = buttons.value.length + 1
  return (index: number) => {
    const offset = ((index + 1) / (count + 1)) * 100
    return { left: `${offset}%` }
  }
})
</script>

<template>
  <div
    class="bg-violet-50 border-2 border-violet-300 rounded-xl shadow-sm min-w-[180px] max-w-[220px]"
  >
    <Handle
      type="target"
      :position="Position.Top"
      class="!bg-violet-500 !w-3 !h-3 !border-2 !border-white"
    />

    <div class="flex items-center gap-2 py-2 px-3">
      <div class="flex items-center justify-center w-6 h-6 rounded-md bg-violet-200 text-violet-700">
        <MousePointerClick class="w-3.5 h-3.5" />
      </div>
      <span class="text-sm font-semibold text-violet-800 truncate">{{ label }}</span>
    </div>

    <div v-if="buttons.length > 0" class="px-3 pb-2">
      <div class="flex flex-wrap gap-1">
        <span
          v-for="btn in buttons"
          :key="btn.id"
          class="inline-block text-[10px] font-medium text-violet-700 bg-violet-200 rounded-full px-2 py-0.5 truncate max-w-[90px]"
        >
          {{ btn.label }}
        </span>
      </div>
    </div>

    <!-- Default output handle -->
    <Handle
      id="default"
      type="source"
      :position="Position.Bottom"
      :style="handleStyle(0)"
      class="!bg-violet-400 !w-3 !h-3 !border-2 !border-white"
    />

    <!-- Dynamic output handles per button -->
    <Handle
      v-for="(btn, index) in buttons"
      :key="btn.id"
      :id="btn.id"
      type="source"
      :position="Position.Bottom"
      :style="handleStyle(index + 1)"
      class="!bg-violet-500 !w-3 !h-3 !border-2 !border-white"
    />
  </div>
</template>
