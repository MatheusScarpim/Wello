<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import {
  Calendar,
  List,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-vue-next'
import {
  format,
  parseISO,
  isSameDay,
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday as isTodayFn,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { appointmentsApi, professionalsApi } from '@/api'
import type { Appointment, AppointmentStatus, Professional } from '@/types'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import AppointmentModal from '@/components/appointments/AppointmentModal.vue'

const toast = useToast()

// State
const viewMode = ref<'timeline' | 'list'>('timeline')
const selectedDate = ref(new Date())
const calendarMonth = ref(new Date())
const appointments = ref<Appointment[]>([])
const professionals = ref<Professional[]>([])
const isLoading = ref(false)
const showModal = ref(false)
const editingAppointment = ref<Appointment | null>(null)
const preselectedProfessionalId = ref('')
const preselectedTime = ref('')

// Timeline config
const HOUR_HEIGHT = 64 // px per hour
const START_HOUR = 7
const END_HOUR = 21
const timeSlots = computed(() => {
  const slots: string[] = []
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
  }
  return slots
})

// Status config
const statusConfig: Record<AppointmentStatus, { label: string; bg: string; border: string; text: string }> = {
  scheduled: { label: 'Agendado', bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700' },
  confirmed: { label: 'Confirmado', bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700' },
  cancelled: { label: 'Cancelado', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-400' },
  completed: { label: 'Concluido', bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-500' },
}

// Calendar
const weekdays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const calendarMonthLabel = computed(() =>
  format(calendarMonth.value, 'MMM yyyy', { locale: ptBR })
)
const calendarDays = computed(() => {
  const monthStart = startOfMonth(calendarMonth.value)
  const monthEnd = endOfMonth(calendarMonth.value)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  return eachDayOfInterval({ start: calStart, end: calEnd })
})

function hasAppointments(day: Date): boolean {
  return appointments.value.some(a => {
    try { return isSameDay(parseISO(a.date), day) } catch { return false }
  })
}

// Date navigation
const dateLabel = computed(() =>
  format(selectedDate.value, "EEEE, dd 'de' MMMM", { locale: ptBR })
)

function prevDay() { selectedDate.value = subDays(selectedDate.value, 1) }
function nextDay() { selectedDate.value = addDays(selectedDate.value, 1) }
function goToday() { selectedDate.value = new Date() }

// Appointments for current day
const dayAppointments = computed(() =>
  appointments.value
    .filter(a => {
      try { return isSameDay(parseISO(a.date), selectedDate.value) } catch { return false }
    })
    .filter(a => a.status !== 'cancelled')
)

// Get appointments for a specific professional
function getAppointmentsForProfessional(profId: string): Appointment[] {
  return dayAppointments.value.filter(a => a.professionalId === profId)
}

// Appointments without professional assigned
const unassignedAppointments = computed(() =>
  dayAppointments.value.filter(a => !a.professionalId)
)

// Position & size helpers
function getTopPx(dateStr: string): number {
  try {
    const d = parseISO(dateStr)
    const hours = d.getHours() + d.getMinutes() / 60
    return (hours - START_HOUR) * HOUR_HEIGHT
  } catch {
    return 0
  }
}

function getHeightPx(duration: number): number {
  return (duration / 60) * HOUR_HEIGHT
}

function formatTime(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'HH:mm')
  } catch {
    return '--:--'
  }
}

function formatEndTime(dateStr: string, duration: number): string {
  try {
    const d = parseISO(dateStr)
    const end = new Date(d.getTime() + duration * 60000)
    return format(end, 'HH:mm')
  } catch {
    return '--:--'
  }
}

// API
async function fetchAppointments() {
  isLoading.value = true
  try {
    const dateStr = format(selectedDate.value, 'yyyy-MM-dd')
    // Fetch wider range for calendar dots (current month)
    const monthStart = format(startOfMonth(calendarMonth.value), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(calendarMonth.value), 'yyyy-MM-dd')
    const response = await appointmentsApi.calendar(monthStart, monthEnd)
    if (response.data) {
      appointments.value = response.data
    }
  } catch {
    toast.error('Erro ao carregar agendamentos')
  } finally {
    isLoading.value = false
  }
}

async function fetchProfessionals() {
  try {
    const response = await professionalsApi.listActive()
    if (response.data) {
      professionals.value = response.data
    }
  } catch {
    console.error('Erro ao carregar profissionais')
  }
}

async function handleStatusChange(id: string, status: AppointmentStatus) {
  try {
    await appointmentsApi.updateStatus(id, status)
    toast.success('Status atualizado')
    fetchAppointments()
  } catch {
    toast.error('Erro ao atualizar status')
  }
}

async function handleDelete(id: string) {
  if (!confirm('Tem certeza que deseja excluir este agendamento?')) return
  try {
    await appointmentsApi.delete(id)
    toast.success('Agendamento excluido')
    fetchAppointments()
  } catch {
    toast.error('Erro ao excluir agendamento')
  }
}

function openNewAppointment(professionalId?: string, time?: string) {
  editingAppointment.value = null
  preselectedProfessionalId.value = professionalId || ''
  preselectedTime.value = time || ''
  showModal.value = true
}

function openEditAppointment(appointment: Appointment) {
  editingAppointment.value = appointment
  preselectedProfessionalId.value = ''
  preselectedTime.value = ''
  showModal.value = true
}

function handleSave() {
  showModal.value = false
  editingAppointment.value = null
  fetchAppointments()
}

function closeModal() {
  showModal.value = false
  editingAppointment.value = null
}

// Click on empty slot in timeline
function handleTimelineClick(event: MouseEvent, professionalId: string) {
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const y = event.clientY - rect.top + target.scrollTop
  const hoursFromStart = y / HOUR_HEIGHT
  const totalHours = START_HOUR + hoursFromStart
  const hours = Math.floor(totalHours)
  const minutes = Math.round((totalHours - hours) * 60 / 15) * 15 // snap to 15 min
  const time = `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
  openNewAppointment(professionalId, time)
}

// For list view
const allSortedAppointments = computed(() =>
  [...appointments.value]
    .filter(a => {
      try { return isSameDay(parseISO(a.date), selectedDate.value) } catch { return false }
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
)

// Watchers
watch(selectedDate, () => {
  // If selected date is in a different month, update calendar month
  if (!isSameMonth(selectedDate.value, calendarMonth.value)) {
    calendarMonth.value = selectedDate.value
  }
  fetchAppointments()
})

watch(calendarMonth, () => {
  fetchAppointments()
})

onMounted(() => {
  fetchAppointments()
  fetchProfessionals()
})
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white shadow-lg">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div class="flex items-center gap-3 mb-2">
            <div class="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Calendar class="w-6 h-6" />
            </div>
            <h1 class="text-2xl font-bold">Agenda</h1>
          </div>
          <p class="text-primary-100">Visualize e gerencie os agendamentos por profissional.</p>
        </div>

        <div class="flex items-center gap-3">
          <!-- View toggle -->
          <div class="flex bg-white/10 backdrop-blur-sm rounded-lg p-1">
            <button
              @click="viewMode = 'timeline'"
              :class="[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                viewMode === 'timeline'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              ]"
            >
              <Clock class="w-4 h-4" />
              <span class="hidden sm:inline">Timeline</span>
            </button>
            <button
              @click="viewMode = 'list'"
              :class="[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                viewMode === 'list'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              ]"
            >
              <List class="w-4 h-4" />
              <span class="hidden sm:inline">Lista</span>
            </button>
          </div>

          <!-- New button -->
          <button
            @click="openNewAppointment()"
            class="bg-white text-primary-600 px-4 py-2 rounded-lg font-medium hover:bg-white/90 transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus class="w-5 h-5" />
            <span>Novo</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Content area -->
    <div class="flex gap-4">
      <!-- Left sidebar: mini calendar -->
      <div class="hidden lg:block w-64 flex-shrink-0 space-y-4">
        <!-- Mini calendar -->
        <div class="bg-white rounded-xl border border-gray-200 p-4">
          <div class="flex items-center justify-between mb-3">
            <button
              @click="calendarMonth = subDays(startOfMonth(calendarMonth), 1)"
              class="p-1 rounded hover:bg-gray-100"
            >
              <ChevronLeft class="w-4 h-4 text-gray-500" />
            </button>
            <span class="text-sm font-semibold text-gray-900 capitalize">{{ calendarMonthLabel }}</span>
            <button
              @click="calendarMonth = addDays(endOfMonth(calendarMonth), 1)"
              class="p-1 rounded hover:bg-gray-100"
            >
              <ChevronRight class="w-4 h-4 text-gray-500" />
            </button>
          </div>

          <div class="grid grid-cols-7 mb-1">
            <div v-for="d in weekdays" :key="d" class="text-center text-[10px] font-medium text-gray-400 py-1">
              {{ d }}
            </div>
          </div>

          <div class="grid grid-cols-7">
            <button
              v-for="day in calendarDays"
              :key="day.toISOString()"
              @click="selectedDate = day"
              :class="[
                'relative w-8 h-8 flex items-center justify-center rounded-full text-xs transition-colors mx-auto',
                !isSameMonth(day, calendarMonth) ? 'text-gray-300' : 'text-gray-700',
                isSameDay(day, selectedDate) ? 'bg-primary-600 text-white font-bold' : '',
                isTodayFn(day) && !isSameDay(day, selectedDate) ? 'bg-primary-50 font-bold text-primary-700' : '',
                isSameMonth(day, calendarMonth) && !isTodayFn(day) && !isSameDay(day, selectedDate) ? 'hover:bg-gray-100' : '',
              ]"
            >
              {{ format(day, 'd') }}
              <span
                v-if="hasAppointments(day) && !isSameDay(day, selectedDate)"
                class="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-500"
              />
            </button>
          </div>

          <button
            @click="goToday"
            class="mt-3 w-full text-xs text-primary-600 font-medium hover:text-primary-700 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
          >
            Hoje
          </button>
        </div>

        <!-- Legend -->
        <div class="bg-white rounded-xl border border-gray-200 p-4">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Legenda</p>
          <div class="space-y-2">
            <div v-for="(cfg, key) in statusConfig" :key="key" class="flex items-center gap-2">
              <div class="w-3 h-3 rounded border" :class="[cfg.bg, cfg.border]" />
              <span class="text-xs text-gray-600">{{ cfg.label }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Main content -->
      <div class="flex-1 min-w-0">
        <!-- Date navigation -->
        <div class="bg-white rounded-xl border border-gray-200 px-4 py-3 mb-4 flex items-center justify-between">
          <button @click="prevDay" class="p-2 rounded-lg hover:bg-gray-100">
            <ChevronLeft class="w-5 h-5 text-gray-600" />
          </button>
          <div class="text-center">
            <h2 class="text-lg font-semibold text-gray-900 capitalize">{{ dateLabel }}</h2>
            <p class="text-xs text-gray-500">
              {{ dayAppointments.length }} agendamento{{ dayAppointments.length !== 1 ? 's' : '' }}
            </p>
          </div>
          <button @click="nextDay" class="p-2 rounded-lg hover:bg-gray-100">
            <ChevronRight class="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <!-- Loading -->
        <div v-if="isLoading" class="bg-white rounded-xl border border-gray-200 flex items-center justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>

        <!-- Timeline View -->
        <template v-else-if="viewMode === 'timeline'">
          <div v-if="professionals.length === 0" class="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Calendar class="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 class="font-semibold text-gray-900 mb-1">Nenhum profissional cadastrado</h3>
            <p class="text-sm text-gray-500">Cadastre profissionais para visualizar a timeline.</p>
          </div>

          <div v-else class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <!-- Professional headers -->
            <div class="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
              <!-- Time column header -->
              <div class="w-16 flex-shrink-0 border-r border-gray-200 p-2">
                <Clock class="w-4 h-4 text-gray-400 mx-auto" />
              </div>
              <!-- Professional columns -->
              <div
                v-for="prof in professionals"
                :key="prof._id"
                class="flex-1 min-w-[140px] px-3 py-2 border-r border-gray-100 last:border-r-0"
              >
                <div class="flex items-center gap-2">
                  <div
                    class="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                    :style="{ backgroundColor: prof.color }"
                  >
                    {{ prof.name.charAt(0) }}
                  </div>
                  <span class="text-xs font-semibold text-gray-700 truncate">{{ prof.name }}</span>
                </div>
              </div>
              <!-- Unassigned column -->
              <div
                v-if="unassignedAppointments.length > 0"
                class="flex-1 min-w-[140px] px-3 py-2"
              >
                <span class="text-xs font-semibold text-gray-400">Sem profissional</span>
              </div>
            </div>

            <!-- Timeline body -->
            <div class="flex overflow-x-auto" style="max-height: calc(100vh - 320px); overflow-y: auto;">
              <!-- Time labels -->
              <div class="w-16 flex-shrink-0 border-r border-gray-200 bg-gray-50/50">
                <div
                  v-for="time in timeSlots"
                  :key="time"
                  class="border-b border-gray-100 flex items-start justify-end pr-2 pt-1"
                  :style="{ height: HOUR_HEIGHT + 'px' }"
                >
                  <span class="text-[10px] text-gray-400 font-medium leading-none">{{ time }}</span>
                </div>
              </div>

              <!-- Professional columns with appointments -->
              <div
                v-for="prof in professionals"
                :key="prof._id"
                class="flex-1 min-w-[140px] border-r border-gray-100 last:border-r-0 relative cursor-pointer"
                :style="{ height: (END_HOUR - START_HOUR + 1) * HOUR_HEIGHT + 'px' }"
                @dblclick="handleTimelineClick($event, prof._id)"
              >
                <!-- Hour grid lines -->
                <div
                  v-for="time in timeSlots"
                  :key="time"
                  class="absolute left-0 right-0 border-b border-gray-100"
                  :style="{ top: (timeSlots.indexOf(time)) * HOUR_HEIGHT + 'px', height: HOUR_HEIGHT + 'px' }"
                >
                  <!-- Half hour line -->
                  <div class="absolute left-0 right-0 border-b border-gray-50" :style="{ top: HOUR_HEIGHT / 2 + 'px' }" />
                </div>

                <!-- Appointment blocks -->
                <div
                  v-for="apt in getAppointmentsForProfessional(prof._id)"
                  :key="apt._id"
                  class="absolute left-1 right-1 rounded-md border px-2 py-1 overflow-hidden cursor-pointer transition-shadow hover:shadow-md z-[1]"
                  :class="[statusConfig[apt.status]?.bg, statusConfig[apt.status]?.border]"
                  :style="{
                    top: getTopPx(apt.date) + 'px',
                    height: Math.max(getHeightPx(apt.duration), 24) + 'px',
                  }"
                  @click.stop="openEditAppointment(apt)"
                  :title="`${apt.title} - ${formatTime(apt.date)} ate ${formatEndTime(apt.date, apt.duration)}`"
                >
                  <div class="flex items-center gap-1">
                    <p class="text-[10px] font-bold truncate" :class="statusConfig[apt.status]?.text">
                      {{ formatTime(apt.date) }} - {{ formatEndTime(apt.date, apt.duration) }}
                    </p>
                    <svg v-if="apt.googleCalendarEventId" class="w-2.5 h-2.5 text-blue-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" title="Sincronizado com Google Calendar">
                      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/>
                    </svg>
                  </div>
                  <p class="text-[11px] font-medium text-gray-800 truncate leading-tight">
                    {{ apt.title }}
                  </p>
                  <p v-if="apt.contactName && apt.duration >= 30" class="text-[10px] text-gray-500 truncate leading-tight">
                    {{ apt.contactName }}
                  </p>
                  <p v-if="apt.serviceName && apt.duration >= 45" class="text-[10px] text-gray-400 truncate leading-tight">
                    {{ apt.serviceName }}
                  </p>
                </div>
              </div>

              <!-- Unassigned column -->
              <div
                v-if="unassignedAppointments.length > 0"
                class="flex-1 min-w-[140px] relative"
                :style="{ height: (END_HOUR - START_HOUR + 1) * HOUR_HEIGHT + 'px' }"
              >
                <!-- Hour grid lines -->
                <div
                  v-for="time in timeSlots"
                  :key="time"
                  class="absolute left-0 right-0 border-b border-gray-100"
                  :style="{ top: (timeSlots.indexOf(time)) * HOUR_HEIGHT + 'px', height: HOUR_HEIGHT + 'px' }"
                />

                <div
                  v-for="apt in unassignedAppointments"
                  :key="apt._id"
                  class="absolute left-1 right-1 rounded-md border px-2 py-1 overflow-hidden cursor-pointer transition-shadow hover:shadow-md z-[1]"
                  :class="[statusConfig[apt.status]?.bg, statusConfig[apt.status]?.border]"
                  :style="{
                    top: getTopPx(apt.date) + 'px',
                    height: Math.max(getHeightPx(apt.duration), 24) + 'px',
                  }"
                  @click.stop="openEditAppointment(apt)"
                >
                  <p class="text-[10px] font-bold truncate" :class="statusConfig[apt.status]?.text">
                    {{ formatTime(apt.date) }}
                  </p>
                  <p class="text-[11px] font-medium text-gray-800 truncate">{{ apt.title }}</p>
                </div>
              </div>
            </div>

            <!-- Tip -->
            <div class="px-4 py-2 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-400">
              Duplo clique em um horario para criar agendamento
            </div>
          </div>
        </template>

        <!-- List View -->
        <template v-else-if="viewMode === 'list'">
          <div v-if="allSortedAppointments.length === 0" class="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Calendar class="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 class="font-semibold text-gray-900 mb-1">Nenhum agendamento neste dia</h3>
            <p class="text-sm text-gray-500">Crie um novo agendamento para comecar.</p>
            <button
              @click="openNewAppointment()"
              class="mt-3 text-primary-600 text-sm font-medium hover:text-primary-700"
            >
              + Criar agendamento
            </button>
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="apt in allSortedAppointments"
              :key="apt._id"
              class="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow cursor-pointer"
              @click="openEditAppointment(apt)"
            >
              <div class="flex items-start gap-4">
                <!-- Time -->
                <div class="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
                  <span class="text-sm font-bold text-gray-900">{{ formatTime(apt.date) }}</span>
                  <span class="text-[10px] text-gray-400">{{ apt.duration }}min</span>
                </div>

                <!-- Color bar -->
                <div
                  class="w-1 self-stretch rounded-full flex-shrink-0"
                  :style="{ backgroundColor: professionals.find(p => p._id === apt.professionalId)?.color || '#94a3b8' }"
                />

                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-0.5">
                    <h4 class="font-semibold text-gray-900 text-sm truncate">{{ apt.title }}</h4>
                    <span
                      class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none flex-shrink-0"
                      :class="[statusConfig[apt.status]?.bg, statusConfig[apt.status]?.text, statusConfig[apt.status]?.border, 'border']"
                    >
                      {{ statusConfig[apt.status]?.label }}
                    </span>
                    <svg v-if="apt.googleCalendarEventId" class="w-3.5 h-3.5 text-blue-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" title="Sincronizado com Google Calendar">
                      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/>
                    </svg>
                  </div>
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span v-if="apt.professionalName">{{ apt.professionalName }}</span>
                    <span v-if="apt.serviceName">{{ apt.serviceName }}</span>
                    <span v-if="apt.contactName">{{ apt.contactName }}</span>
                  </div>
                </div>

                <!-- Actions -->
                <div class="flex items-center gap-1 flex-shrink-0">
                  <select
                    :value="apt.status"
                    @click.stop
                    @change.stop="handleStatusChange(apt._id, ($event.target as HTMLSelectElement).value as AppointmentStatus)"
                    class="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="scheduled">Agendado</option>
                    <option value="confirmed">Confirmado</option>
                    <option value="cancelled">Cancelado</option>
                    <option value="completed">Concluido</option>
                  </select>
                  <button
                    @click.stop="handleDelete(apt._id)"
                    class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Modal -->
    <AppointmentModal
      v-if="showModal"
      :model-value="showModal"
      :appointment="editingAppointment"
      :selected-date="selectedDate"
      :preselected-professional-id="preselectedProfessionalId"
      :preselected-time="preselectedTime"
      @update:model-value="(v: boolean) => { if (!v) closeModal() }"
      @saved="handleSave"
    />
  </div>
</template>
