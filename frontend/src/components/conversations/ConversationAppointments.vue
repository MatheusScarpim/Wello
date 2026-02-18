<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { X, Plus, Calendar, Clock, Check, XCircle, CheckCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-vue-next'
import { useToast } from 'vue-toastification'
import { appointmentsApi, servicesApi, professionalsApi } from '@/api'
import type { Appointment, AppointmentStatus, TimeSlot, Service, Professional } from '@/types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const props = defineProps<{
  identifier: string
  contactName: string
}>()

const emit = defineEmits<{
  close: []
}>()

const toast = useToast()

const appointments = ref<Appointment[]>([])
const isLoading = ref(false)
const isUpdatingStatus = ref<string | null>(null)

// Create form
const showCreateForm = ref(false)
const isSaving = ref(false)
const slots = ref<TimeSlot[]>([])
const services = ref<Service[]>([])
const professionals = ref<Professional[]>([])

const form = ref({
  title: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  time: '',
  duration: 30,
  serviceId: '',
  professionalId: '',
  description: '',
})

const availableSlots = computed(() => slots.value.filter(s => s.available))

const selectedService = computed(() =>
  services.value.find(s => s._id === form.value.serviceId)
)

const selectedProfessional = computed(() =>
  professionals.value.find(p => p._id === form.value.professionalId)
)

const filteredServices = computed(() => {
  if (!form.value.professionalId) return services.value
  const prof = selectedProfessional.value
  if (!prof || !prof.serviceIds || prof.serviceIds.length === 0) return services.value
  return services.value.filter(s => prof.serviceIds.includes(s._id))
})

async function fetchAppointments() {
  isLoading.value = true
  try {
    const response = await appointmentsApi.list({ contactIdentifier: props.identifier })
    const data = response.data as any
    if (Array.isArray(data)) {
      appointments.value = data
    } else if (data && Array.isArray(data.data)) {
      appointments.value = data.data
    } else if (data && Array.isArray(data.items)) {
      appointments.value = data.items
    } else {
      appointments.value = []
    }
  } catch {
    appointments.value = []
  } finally {
    isLoading.value = false
  }
}

async function updateStatus(id: string, status: AppointmentStatus) {
  isUpdatingStatus.value = id
  try {
    await appointmentsApi.updateStatus(id, status)
    const appt = appointments.value.find(a => a._id === id)
    if (appt) appt.status = status
    toast.success('Status atualizado')
  } catch {
    toast.error('Erro ao atualizar status')
  } finally {
    isUpdatingStatus.value = null
  }
}

// Watch date to load slots
watch(
  () => form.value.date,
  async (newDate) => {
    if (!newDate) { slots.value = []; return }
    try {
      const response = await appointmentsApi.slots(newDate)
      slots.value = response.data || []
    } catch {
      slots.value = []
    }
  },
  { immediate: true }
)

// Auto-fill from service
watch(
  () => form.value.serviceId,
  (serviceId) => {
    if (!serviceId) return
    const svc = services.value.find(s => s._id === serviceId)
    if (svc) {
      form.value.duration = svc.defaultDuration
      if (!form.value.title) form.value.title = svc.name
    }
  }
)

function resetForm() {
  form.value = {
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '',
    duration: 30,
    serviceId: '',
    professionalId: '',
    description: '',
  }
}

async function handleCreate() {
  if (!form.value.title || !form.value.date) {
    toast.error('Preencha título e data')
    return
  }

  isSaving.value = true
  try {
    // Converte horário local do navegador para ISO UTC
    const dateTime = form.value.time
      ? new Date(`${form.value.date}T${form.value.time}:00`).toISOString()
      : new Date(`${form.value.date}T00:00:00`).toISOString()

    const payload: any = {
      title: form.value.title,
      date: dateTime,
      duration: form.value.duration,
      contactName: props.contactName,
      contactIdentifier: props.identifier,
      description: form.value.description || undefined,
    }

    if (form.value.serviceId) {
      payload.serviceId = form.value.serviceId
      payload.serviceName = selectedService.value?.name
    }
    if (form.value.professionalId) {
      payload.professionalId = form.value.professionalId
      payload.professionalName = selectedProfessional.value?.name
    }

    await appointmentsApi.create(payload)
    toast.success('Agendamento criado')
    showCreateForm.value = false
    resetForm()
    await fetchAppointments()
  } catch {
    toast.error('Erro ao criar agendamento')
  } finally {
    isSaving.value = false
  }
}

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr)
    return format(d, "dd 'de' MMM, yyyy", { locale: ptBR })
  } catch {
    return dateStr
  }
}

function formatTime(dateStr: string) {
  try {
    const d = new Date(dateStr)
    return format(d, 'HH:mm')
  } catch {
    return ''
  }
}

function statusLabel(status: AppointmentStatus) {
  const map: Record<AppointmentStatus, string> = {
    scheduled: 'Agendado',
    confirmed: 'Confirmado',
    cancelled: 'Cancelado',
    completed: 'Concluído',
  }
  return map[status] || status
}

function statusColor(status: AppointmentStatus) {
  const map: Record<AppointmentStatus, string> = {
    scheduled: 'bg-blue-100 text-blue-700',
    confirmed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
    completed: 'bg-gray-100 text-gray-600',
  }
  return map[status] || 'bg-gray-100 text-gray-600'
}

onMounted(async () => {
  fetchAppointments()
  try {
    const [svcRes, profRes] = await Promise.all([
      servicesApi.list(),
      professionalsApi.listActive(),
    ])
    services.value = svcRes.data ?? svcRes ?? []
    professionals.value = profRes.data ?? profRes ?? []
  } catch {
    // silent
  }
})
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/30 z-[60]"
      @click="emit('close')"
    />

    <!-- Drawer -->
    <div
      class="fixed top-0 right-0 h-full w-full sm:w-96 bg-white shadow-2xl z-[61] flex flex-col"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div class="flex items-center gap-2">
          <Calendar class="w-5 h-5 text-primary-600" />
          <h3 class="text-lg font-semibold text-gray-900">Agendamentos</h3>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="showCreateForm = !showCreateForm"
            class="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
            :class="showCreateForm
              ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              : 'bg-primary-500 text-white hover:bg-primary-600'"
          >
            <component :is="showCreateForm ? ChevronUp : Plus" class="w-4 h-4" />
            {{ showCreateForm ? 'Fechar' : 'Novo' }}
          </button>
          <button
            @click="emit('close')"
            class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X class="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      <!-- Create Form (collapsible) -->
      <div v-if="showCreateForm" class="border-b border-gray-200 bg-gray-50 p-4 space-y-3 overflow-y-auto max-h-[50vh]">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Título *</label>
          <input
            v-model="form.title"
            type="text"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Consulta, Reunião..."
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Data *</label>
            <input
              v-model="form.date"
              type="date"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Horário</label>
            <select
              v-model="form.time"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Selecione</option>
              <option
                v-for="slot in availableSlots"
                :key="slot.start"
                :value="slot.start"
              >
                {{ slot.start }} - {{ slot.end }}
              </option>
              <option v-if="availableSlots.length === 0" disabled>Sem horários disponíveis</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Serviço</label>
            <select
              v-model="form.serviceId"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Nenhum</option>
              <option v-for="s in filteredServices" :key="s._id" :value="s._id">{{ s.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Profissional</label>
            <select
              v-model="form.professionalId"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Nenhum</option>
              <option v-for="p in professionals" :key="p._id" :value="p._id">{{ p.name }}</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Duração (min)</label>
          <input
            v-model.number="form.duration"
            type="number"
            min="5"
            max="480"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
          <textarea
            v-model="form.description"
            rows="2"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            placeholder="Observações..."
          />
        </div>

        <button
          @click="handleCreate"
          :disabled="isSaving || !form.title || !form.date"
          class="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
          <Check v-else class="w-4 h-4" />
          Criar Agendamento
        </button>
      </div>

      <!-- Appointments List -->
      <div class="flex-1 overflow-y-auto">
        <!-- Loading -->
        <div v-if="isLoading" class="flex items-center justify-center py-12">
          <Loader2 class="w-6 h-6 animate-spin text-primary-500" />
        </div>

        <!-- Empty state -->
        <div v-else-if="appointments.length === 0" class="flex flex-col items-center justify-center py-12 px-4 text-center">
          <Calendar class="w-10 h-10 text-gray-300 mb-3" />
          <p class="text-sm text-gray-500">Nenhum agendamento para este contato</p>
          <button
            v-if="!showCreateForm"
            @click="showCreateForm = true"
            class="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            + Criar primeiro agendamento
          </button>
        </div>

        <!-- List -->
        <div v-else class="divide-y divide-gray-100">
          <div
            v-for="appt in appointments"
            :key="appt._id"
            class="px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <h4 class="text-sm font-medium text-gray-900 truncate">{{ appt.title }}</h4>
                <div class="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <Calendar class="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{{ formatDate(appt.date) }}</span>
                  <Clock class="w-3.5 h-3.5 flex-shrink-0 ml-1" />
                  <span>{{ formatTime(appt.date) }}</span>
                  <span class="text-gray-400">({{ appt.duration }}min)</span>
                </div>
                <div v-if="appt.serviceName || appt.professionalName" class="flex items-center gap-2 mt-1 text-xs text-gray-400">
                  <span v-if="appt.serviceName">{{ appt.serviceName }}</span>
                  <span v-if="appt.serviceName && appt.professionalName">·</span>
                  <span v-if="appt.professionalName">{{ appt.professionalName }}</span>
                </div>
              </div>
              <span
                class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0"
                :class="statusColor(appt.status)"
              >
                {{ statusLabel(appt.status) }}
              </span>
            </div>

            <!-- Actions -->
            <div
              v-if="appt.status === 'scheduled' || appt.status === 'confirmed'"
              class="flex items-center gap-2 mt-2"
            >
              <button
                v-if="appt.status === 'scheduled'"
                @click="updateStatus(appt._id, 'confirmed')"
                :disabled="isUpdatingStatus === appt._id"
                class="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <CheckCircle class="w-3 h-3" />
                Aprovar
              </button>
              <button
                v-if="appt.status === 'confirmed'"
                @click="updateStatus(appt._id, 'completed')"
                :disabled="isUpdatingStatus === appt._id"
                class="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Check class="w-3 h-3" />
                Concluir
              </button>
              <button
                @click="updateStatus(appt._id, 'cancelled')"
                :disabled="isUpdatingStatus === appt._id"
                class="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <XCircle class="w-3 h-3" />
                Rejeitar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
