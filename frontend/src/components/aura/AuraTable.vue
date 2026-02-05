<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  rows: Record<string, unknown>[]
  columns?: string[]
}>()

const visibleColumns = computed(() => {
  if (props.columns && props.columns.length > 0) return props.columns
  const firstRow = props.rows[0]
  return firstRow ? Object.keys(firstRow) : []
})

function formatCell(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="min-w-full text-left text-sm">
      <thead class="text-xs uppercase text-gray-500">
        <tr>
          <th
            v-for="column in visibleColumns"
            :key="column"
            class="px-3 py-2 border-b border-gray-200"
          >
            {{ column }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, rowIndex) in rows"
          :key="rowIndex"
          class="odd:bg-gray-50"
        >
          <td
            v-for="column in visibleColumns"
            :key="column"
            class="px-3 py-2 border-b border-gray-100 whitespace-nowrap"
          >
            {{ formatCell(row[column]) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
