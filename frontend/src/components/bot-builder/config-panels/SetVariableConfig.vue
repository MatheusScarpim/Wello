<script setup lang="ts">
import { computed } from 'vue'
import { useBotBuilderStore } from '@/stores/botBuilder'
import { Plus, X } from 'lucide-vue-next'

interface Assignment {
  variable: string
  value: string
}

const store = useBotBuilderStore()

const nodeData = computed(() => store.selectedNode?.data || {})

const assignments = computed<Assignment[]>(() =>
  nodeData.value.assignments || [{ variable: '', value: '' }]
)

function updateField(field: string, value: any) {
  if (!store.selectedNodeId) return
  store.updateNodeData(store.selectedNodeId, { [field]: value })
}

function updateAssignment(index: number, field: string, value: string) {
  const updated = assignments.value.map((a, i) =>
    i === index ? { ...a, [field]: value } : a
  )
  updateField('assignments', updated)
}

function addAssignment() {
  const updated = [...assignments.value, { variable: '', value: '' }]
  updateField('assignments', updated)
}

function removeAssignment(index: number) {
  if (assignments.value.length <= 1) return
  const updated = assignments.value.filter((_, i) => i !== index)
  updateField('assignments', updated)
}
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- Header -->
    <div class="border-b border-gray-200 pb-3">
      <h3 class="text-lg font-semibold text-gray-900">Definir Variável</h3>
      <p class="text-sm text-gray-500">Define ou atualiza valores de variáveis</p>
    </div>

    <!-- Label -->
    <div>
      <label class="label">Label</label>
      <input
        type="text"
        class="input"
        placeholder="Definir variável"
        :value="nodeData.label"
        @input="updateField('label', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Atribuições -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <label class="label mb-0">Atribuições</label>
      </div>

      <div class="space-y-3">
        <div
          v-for="(assignment, index) in assignments"
          :key="index"
          class="border border-gray-200 rounded-lg p-3 space-y-2"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-gray-500 uppercase">Atribuição {{ index + 1 }}</span>
            <button
              type="button"
              class="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
              :disabled="assignments.length <= 1"
              :class="{ 'opacity-30 cursor-not-allowed': assignments.length <= 1 }"
              @click="removeAssignment(index)"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <div>
            <label class="text-xs text-gray-500">Variável</label>
            <input
              type="text"
              class="input text-sm font-mono"
              placeholder="nome_variavel"
              :value="assignment.variable"
              @input="updateAssignment(index, 'variable', ($event.target as HTMLInputElement).value)"
            />
          </div>

          <div>
            <label class="text-xs text-gray-500">Valor</label>
            <input
              type="text"
              class="input text-sm"
              placeholder="Valor a ser atribuído"
              :value="assignment.value"
              @input="updateAssignment(index, 'value', ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        class="mt-2 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 transition-colors"
        @click="addAssignment"
      >
        <Plus class="w-4 h-4" />
        Adicionar atribuição
      </button>
    </div>

    <!-- Dica -->
    <div class="bg-blue-50 rounded-lg p-3">
      <p class="text-xs text-blue-700">
        Use <code class="bg-blue-100 px-1 rounded font-mono" v-text="'{{variavel}}'"></code> para referenciar valores de outras variáveis.
      </p>
    </div>
  </div>
</template>
