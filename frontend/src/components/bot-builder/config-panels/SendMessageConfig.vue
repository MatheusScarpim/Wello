<script setup lang="ts">
import { computed } from 'vue'
import { useBotBuilderStore } from '@/stores/botBuilder'

const store = useBotBuilderStore()

const nodeData = computed(() => store.selectedNode?.data || {})

const messageType = computed(() => nodeData.value.messageType || 'text')

const isMediaType = computed(() =>
  ['image', 'document', 'audio', 'video'].includes(messageType.value)
)

function updateField(field: string, value: any) {
  if (!store.selectedNodeId) return
  store.updateNodeData(store.selectedNodeId, { [field]: value })
}
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- Header -->
    <div class="border-b border-gray-200 pb-3">
      <h3 class="text-lg font-semibold text-gray-900">Enviar Mensagem</h3>
      <p class="text-sm text-gray-500">Envia uma mensagem para o usuário</p>
    </div>

    <!-- Label -->
    <div>
      <label class="label">Label</label>
      <input
        type="text"
        class="input"
        placeholder="Enviar mensagem"
        :value="nodeData.label"
        @input="updateField('label', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Tipo de mensagem -->
    <div>
      <label class="label">Tipo de mensagem</label>
      <select
        class="select"
        :value="messageType"
        @change="updateField('messageType', ($event.target as HTMLSelectElement).value)"
      >
        <option value="text">Texto</option>
        <option value="image">Imagem</option>
        <option value="document">Documento</option>
        <option value="audio">Áudio</option>
        <option value="video">Vídeo</option>
      </select>
    </div>

    <!-- Campos para tipo texto -->
    <div v-if="messageType === 'text'">
      <label class="label">Mensagem</label>
      <textarea
        class="input min-h-[100px] resize-y"
        placeholder="Digite a mensagem..."
        :value="nodeData.message"
        @input="updateField('message', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>

    <!-- Campos para tipo mídia -->
    <template v-if="isMediaType">
      <div>
        <label class="label">URL do arquivo</label>
        <input
          type="text"
          class="input"
          placeholder="https://exemplo.com/arquivo.png"
          :value="nodeData.mediaUrl"
          @input="updateField('mediaUrl', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div>
        <label class="label">Legenda</label>
        <textarea
          class="input min-h-[60px] resize-y"
          placeholder="Legenda do arquivo..."
          :value="nodeData.caption"
          @input="updateField('caption', ($event.target as HTMLTextAreaElement).value)"
        />
      </div>

      <div>
        <label class="label">Nome do arquivo</label>
        <input
          type="text"
          class="input"
          placeholder="arquivo.pdf"
          :value="nodeData.fileName"
          @input="updateField('fileName', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </template>
  </div>
</template>
