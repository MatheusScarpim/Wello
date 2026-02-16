<script setup lang="ts">
import { computed } from 'vue'
import { useBotBuilderStore } from '@/stores/botBuilder'

const store = useBotBuilderStore()

const nodeData = computed(() => store.selectedNode?.data || {})

const delayValue = computed(() => nodeData.value.delayValue || 0)

const delayUnit = computed(() => nodeData.value.delayUnit || 'seconds')

const previewText = computed(() => {
  const val = delayValue.value
  if (!val || val <= 0) return ''
  const unitLabel = delayUnit.value === 'seconds' ? 'segundo(s)' : 'milissegundo(s)'
  return `Vai esperar ${val} ${unitLabel}`
})

function updateField(field: string, value: any) {
  if (!store.selectedNodeId) return
  store.updateNodeData(store.selectedNodeId, { [field]: value })
}
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- Header -->
    <div class="border-b border-gray-200 pb-3">
      <h3 class="text-lg font-semibold text-gray-900">Espera</h3>
      <p class="text-sm text-gray-500">Aguarda um tempo antes de continuar</p>
    </div>

    <!-- Label -->
    <div>
      <label class="label">Label</label>
      <input
        type="text"
        class="input"
        placeholder="Espera"
        :value="nodeData.label"
        @input="updateField('label', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Tempo de espera -->
    <div>
      <label class="label">Tempo de espera</label>
      <div class="flex gap-2">
        <input
          type="number"
          class="input flex-1"
          placeholder="5"
          min="0"
          :value="delayValue"
          @input="updateField('delayValue', Number(($event.target as HTMLInputElement).value))"
        />
        <select
          class="select w-auto"
          :value="delayUnit"
          @change="updateField('delayUnit', ($event.target as HTMLSelectElement).value)"
        >
          <option value="seconds">Segundos</option>
          <option value="milliseconds">Milissegundos</option>
        </select>
      </div>
    </div>

    <!-- Preview -->
    <div v-if="previewText" class="bg-gray-50 rounded-lg p-3">
      <p class="text-sm text-gray-700">{{ previewText }}</p>
    </div>
  </div>
</template>
