<script setup lang="ts">
import { computed } from 'vue'
import { useBotBuilderStore } from '@/stores/botBuilder'
import { Plus, X } from 'lucide-vue-next'

interface Condition {
  label: string
  variable: string
  operator: string
  value: string
}

const store = useBotBuilderStore()

const nodeData = computed(() => store.selectedNode?.data || {})

const conditions = computed<Condition[]>(() =>
  nodeData.value.conditions || [{ label: '', variable: '', operator: 'equals', value: '' }]
)

const operators = [
  { value: 'equals', label: 'Igual a' },
  { value: 'not_equals', label: 'Diferente de' },
  { value: 'contains', label: 'Contém' },
  { value: 'not_contains', label: 'Não contém' },
  { value: 'starts_with', label: 'Começa com' },
  { value: 'ends_with', label: 'Termina com' },
  { value: 'regex', label: 'Regex' },
  { value: 'greater_than', label: 'Maior que' },
  { value: 'less_than', label: 'Menor que' },
  { value: 'is_empty', label: 'Está vazio' },
  { value: 'is_not_empty', label: 'Não está vazio' },
]

function updateField(field: string, value: any) {
  if (!store.selectedNodeId) return
  store.updateNodeData(store.selectedNodeId, { [field]: value })
}

function updateCondition(index: number, field: string, value: string) {
  const updated = conditions.value.map((c, i) =>
    i === index ? { ...c, [field]: value } : c
  )
  updateField('conditions', updated)
}

function addCondition() {
  const updated = [
    ...conditions.value,
    { label: '', variable: '', operator: 'equals', value: '' }
  ]
  updateField('conditions', updated)
}

function removeCondition(index: number) {
  if (conditions.value.length <= 1) return
  const updated = conditions.value.filter((_, i) => i !== index)
  updateField('conditions', updated)
}

function isValueHidden(operator: string): boolean {
  return operator === 'is_empty' || operator === 'is_not_empty'
}
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- Header -->
    <div class="border-b border-gray-200 pb-3">
      <h3 class="text-lg font-semibold text-gray-900">Condição</h3>
      <p class="text-sm text-gray-500">Avalia condições para direcionar o fluxo</p>
    </div>

    <!-- Label -->
    <div>
      <label class="label">Label</label>
      <input
        type="text"
        class="input"
        placeholder="Condição"
        :value="nodeData.label"
        @input="updateField('label', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Condições -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <label class="label mb-0">Condições</label>
      </div>

      <div class="space-y-3">
        <div
          v-for="(condition, index) in conditions"
          :key="index"
          class="border border-gray-200 rounded-lg p-3 space-y-2"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-gray-500 uppercase">Condição {{ index + 1 }}</span>
            <button
              type="button"
              class="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
              :disabled="conditions.length <= 1"
              :class="{ 'opacity-30 cursor-not-allowed': conditions.length <= 1 }"
              @click="removeCondition(index)"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Label da condição -->
          <div>
            <label class="text-xs text-gray-500">Label</label>
            <input
              type="text"
              class="input text-sm"
              placeholder="Nome da condição"
              :value="condition.label"
              @input="updateCondition(index, 'label', ($event.target as HTMLInputElement).value)"
            />
          </div>

          <!-- Variavel -->
          <div>
            <label class="text-xs text-gray-500">Variável</label>
            <input
              type="text"
              class="input text-sm font-mono"
              placeholder="nome_variavel"
              :value="condition.variable"
              @input="updateCondition(index, 'variable', ($event.target as HTMLInputElement).value)"
            />
          </div>

          <!-- Operador -->
          <div>
            <label class="text-xs text-gray-500">Operador</label>
            <select
              class="select text-sm"
              :value="condition.operator"
              @change="updateCondition(index, 'operator', ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="op in operators" :key="op.value" :value="op.value">
                {{ op.label }}
              </option>
            </select>
          </div>

          <!-- Valor (oculto para is_empty/is_not_empty) -->
          <div v-if="!isValueHidden(condition.operator)">
            <label class="text-xs text-gray-500">Valor</label>
            <input
              type="text"
              class="input text-sm"
              placeholder="Valor esperado"
              :value="condition.value"
              @input="updateCondition(index, 'value', ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        class="mt-2 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 transition-colors"
        @click="addCondition"
      >
        <Plus class="w-4 h-4" />
        Adicionar condição
      </button>
    </div>

    <!-- Nota sobre Else -->
    <div class="bg-gray-50 rounded-lg p-3">
      <p class="text-xs text-gray-600">
        A saida "Else" sera seguida automaticamente quando nenhuma condição for verdadeira.
      </p>
    </div>
  </div>
</template>
