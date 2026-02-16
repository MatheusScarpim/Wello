<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { Code } from 'lucide-vue-next'

const props = defineProps<{
  id: string
  data: Record<string, any>
}>()

const label = computed(() => props.data?.label || 'Definir Variavel')

const assignments = computed<Array<{ variable: string; value: string }>>(() => {
  return props.data?.assignments || []
})
</script>

<template>
  <div
    class="bg-slate-50 border-2 border-slate-300 rounded-xl shadow-sm min-w-[180px] max-w-[220px]"
  >
    <Handle
      type="target"
      :position="Position.Top"
      class="!bg-slate-500 !w-3 !h-3 !border-2 !border-white"
    />

    <div class="flex items-center gap-2 py-2 px-3">
      <div class="flex items-center justify-center w-6 h-6 rounded-md bg-slate-200 text-slate-700">
        <Code class="w-3.5 h-3.5" />
      </div>
      <span class="text-sm font-semibold text-slate-800 truncate">{{ label }}</span>
    </div>

    <div v-if="assignments.length > 0" class="px-3 pb-2">
      <div class="flex flex-col gap-1">
        <div
          v-for="(assignment, index) in assignments"
          :key="index"
          class="flex items-center gap-1 text-[10px]"
        >
          <span class="font-mono font-medium text-slate-700 bg-slate-200 rounded px-1.5 py-0.5 truncate max-w-[70px]">
            {{ assignment.variable }}
          </span>
          <span class="text-slate-400">=</span>
          <span class="text-slate-600 bg-slate-100 rounded px-1.5 py-0.5 truncate max-w-[70px]">
            {{ assignment.value }}
          </span>
        </div>
      </div>
    </div>

    <Handle
      type="source"
      :position="Position.Bottom"
      class="!bg-slate-500 !w-3 !h-3 !border-2 !border-white"
    />
  </div>
</template>
