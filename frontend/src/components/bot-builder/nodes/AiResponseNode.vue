<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { Sparkles, Route } from 'lucide-vue-next'

const props = defineProps<{
  id: string
  data: Record<string, any>
}>()

const label = computed(() => props.data?.label || 'IA')

const promptPreview = computed(() => {
  const p = props.data?.systemPrompt
  if (!p) return null
  return p.length > 50 ? p.substring(0, 50) + '...' : p
})

const variableName = computed(() => props.data?.responseVariable || null)
const showRoutingBadge = computed(() => props.data?.routeToDepartment === true)
</script>

<template>
  <div
    class="bg-indigo-50 border-2 border-indigo-300 rounded-xl shadow-sm min-w-[180px] max-w-[220px]"
  >
    <Handle
      type="target"
      :position="Position.Top"
      class="!bg-indigo-500 !w-3 !h-3 !border-2 !border-white"
    />

    <div class="flex items-center gap-2 py-2 px-3">
      <div class="flex items-center justify-center w-6 h-6 rounded-md bg-indigo-200 text-indigo-700">
        <Sparkles class="w-3.5 h-3.5" />
      </div>
      <span class="text-sm font-semibold text-indigo-800 truncate">{{ label }}</span>
    </div>

    <div class="px-3 pb-2 space-y-1">
      <p v-if="promptPreview" class="text-xs text-indigo-600 bg-indigo-100 rounded-md px-2 py-1 truncate">
        {{ promptPreview }}
      </p>
      <span
        v-if="variableName"
        class="inline-block text-[10px] font-mono font-medium text-indigo-700 bg-indigo-200 rounded-full px-2 py-0.5"
      >
        {{ variableName }}
      </span>
      <div
        v-if="showRoutingBadge"
        class="flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-100 rounded-full px-2 py-0.5 w-fit"
      >
        <Route class="w-3 h-3" />
        <span>Roteamento</span>
      </div>
    </div>

    <Handle
      type="source"
      :position="Position.Bottom"
      class="!bg-indigo-500 !w-3 !h-3 !border-2 !border-white"
    />
  </div>
</template>
