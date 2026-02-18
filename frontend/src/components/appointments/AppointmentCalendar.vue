<script setup lang="ts">
import { computed } from 'vue'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import type { Appointment } from '@/types'

const props = defineProps<{
  appointments: Appointment[]
  selectedDate: Date
  currentMonth: Date
}>()

const emit = defineEmits<{
  'select-date': [date: Date]
  'prev-month': []
  'next-month': []
}>()

const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

const monthLabel = computed(() => {
  return format(props.currentMonth, 'MMMM yyyy', { locale: ptBR })
})

const calendarDays = computed(() => {
  const monthStart = startOfMonth(props.currentMonth)
  const monthEnd = endOfMonth(props.currentMonth)
  const calendarStart = startOfWeek(monthStart, { locale: ptBR })
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR })

  return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
})

const appointmentCountByDay = computed(() => {
  const map = new Map<string, number>()
  for (const appt of props.appointments) {
    const dateKey = appt.date.split('T')[0]
    map.set(dateKey, (map.get(dateKey) || 0) + 1)
  }
  return map
})

function getAppointmentCount(day: Date): number {
  const key = format(day, 'yyyy-MM-dd')
  return appointmentCountByDay.value.get(key) || 0
}

function isOutsideMonth(day: Date): boolean {
  return !isSameMonth(day, props.currentMonth)
}

function isSelected(day: Date): boolean {
  return isSameDay(day, props.selectedDate)
}
</script>

<template>
  <div class="bg-white rounded-2xl border border-gray-200 p-4">
    <!-- Header: Month Navigation -->
    <div class="flex items-center justify-between mb-4">
      <button
        class="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        @click="emit('prev-month')"
      >
        <ChevronLeft class="w-5 h-5 text-gray-600" />
      </button>
      <h3 class="text-lg font-semibold text-gray-900 capitalize">
        {{ monthLabel }}
      </h3>
      <button
        class="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        @click="emit('next-month')"
      >
        <ChevronRight class="w-5 h-5 text-gray-600" />
      </button>
    </div>

    <!-- Weekday Headers -->
    <div class="grid grid-cols-7 mb-1">
      <div
        v-for="day in weekDays"
        :key="day"
        class="text-center text-xs font-medium text-gray-500 py-2"
      >
        {{ day }}
      </div>
    </div>

    <!-- Calendar Grid -->
    <div class="grid grid-cols-7">
      <button
        v-for="(day, index) in calendarDays"
        :key="index"
        class="min-h-[4rem] p-1.5 border border-gray-100 flex flex-col items-center justify-start gap-1 transition-colors relative"
        :class="[
          isOutsideMonth(day)
            ? 'text-gray-300 bg-gray-50/50'
            : 'text-gray-700 hover:bg-gray-50',
          isToday(day) && !isSelected(day)
            ? 'bg-primary-50 font-bold'
            : '',
          isSelected(day)
            ? 'ring-2 ring-primary-500 ring-inset bg-primary-50 font-bold z-10'
            : '',
        ]"
        @click="emit('select-date', day)"
      >
        <span class="text-sm leading-none mt-1">
          {{ format(day, 'd') }}
        </span>
        <span
          v-if="getAppointmentCount(day) > 0"
          class="w-2 h-2 rounded-full bg-primary-500"
          :title="`${getAppointmentCount(day)} agendamento(s)`"
        />
      </button>
    </div>
  </div>
</template>
