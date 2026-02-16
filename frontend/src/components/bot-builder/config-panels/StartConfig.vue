<script setup lang="ts">
import { computed } from 'vue'
import { useBotBuilderStore } from '@/stores/botBuilder'

const store = useBotBuilderStore()

const nodeData = computed(() => store.selectedNode?.data || {})

function updateField(field: string, value: any) {
  if (!store.selectedNodeId) return
  store.updateNodeData(store.selectedNodeId, { [field]: value })
}
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- Header -->
    <div class="border-b border-gray-200 pb-3">
      <h3 class="text-lg font-semibold text-gray-900">Início</h3>
      <p class="text-sm text-gray-500">Ponto de entrada do fluxo</p>
    </div>

    <!-- Label -->
    <div>
      <label class="label">Label</label>
      <input
        type="text"
        class="input"
        placeholder="Início"
        :value="nodeData.label"
        @input="updateField('label', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Mensagem de boas-vindas -->
    <div>
      <label class="label">Mensagem de boas-vindas (opcional)</label>
      <textarea
        class="input min-h-[80px] resize-y"
        placeholder="Olá! Bem-vindo ao nosso atendimento..."
        :value="nodeData.welcomeMessage"
        @input="updateField('welcomeMessage', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>
  </div>
</template>
