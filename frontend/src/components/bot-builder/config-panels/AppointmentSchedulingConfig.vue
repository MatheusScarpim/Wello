<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useBotBuilderStore } from '@/stores/botBuilder'
import { servicesApi, professionalsApi } from '@/api'
import type { Service, Professional } from '@/types'

const store = useBotBuilderStore()

const nodeData = computed(() => store.selectedNode?.data || {})

const services = ref<Service[]>([])
const professionals = ref<Professional[]>([])

onMounted(async () => {
  try {
    const [sRes, pRes] = await Promise.all([
      servicesApi.list(),
      professionalsApi.listActive(),
    ])
    services.value = sRes.data ?? sRes
    professionals.value = pRes.data ?? pRes
  } catch {
    // silently fail — lists will be empty
  }
})

function updateField(field: string, value: any) {
  if (!store.selectedNodeId) return
  store.updateNodeData(store.selectedNodeId, { [field]: value })
}
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- Header -->
    <div class="border-b border-gray-200 pb-3">
      <h3 class="text-lg font-semibold text-gray-900">Agendamento</h3>
      <p class="text-sm text-gray-500">Guia o usuário pelo fluxo de agendar um horário</p>
    </div>

    <!-- Label -->
    <div>
      <label class="label">Label</label>
      <input
        type="text"
        class="input"
        placeholder="Agendamento"
        :value="nodeData.label"
        @input="updateField('label', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Separator: Preset -->
    <div class="border-t border-gray-200 pt-4">
      <h4 class="text-sm font-semibold text-gray-700 mb-1">Pré-seleção (opcional)</h4>
      <p class="text-xs text-gray-400 mb-3">Pule etapas fixando serviço ou profissional</p>
    </div>

    <!-- Service Preset -->
    <div>
      <label class="label">Serviço fixo</label>
      <select
        class="input"
        :value="nodeData.serviceId || ''"
        @change="updateField('serviceId', ($event.target as HTMLSelectElement).value || undefined)"
      >
        <option value="">Perguntar ao usuário</option>
        <option v-for="s in services" :key="s._id" :value="s._id">{{ s.name }}</option>
      </select>
    </div>

    <!-- Professional Preset -->
    <div>
      <label class="label">Profissional fixo</label>
      <select
        class="input"
        :value="nodeData.professionalId || ''"
        @change="updateField('professionalId', ($event.target as HTMLSelectElement).value || undefined)"
      >
        <option value="">Perguntar ao usuário</option>
        <option v-for="p in professionals" :key="p._id" :value="p._id">{{ p.name }}</option>
      </select>
    </div>

    <!-- Days Ahead -->
    <div>
      <label class="label">Dias disponíveis à frente</label>
      <input
        type="number"
        class="input"
        min="1"
        max="60"
        :value="nodeData.daysAhead ?? 7"
        @input="updateField('daysAhead', parseInt(($event.target as HTMLInputElement).value) || 7)"
      />
    </div>

    <!-- Response Variable -->
    <div>
      <label class="label">Salvar resultado na variável (opcional)</label>
      <input
        type="text"
        class="input font-mono"
        placeholder="agendamento"
        :value="nodeData.responseVariable"
        @input="updateField('responseVariable', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Separator: Messages -->
    <div class="border-t border-gray-200 pt-4">
      <h4 class="text-sm font-semibold text-gray-700 mb-1">Mensagens personalizadas</h4>
      <p class="text-xs text-gray-400 mb-3">Personalize o que o bot diz em cada etapa</p>
    </div>

    <!-- Ask Service Message -->
    <div>
      <label class="label">Perguntar serviço</label>
      <input
        type="text"
        class="input"
        placeholder="Qual serviço deseja agendar?"
        :value="nodeData.askServiceMessage"
        @input="updateField('askServiceMessage', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Ask Professional Message -->
    <div>
      <label class="label">Perguntar profissional</label>
      <input
        type="text"
        class="input"
        placeholder="Com qual profissional?"
        :value="nodeData.askProfessionalMessage"
        @input="updateField('askProfessionalMessage', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Ask Date Message -->
    <div>
      <label class="label">Perguntar data</label>
      <input
        type="text"
        class="input"
        placeholder="Selecione uma data"
        :value="nodeData.askDateMessage"
        @input="updateField('askDateMessage', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Ask Time Message -->
    <div>
      <label class="label">Perguntar horário</label>
      <input
        type="text"
        class="input"
        placeholder="Selecione o horário"
        :value="nodeData.askTimeMessage"
        @input="updateField('askTimeMessage', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Ask Name Message -->
    <div>
      <label class="label">Perguntar nome</label>
      <input
        type="text"
        class="input"
        placeholder="Qual seu nome?"
        :value="nodeData.askNameMessage"
        @input="updateField('askNameMessage', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Ask Phone Message -->
    <div>
      <label class="label">Perguntar telefone</label>
      <input
        type="text"
        class="input"
        placeholder="Qual seu telefone para contato?"
        :value="nodeData.askPhoneMessage"
        @input="updateField('askPhoneMessage', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Confirm Message -->
    <div>
      <label class="label">Mensagem de confirmação</label>
      <textarea
        class="input min-h-[60px] resize-y"
        placeholder="Agendamento confirmado! Obrigado."
        :value="nodeData.confirmMessage"
        @input="updateField('confirmMessage', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>

    <!-- No Slots Message -->
    <div>
      <label class="label">Sem horários disponíveis</label>
      <input
        type="text"
        class="input"
        placeholder="Desculpe, não há horários disponíveis."
        :value="nodeData.noSlotsMessage"
        @input="updateField('noSlotsMessage', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Info Box -->
    <div class="bg-teal-50 rounded-lg p-3 space-y-2">
      <p class="text-xs text-teal-800 font-medium">Como funciona:</p>
      <ol class="text-xs text-teal-700 space-y-1 list-decimal list-inside">
        <li>Pergunta qual serviço (se não fixo)</li>
        <li>Pergunta qual profissional (se não fixo)</li>
        <li>Mostra datas disponíveis</li>
        <li>Mostra horários livres da data escolhida</li>
        <li>Coleta nome e telefone do cliente</li>
        <li>Cria o agendamento automaticamente</li>
      </ol>
    </div>
  </div>
</template>
