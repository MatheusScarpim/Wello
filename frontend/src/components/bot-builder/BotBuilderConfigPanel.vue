<script setup lang="ts">
import { computed, markRaw } from 'vue'
import { useBotBuilderStore } from '@/stores/botBuilder'
import { X, Trash2 } from 'lucide-vue-next'
import { NODE_TYPES } from '@/types/botBuilder'

import StartConfig from './config-panels/StartConfig.vue'
import SendMessageConfig from './config-panels/SendMessageConfig.vue'
import AskQuestionConfig from './config-panels/AskQuestionConfig.vue'
import ButtonsConfig from './config-panels/ButtonsConfig.vue'
import ListConfig from './config-panels/ListConfig.vue'
import ConditionConfig from './config-panels/ConditionConfig.vue'
import SetVariableConfig from './config-panels/SetVariableConfig.vue'
import HttpRequestConfig from './config-panels/HttpRequestConfig.vue'
import DelayConfig from './config-panels/DelayConfig.vue'
import AiResponseConfig from './config-panels/AiResponseConfig.vue'
import EndConfig from './config-panels/EndConfig.vue'

const store = useBotBuilderStore()

const configComponents: Record<string, any> = {
  start: markRaw(StartConfig),
  send_message: markRaw(SendMessageConfig),
  ask_question: markRaw(AskQuestionConfig),
  buttons: markRaw(ButtonsConfig),
  list: markRaw(ListConfig),
  condition: markRaw(ConditionConfig),
  set_variable: markRaw(SetVariableConfig),
  http_request: markRaw(HttpRequestConfig),
  delay: markRaw(DelayConfig),
  ai_response: markRaw(AiResponseConfig),
  end: markRaw(EndConfig),
}

const configComponent = computed(() => {
  if (!store.selectedNode) return null
  return configComponents[store.selectedNode.type || ''] || null
})

const nodeTypeInfo = computed(() => {
  if (!store.selectedNode) return null
  return NODE_TYPES.find((n) => n.type === store.selectedNode?.type) || null
})

function close() {
  store.selectNode(null)
}

function deleteNode() {
  if (!store.selectedNodeId) return
  if (store.selectedNode?.type === 'start') {
    return // não permitir deletar o nó de início
  }
  if (confirm('Tem certeza que deseja remover este nó?')) {
    store.removeNode(store.selectedNodeId)
  }
}
</script>

<template>
  <div
    v-if="store.selectedNode"
    class="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden"
  >
    <!-- Header -->
    <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div
          v-if="nodeTypeInfo"
          class="w-6 h-6 rounded flex items-center justify-center"
          :style="{ backgroundColor: nodeTypeInfo.bgColor }"
        >
          <div
            class="w-3 h-3 rounded-sm"
            :style="{ backgroundColor: nodeTypeInfo.color }"
          />
        </div>
        <span class="font-semibold text-sm text-gray-700">
          {{ nodeTypeInfo?.label || 'Configuração' }}
        </span>
      </div>
      <div class="flex items-center gap-1">
        <button
          v-if="store.selectedNode?.type !== 'start'"
          @click="deleteNode"
          class="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-gray-400 hover:text-red-500"
          title="Remover nó"
        >
          <Trash2 class="w-4 h-4" />
        </button>
        <button
          @click="close"
          class="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X class="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </div>

    <!-- Config Form -->
    <div class="flex-1 overflow-y-auto p-4">
      <component :is="configComponent" v-if="configComponent" />
    </div>
  </div>
</template>
