<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { CalendarCheck } from 'lucide-vue-next'

const props = defineProps<{
  id: string
  data: Record<string, any>
}>()

const label = computed(() => props.data?.label || 'Agendamento')

const hasPresetService = computed(() => !!props.data?.serviceId)
const hasPresetProfessional = computed(() => !!props.data?.professionalId)
const daysAhead = computed(() => props.data?.daysAhead ?? 7)
const variableName = computed(() => props.data?.responseVariable || null)
</script>

<template>
  <div
    class="bg-teal-50 border-2 border-teal-300 rounded-xl shadow-sm min-w-[180px] max-w-[220px]"
  >
    <Handle
      type="target"
      :position="Position.Top"
      class="!bg-teal-500 !w-3 !h-3 !border-2 !border-white"
    />

    <div class="flex items-center gap-2 py-2 px-3">
      <div class="flex items-center justify-center w-6 h-6 rounded-md bg-teal-200 text-teal-700">
        <CalendarCheck class="w-3.5 h-3.5" />
      </div>
      <span class="text-sm font-semibold text-teal-800 truncate">{{ label }}</span>
    </div>

    <div class="px-3 pb-2 space-y-1">
      <div class="flex flex-wrap gap-1">
        <span
          v-if="hasPresetService"
          class="inline-block text-[10px] font-medium text-teal-700 bg-teal-100 rounded-full px-2 py-0.5"
        >
          Serviço fixo
        </span>
        <span
          v-if="hasPresetProfessional"
          class="inline-block text-[10px] font-medium text-teal-700 bg-teal-100 rounded-full px-2 py-0.5"
        >
          Profissional fixo
        </span>
      </div>
      <p class="text-[10px] text-teal-600 bg-teal-100 rounded-md px-2 py-0.5">
        {{ daysAhead }} dias disponíveis
      </p>
      <span
        v-if="variableName"
        class="inline-block text-[10px] font-mono font-medium text-teal-700 bg-teal-200 rounded-full px-2 py-0.5"
      >
        {{ variableName }}
      </span>
    </div>

    <Handle
      type="source"
      :position="Position.Bottom"
      class="!bg-teal-500 !w-3 !h-3 !border-2 !border-white"
    />
  </div>
</template>
