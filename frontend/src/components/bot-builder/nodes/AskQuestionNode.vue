<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { HelpCircle } from 'lucide-vue-next'

const props = defineProps<{
  id: string
  data: Record<string, any>
}>()

const label = computed(() => props.data?.label || 'Fazer Pergunta')

const questionPreview = computed(() => {
  const q = props.data?.question
  if (!q) return null
  return q.length > 50 ? q.substring(0, 50) + '...' : q
})

const variableName = computed(() => props.data?.variableName || null)
const variableDisplay = computed(() =>
  variableName.value ? `\u007B\u007B${variableName.value}\u007D\u007D` : null,
)
</script>

<template>
  <div
    class="bg-amber-50 border-2 border-amber-300 rounded-xl shadow-sm min-w-[180px] max-w-[220px]"
  >
    <Handle
      type="target"
      :position="Position.Top"
      class="!bg-amber-500 !w-3 !h-3 !border-2 !border-white"
    />

    <div class="flex items-center gap-2 py-2 px-3">
      <div class="flex items-center justify-center w-6 h-6 rounded-md bg-amber-200 text-amber-700">
        <HelpCircle class="w-3.5 h-3.5" />
      </div>
      <span class="text-sm font-semibold text-amber-800 truncate">{{ label }}</span>
    </div>

    <div class="px-3 pb-2 space-y-1">
      <p v-if="questionPreview" class="text-xs text-amber-600 bg-amber-100 rounded-md px-2 py-1 truncate">
        {{ questionPreview }}
      </p>
      <span
        v-if="variableDisplay"
        class="inline-block text-[10px] font-mono font-medium text-amber-700 bg-amber-200 rounded-full px-2 py-0.5"
      >
        {{ variableDisplay }}
      </span>
    </div>

    <Handle
      type="source"
      :position="Position.Bottom"
      class="!bg-amber-500 !w-3 !h-3 !border-2 !border-white"
    />
  </div>
</template>
