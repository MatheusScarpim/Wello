<script setup lang="ts">
import { computed } from 'vue'
import { useBotBuilderStore } from '@/stores/botBuilder'

const store = useBotBuilderStore()

const nodeData = computed(() => store.selectedNode?.data || {})

const validationType = computed(() => nodeData.value.validationType || 'none')

function updateField(field: string, value: any) {
  if (!store.selectedNodeId) return
  store.updateNodeData(store.selectedNodeId, { [field]: value })
}
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- Header -->
    <div class="border-b border-gray-200 pb-3">
      <h3 class="text-lg font-semibold text-gray-900">Fazer Pergunta</h3>
      <p class="text-sm text-gray-500">Faz uma pergunta e armazena a resposta</p>
    </div>

    <!-- Label -->
    <div>
      <label class="label">Label</label>
      <input
        type="text"
        class="input"
        placeholder="Pergunta"
        :value="nodeData.label"
        @input="updateField('label', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Pergunta -->
    <div>
      <label class="label">Pergunta</label>
      <textarea
        class="input min-h-[80px] resize-y"
        placeholder="Qual é o seu nome?"
        :value="nodeData.question"
        @input="updateField('question', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>

    <!-- Nome da variavel -->
    <div>
      <label class="label">Nome da variável</label>
      <input
        type="text"
        class="input font-mono"
        placeholder="nome_cliente"
        :value="nodeData.variableName"
        @input="updateField('variableName', ($event.target as HTMLInputElement).value)"
      />
      <p class="text-xs text-gray-500 mt-1">A resposta será salva nesta variável</p>
    </div>

    <!-- Tipo de validacao -->
    <div>
      <label class="label">Tipo de validação</label>
      <select
        class="select"
        :value="validationType"
        @change="updateField('validationType', ($event.target as HTMLSelectElement).value)"
      >
        <option value="none">Nenhuma</option>
        <option value="options">Opções</option>
        <option value="regex">Regex</option>
        <option value="length">Comprimento</option>
        <option value="number">Número</option>
        <option value="email">E-mail</option>
        <option value="phone">Telefone</option>
      </select>
    </div>

    <!-- Campos condicionais por tipo de validação -->

    <!-- Opções -->
    <div v-if="validationType === 'options'">
      <label class="label">Opções válidas</label>
      <input
        type="text"
        class="input"
        placeholder="opção1, opção2, opção3"
        :value="nodeData.validOptions"
        @input="updateField('validOptions', ($event.target as HTMLInputElement).value)"
      />
      <p class="text-xs text-gray-500 mt-1">Separe as opções por vírgula</p>
    </div>

    <!-- Regex -->
    <div v-if="validationType === 'regex'">
      <label class="label">Padrão regex</label>
      <input
        type="text"
        class="input font-mono"
        placeholder="^[a-zA-Z]+$"
        :value="nodeData.regexPattern"
        @input="updateField('regexPattern', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Comprimento -->
    <div v-if="validationType === 'length'" class="grid grid-cols-2 gap-3">
      <div>
        <label class="label">Min</label>
        <input
          type="number"
          class="input"
          placeholder="0"
          min="0"
          :value="nodeData.minLength"
          @input="updateField('minLength', Number(($event.target as HTMLInputElement).value))"
        />
      </div>
      <div>
        <label class="label">Max</label>
        <input
          type="number"
          class="input"
          placeholder="100"
          min="0"
          :value="nodeData.maxLength"
          @input="updateField('maxLength', Number(($event.target as HTMLInputElement).value))"
        />
      </div>
    </div>

    <!-- Mensagem de erro -->
    <div v-if="validationType !== 'none'">
      <label class="label">Mensagem de erro</label>
      <input
        type="text"
        class="input"
        placeholder="Resposta inválida. Tente novamente."
        :value="nodeData.errorMessage"
        @input="updateField('errorMessage', ($event.target as HTMLInputElement).value)"
      />
    </div>
  </div>
</template>
