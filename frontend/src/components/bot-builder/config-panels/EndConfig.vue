<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useBotBuilderStore } from '@/stores/botBuilder'
import { departmentsApi } from '@/api'
import type { Department } from '@/types'

const store = useBotBuilderStore()

const nodeData = computed(() => store.selectedNode?.data || {})
const departments = ref<Department[]>([])
const loadingDepartments = ref(false)

onMounted(async () => {
  try {
    loadingDepartments.value = true
    const { data } = await departmentsApi.list()
    departments.value = data.filter((d) => d.isActive)
  } catch (error) {
    console.error('Erro ao carregar departamentos:', error)
  } finally {
    loadingDepartments.value = false
  }
})

function updateField(field: string, value: any) {
  if (!store.selectedNodeId) return
  store.updateNodeData(store.selectedNodeId, { [field]: value })
}

function toggleTransfer(checked: boolean) {
  updateField('transferToHuman', checked)
  if (!checked) {
    updateField('transferDepartmentId', undefined)
  }
}
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- Header -->
    <div class="border-b border-gray-200 pb-3">
      <h3 class="text-lg font-semibold text-gray-900">Fim</h3>
      <p class="text-sm text-gray-500">Encerra o fluxo do bot</p>
    </div>

    <!-- Label -->
    <div>
      <label class="label">Label</label>
      <input
        type="text"
        class="input"
        placeholder="Fim"
        :value="nodeData.label"
        @input="updateField('label', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Mensagem final -->
    <div>
      <label class="label">Mensagem final (opcional)</label>
      <textarea
        class="input min-h-[80px] resize-y"
        placeholder="Obrigado pelo contato! Até mais."
        :value="nodeData.finalMessage"
        @input="updateField('finalMessage', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>

    <!-- Transferir para humano -->
    <div class="flex items-center gap-3">
      <input
        type="checkbox"
        id="transferToHuman"
        class="w-4 h-4 text-primary-600 rounded"
        :checked="nodeData.transferToHuman || false"
        @change="toggleTransfer(($event.target as HTMLInputElement).checked)"
      />
      <label for="transferToHuman" class="text-sm text-gray-700">
        Transferir para humano
      </label>
    </div>

    <!-- Opções de transferência -->
    <template v-if="nodeData.transferToHuman">
      <!-- Departamento -->
      <div>
        <label class="label">Departamento (opcional)</label>
        <select
          class="input"
          :value="nodeData.transferDepartmentId || ''"
          @change="updateField('transferDepartmentId', ($event.target as HTMLSelectElement).value || undefined)"
        >
          <option value="">Qualquer departamento</option>
          <option
            v-for="dept in departments"
            :key="dept._id"
            :value="dept._id"
          >
            {{ dept.name }}
          </option>
        </select>
        <p v-if="loadingDepartments" class="text-xs text-gray-400 mt-1">
          Carregando departamentos...
        </p>
      </div>

      <div class="bg-amber-50 rounded-lg p-3">
        <p class="text-xs text-amber-700">
          Ao finalizar, a conversa será transferida para
          <template v-if="nodeData.transferDepartmentId">
            o departamento selecionado.
          </template>
          <template v-else>
            um atendente humano na fila geral.
          </template>
        </p>
      </div>
    </template>
  </div>
</template>
