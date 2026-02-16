<script setup lang="ts">
import { computed } from 'vue'
import { useBotBuilderStore } from '@/stores/botBuilder'
import { Plus, X } from 'lucide-vue-next'

interface Header {
  key: string
  value: string
}

const store = useBotBuilderStore()

const nodeData = computed(() => store.selectedNode?.data || {})

const method = computed(() => nodeData.value.method || 'GET')

const headers = computed<Header[]>(() => nodeData.value.headers || [])

const showBody = computed(() => method.value === 'POST' || method.value === 'PUT')

function updateField(field: string, value: any) {
  if (!store.selectedNodeId) return
  store.updateNodeData(store.selectedNodeId, { [field]: value })
}

function updateHeader(index: number, field: string, value: string) {
  const updated = headers.value.map((h, i) =>
    i === index ? { ...h, [field]: value } : h
  )
  updateField('headers', updated)
}

function addHeader() {
  const updated = [...headers.value, { key: '', value: '' }]
  updateField('headers', updated)
}

function removeHeader(index: number) {
  const updated = headers.value.filter((_, i) => i !== index)
  updateField('headers', updated)
}
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- Header -->
    <div class="border-b border-gray-200 pb-3">
      <h3 class="text-lg font-semibold text-gray-900">Requisição HTTP</h3>
      <p class="text-sm text-gray-500">Faz uma requisição HTTP externa</p>
    </div>

    <!-- Label -->
    <div>
      <label class="label">Label</label>
      <input
        type="text"
        class="input"
        placeholder="Requisição HTTP"
        :value="nodeData.label"
        @input="updateField('label', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Metodo -->
    <div>
      <label class="label">Método</label>
      <select
        class="select"
        :value="method"
        @change="updateField('method', ($event.target as HTMLSelectElement).value)"
      >
        <option value="GET">GET</option>
        <option value="POST">POST</option>
        <option value="PUT">PUT</option>
        <option value="DELETE">DELETE</option>
      </select>
    </div>

    <!-- URL -->
    <div>
      <label class="label">URL</label>
      <input
        type="text"
        class="input font-mono text-sm"
        placeholder="https://api.exemplo.com/endpoint"
        :value="nodeData.url"
        @input="updateField('url', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Headers -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <label class="label mb-0">Headers (opcional)</label>
      </div>

      <div class="space-y-2">
        <div
          v-for="(header, index) in headers"
          :key="index"
          class="flex items-center gap-2"
        >
          <input
            type="text"
            class="input flex-1 text-sm font-mono"
            placeholder="Header"
            :value="header.key"
            @input="updateHeader(index, 'key', ($event.target as HTMLInputElement).value)"
          />
          <input
            type="text"
            class="input flex-1 text-sm"
            placeholder="Valor"
            :value="header.value"
            @input="updateHeader(index, 'value', ($event.target as HTMLInputElement).value)"
          />
          <button
            type="button"
            class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
            @click="removeHeader(index)"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <button
        type="button"
        class="mt-2 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 transition-colors"
        @click="addHeader"
      >
        <Plus class="w-4 h-4" />
        Adicionar header
      </button>
    </div>

    <!-- Body (apenas POST/PUT) -->
    <div v-if="showBody">
      <label class="label">Body</label>
      <textarea
        class="input min-h-[100px] resize-y font-mono text-sm"
        placeholder='{"chave": "valor"}'
        :value="nodeData.body"
        @input="updateField('body', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>

    <!-- Variável de resposta -->
    <div>
      <label class="label">Variável de resposta</label>
      <input
        type="text"
        class="input font-mono"
        placeholder="resposta_api"
        :value="nodeData.responseVariable"
        @input="updateField('responseVariable', ($event.target as HTMLInputElement).value)"
      />
      <p class="text-xs text-gray-500 mt-1">O resultado será salvo nesta variável</p>
    </div>

    <!-- Timeout -->
    <div>
      <label class="label">Timeout (ms)</label>
      <input
        type="number"
        class="input"
        placeholder="5000"
        min="100"
        max="60000"
        :value="nodeData.timeout"
        @input="updateField('timeout', Number(($event.target as HTMLInputElement).value))"
      />
    </div>
  </div>
</template>
