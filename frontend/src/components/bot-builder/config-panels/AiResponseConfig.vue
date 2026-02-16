<script setup lang="ts">
import { computed } from 'vue'
import { useBotBuilderStore } from '@/stores/botBuilder'

const store = useBotBuilderStore()

const nodeData = computed(() => store.selectedNode?.data || {})

function updateField(field: string, value: any) {
  if (!store.selectedNodeId) return
  store.updateNodeData(store.selectedNodeId, { [field]: value })
}

function toggleRouting(checked: boolean) {
  updateField('routeToDepartment', checked)
}
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- Header -->
    <div class="border-b border-gray-200 pb-3">
      <h3 class="text-lg font-semibold text-gray-900">Resposta IA</h3>
      <p class="text-sm text-gray-500">Gera uma resposta usando inteligência artificial</p>
    </div>

    <!-- Label -->
    <div>
      <label class="label">Label</label>
      <input
        type="text"
        class="input"
        placeholder="IA"
        :value="nodeData.label"
        @input="updateField('label', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- System Prompt -->
    <div>
      <label class="label">Prompt do sistema</label>
      <textarea
        class="input min-h-[120px] resize-y font-mono text-xs"
        placeholder="Você é um assistente de atendimento..."
        :value="nodeData.systemPrompt"
        @input="updateField('systemPrompt', ($event.target as HTMLTextAreaElement).value)"
      />
      <p class="text-[10px] text-gray-400 mt-1">
        Instruções para a IA. Suporta variáveis como
        <span class="font-mono bg-gray-100 px-1 rounded" v-text="'{{nome}}'"></span>
      </p>
    </div>

    <!-- Temperature -->
    <div>
      <label class="label">
        Temperatura:
        <span class="font-mono text-indigo-600">{{ (nodeData.temperature ?? 0.7).toFixed(1) }}</span>
      </label>
      <input
        type="range"
        class="w-full accent-indigo-600"
        min="0"
        max="1"
        step="0.1"
        :value="nodeData.temperature ?? 0.7"
        @input="updateField('temperature', parseFloat(($event.target as HTMLInputElement).value))"
      />
      <div class="flex justify-between text-[10px] text-gray-400">
        <span>Preciso</span>
        <span>Criativo</span>
      </div>
    </div>

    <!-- Max Tokens -->
    <div>
      <label class="label">Tokens máximos</label>
      <input
        type="number"
        class="input"
        placeholder="300"
        min="50"
        max="2000"
        :value="nodeData.maxTokens ?? 300"
        @input="updateField('maxTokens', parseInt(($event.target as HTMLInputElement).value) || 300)"
      />
    </div>

    <!-- Response Variable -->
    <div>
      <label class="label">Salvar resposta na variável (opcional)</label>
      <input
        type="text"
        class="input font-mono"
        placeholder="resposta_ia"
        :value="nodeData.responseVariable"
        @input="updateField('responseVariable', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Include Session Context -->
    <div class="flex items-center gap-3">
      <input
        type="checkbox"
        id="includeSessionContext"
        class="w-4 h-4 text-indigo-600 rounded"
        :checked="nodeData.includeSessionContext || false"
        @change="updateField('includeSessionContext', ($event.target as HTMLInputElement).checked)"
      />
      <label for="includeSessionContext" class="text-sm text-gray-700">
        Incluir contexto da sessão
      </label>
    </div>

    <div v-if="nodeData.includeSessionContext" class="bg-indigo-50 rounded-lg p-3">
      <p class="text-xs text-indigo-700">
        As variáveis de sessão serão enviadas como contexto adicional para a IA.
      </p>
    </div>

    <!-- Separator -->
    <div class="border-t border-gray-200 pt-4">
      <h4 class="text-sm font-semibold text-gray-700 mb-3">Roteamento inteligente</h4>
    </div>

    <!-- Route to Department -->
    <div class="flex items-center gap-3">
      <input
        type="checkbox"
        id="routeToDepartment"
        class="w-4 h-4 text-indigo-600 rounded"
        :checked="nodeData.routeToDepartment || false"
        @change="toggleRouting(($event.target as HTMLInputElement).checked)"
      />
      <label for="routeToDepartment" class="text-sm text-gray-700">
        Rotear para departamento
      </label>
    </div>

    <div v-if="nodeData.routeToDepartment" class="bg-amber-50 rounded-lg p-3 space-y-2">
      <p class="text-xs text-amber-800 font-medium">Como funciona:</p>
      <ol class="text-xs text-amber-700 space-y-1 list-decimal list-inside">
        <li>A IA recebe a lista de departamentos ativos</li>
        <li>Analisa a mensagem do usuário</li>
        <li>Responde e transfere para o departamento adequado</li>
      </ol>
      <p class="text-[10px] text-amber-600 mt-1">
        A conversa será encerrada e transferida automaticamente para atendimento humano.
      </p>
    </div>
  </div>
</template>
