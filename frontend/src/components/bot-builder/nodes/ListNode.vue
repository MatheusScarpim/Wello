<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { List } from 'lucide-vue-next'

const props = defineProps<{
  id: string
  data: Record<string, any>
}>()

const label = computed(() => props.data?.label || 'Lista')

const sectionCount = computed(() => {
  const sections = props.data?.sections
  if (!Array.isArray(sections)) return 0
  return sections.length
})

const rowCount = computed(() => {
  const sections = props.data?.sections
  if (!Array.isArray(sections)) return 0
  return sections.reduce((total: number, section: any) => {
    return total + (Array.isArray(section.rows) ? section.rows.length : 0)
  }, 0)
})
</script>

<template>
  <div
    class="bg-cyan-50 border-2 border-cyan-300 rounded-xl shadow-sm min-w-[180px] max-w-[220px]"
  >
    <Handle
      type="target"
      :position="Position.Top"
      class="!bg-cyan-500 !w-3 !h-3 !border-2 !border-white"
    />

    <div class="flex items-center gap-2 py-2 px-3">
      <div class="flex items-center justify-center w-6 h-6 rounded-md bg-cyan-200 text-cyan-700">
        <List class="w-3.5 h-3.5" />
      </div>
      <span class="text-sm font-semibold text-cyan-800 truncate">{{ label }}</span>
    </div>

    <div v-if="sectionCount > 0 || rowCount > 0" class="px-3 pb-2">
      <div class="flex gap-2 text-[10px]">
        <span class="text-cyan-600 bg-cyan-100 rounded-md px-2 py-0.5 font-medium">
          {{ sectionCount }} {{ sectionCount === 1 ? 'secao' : 'secoes' }}
        </span>
        <span class="text-cyan-600 bg-cyan-100 rounded-md px-2 py-0.5 font-medium">
          {{ rowCount }} {{ rowCount === 1 ? 'item' : 'itens' }}
        </span>
      </div>
    </div>

    <Handle
      type="source"
      :position="Position.Bottom"
      class="!bg-cyan-500 !w-3 !h-3 !border-2 !border-white"
    />
  </div>
</template>
