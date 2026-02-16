<script setup lang="ts">
import { computed } from 'vue'
import { useBotBuilderStore } from '@/stores/botBuilder'
import { Plus, X } from 'lucide-vue-next'

const store = useBotBuilderStore()

const nodeData = computed(() => store.selectedNode?.data || {})

const buttons = computed<Array<{ id: string; text: string }>>(() =>
  nodeData.value.buttons || [{ id: generateId(), text: '' }]
)

function generateId(): string {
  return 'btn_' + Math.random().toString(36).substring(2, 9)
}

function updateField(field: string, value: any) {
  if (!store.selectedNodeId) return
  store.updateNodeData(store.selectedNodeId, { [field]: value })
}

function updateButton(index: number, field: string, value: string) {
  const updated = [...buttons.value]
  updated[index] = { ...updated[index], [field]: value }
  updateField('buttons', updated)
}

function addButton() {
  if (buttons.value.length >= 3) return
  const updated = [...buttons.value, { id: generateId(), text: '' }]
  updateField('buttons', updated)
}

function removeButton(index: number) {
  if (buttons.value.length <= 1) return
  const updated = buttons.value.filter((_, i) => i !== index)
  updateField('buttons', updated)
}
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- Header -->
    <div class="border-b border-gray-200 pb-3">
      <h3 class="text-lg font-semibold text-gray-900">Botões</h3>
      <p class="text-sm text-gray-500">Envia uma mensagem com botões interativos</p>
    </div>

    <!-- Label -->
    <div>
      <label class="label">Label</label>
      <input
        type="text"
        class="input"
        placeholder="Botões"
        :value="nodeData.label"
        @input="updateField('label', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Titulo -->
    <div>
      <label class="label">Título</label>
      <input
        type="text"
        class="input"
        placeholder="Escolha uma opção"
        :value="nodeData.title"
        @input="updateField('title', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Descricao -->
    <div>
      <label class="label">Descrição</label>
      <textarea
        class="input min-h-[60px] resize-y"
        placeholder="Selecione uma das opções abaixo"
        :value="nodeData.description"
        @input="updateField('description', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>

    <!-- Rodape -->
    <div>
      <label class="label">Rodapé (opcional)</label>
      <input
        type="text"
        class="input"
        placeholder="Texto do rodapé"
        :value="nodeData.footer"
        @input="updateField('footer', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Nome da variavel -->
    <div>
      <label class="label">Nome da variável (opcional)</label>
      <input
        type="text"
        class="input font-mono"
        placeholder="resposta_botao"
        :value="nodeData.variableName"
        @input="updateField('variableName', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Botoes -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <label class="label mb-0">Botões</label>
        <span class="text-xs text-gray-500">{{ buttons.length }}/3</span>
      </div>

      <div class="space-y-2">
        <div
          v-for="(button, index) in buttons"
          :key="button.id"
          class="flex items-center gap-2"
        >
          <span class="text-xs text-gray-400 w-6 text-center flex-shrink-0">{{ index + 1 }}</span>
          <input
            type="text"
            class="input flex-1"
            placeholder="Texto do botão"
            :value="button.text"
            @input="updateButton(index, 'text', ($event.target as HTMLInputElement).value)"
          />
          <button
            type="button"
            class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
            :disabled="buttons.length <= 1"
            :class="{ 'opacity-30 cursor-not-allowed': buttons.length <= 1 }"
            @click="removeButton(index)"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <button
        v-if="buttons.length < 3"
        type="button"
        class="mt-2 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 transition-colors"
        @click="addButton"
      >
        <Plus class="w-4 h-4" />
        Adicionar botão
      </button>
    </div>
  </div>
</template>
