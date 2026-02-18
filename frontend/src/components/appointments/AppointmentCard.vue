<script setup lang="ts">
import { computed } from 'vue'
import { format } from 'date-fns'
import { Check, CheckCheck, X, Edit3, Trash2 } from 'lucide-vue-next'
import type { Appointment, AppointmentStatus } from '@/types'

const props = defineProps<{
  appointment: Appointment
}>()

const emit = defineEmits<{
  edit: []
  'status-change': [status: AppointmentStatus]
  delete: []
}>()

const formattedTime = computed(() => {
  try {
    return format(new Date(props.appointment.date), 'HH:mm')
  } catch {
    return '--:--'
  }
})

const statusConfig = computed(() => {
  const map: Record<AppointmentStatus, { label: string; dotClass: string; badgeClass: string }> = {
    scheduled: {
      label: 'Agendado',
      dotClass: 'bg-blue-500',
      badgeClass: 'bg-blue-100 text-blue-700',
    },
    confirmed: {
      label: 'Confirmado',
      dotClass: 'bg-green-500',
      badgeClass: 'bg-green-100 text-green-700',
    },
    cancelled: {
      label: 'Cancelado',
      dotClass: 'bg-red-500',
      badgeClass: 'bg-red-100 text-red-700',
    },
    completed: {
      label: 'Concluido',
      dotClass: 'bg-gray-500',
      badgeClass: 'bg-gray-100 text-gray-700',
    },
  }
  return map[props.appointment.status] || map.scheduled
})

const contactDisplay = computed(() => {
  const parts: string[] = []
  if (props.appointment.contactName) parts.push(props.appointment.contactName)
  if (props.appointment.contactIdentifier) parts.push(props.appointment.contactIdentifier)
  return parts.join(' - ') || null
})

const isScheduled = computed(() => props.appointment.status === 'scheduled')
const isConfirmed = computed(() => props.appointment.status === 'confirmed')
</script>

<template>
  <div class="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">
    <div class="flex items-start gap-4">
      <!-- Left: Time + Status Dot -->
      <div class="flex flex-col items-center gap-1.5 flex-shrink-0 pt-0.5">
        <span class="text-sm font-semibold text-gray-900">{{ formattedTime }}</span>
        <span
          class="w-2.5 h-2.5 rounded-full"
          :class="statusConfig.dotClass"
          :title="statusConfig.label"
        />
      </div>

      <!-- Center: Info -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-0.5">
          <h4 class="font-bold text-gray-900 text-sm truncate">
            {{ appointment.title }}
          </h4>
          <span
            class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none flex-shrink-0"
            :class="statusConfig.badgeClass"
          >
            {{ statusConfig.label }}
          </span>
        </div>

        <p v-if="contactDisplay" class="text-sm text-gray-500 truncate">
          {{ contactDisplay }}
        </p>

        <span
          v-if="appointment.operatorName"
          class="inline-flex items-center px-1.5 py-0.5 mt-1 rounded bg-primary-50 text-primary-700 text-xs font-medium"
        >
          {{ appointment.operatorName }}
        </span>
      </div>

      <!-- Right: Action Buttons -->
      <div class="flex items-center gap-1 flex-shrink-0">
        <!-- Status-dependent actions -->
        <template v-if="isScheduled">
          <button
            class="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
            title="Confirmar"
            @click="emit('status-change', 'confirmed')"
          >
            <Check class="w-4 h-4" />
          </button>
          <button
            class="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
            title="Cancelar"
            @click="emit('status-change', 'cancelled')"
          >
            <X class="w-4 h-4" />
          </button>
        </template>

        <template v-if="isConfirmed">
          <button
            class="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
            title="Concluir"
            @click="emit('status-change', 'completed')"
          >
            <CheckCheck class="w-4 h-4" />
          </button>
          <button
            class="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
            title="Cancelar"
            @click="emit('status-change', 'cancelled')"
          >
            <X class="w-4 h-4" />
          </button>
        </template>

        <!-- Always visible: Edit + Delete -->
        <button
          class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          title="Editar"
          @click="emit('edit')"
        >
          <Edit3 class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
          title="Excluir"
          @click="emit('delete')"
        >
          <Trash2 class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>
