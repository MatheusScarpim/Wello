<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { X, Check, XCircle, CheckCircle } from 'lucide-vue-next'
import { useToast } from 'vue-toastification'
import { format } from 'date-fns'
import { appointmentsApi, operatorsApi, professionalsApi, servicesApi } from '@/api'
import type { Appointment, Operator, Professional, Service, TimeSlot } from '@/types'

const props = defineProps<{
  modelValue: boolean
  appointment?: Appointment | null
  selectedDate?: Date
  preselectedProfessionalId?: string
  preselectedTime?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const toast = useToast()

const isSaving = ref(false)
const slots = ref<TimeSlot[]>([])
const operators = ref<Operator[]>([])
const professionals = ref<Professional[]>([])
const services = ref<Service[]>([])

const form = ref({
  title: '',
  date: '',
  time: '',
  duration: 30,
  contactName: '',
  contactIdentifier: '',
  operatorId: '',
  professionalId: '',
  serviceId: '',
  description: '',
})

const isEditing = computed(() => !!props.appointment)

const modalTitle = computed(() =>
  isEditing.value ? 'Editar Agendamento' : 'Novo Agendamento'
)

const availableSlots = computed(() =>
  slots.value.filter((s) => s.available)
)

// When service changes, auto-fill duration and title
const selectedService = computed(() =>
  services.value.find(s => s._id === form.value.serviceId)
)

const selectedProfessional = computed(() =>
  professionals.value.find(p => p._id === form.value.professionalId)
)

// Filter services based on selected professional (if they have serviceIds)
const filteredServices = computed(() => {
  if (!form.value.professionalId) return services.value
  const prof = selectedProfessional.value
  if (!prof || prof.serviceIds.length === 0) return services.value
  return services.value.filter(s => prof.serviceIds.includes(s._id))
})

function close() {
  emit('update:modelValue', false)
}

// Populate form when editing
watch(
  () => props.appointment,
  (appt) => {
    if (appt) {
      const dateObj = new Date(appt.date)
      const dateStr = appt.date.split('T')[0]
      const hours = String(dateObj.getHours()).padStart(2, '0')
      const minutes = String(dateObj.getMinutes()).padStart(2, '0')

      form.value = {
        title: appt.title,
        date: dateStr,
        time: `${hours}:${minutes}`,
        duration: appt.duration || 30,
        contactName: appt.contactName || '',
        contactIdentifier: appt.contactIdentifier || '',
        operatorId: appt.operatorId || '',
        professionalId: appt.professionalId || '',
        serviceId: appt.serviceId || '',
        description: appt.description || '',
      }
    } else {
      // New appointment
      const dateStr = props.selectedDate
        ? format(props.selectedDate, 'yyyy-MM-dd')
        : format(new Date(), 'yyyy-MM-dd')

      form.value = {
        title: '',
        date: dateStr,
        time: props.preselectedTime || '',
        duration: 30,
        contactName: '',
        contactIdentifier: '',
        operatorId: '',
        professionalId: props.preselectedProfessionalId || '',
        serviceId: '',
        description: '',
      }
    }
  },
  { immediate: true }
)

// Auto-fill duration and title when service changes
watch(
  () => form.value.serviceId,
  (serviceId) => {
    if (!serviceId || isEditing.value) return
    const svc = services.value.find(s => s._id === serviceId)
    if (svc) {
      form.value.duration = svc.defaultDuration
      if (!form.value.title) {
        form.value.title = svc.name
      }
    }
  }
)

// Fetch time slots when date changes
watch(
  () => form.value.date,
  async (newDate) => {
    if (!newDate) {
      slots.value = []
      return
    }
    try {
      const response = await appointmentsApi.slots(newDate)
      slots.value = response.data || []
    } catch {
      slots.value = []
    }
  },
  { immediate: true }
)

// Load data on mount
onMounted(async () => {
  try {
    const [opRes, profRes, svcRes] = await Promise.all([
      operatorsApi.list(),
      professionalsApi.listActive(),
      servicesApi.list(),
    ])
    operators.value = opRes.data || []
    professionals.value = profRes.data || []
    services.value = svcRes.data || []
  } catch {
    // Silently handle errors, selects will just be empty
  }
})

async function handleSubmit() {
  if (!form.value.title || !form.value.date) {
    toast.error('Preencha os campos obrigatorios')
    return
  }

  isSaving.value = true
  try {
    const dateTime = form.value.time
      ? `${form.value.date}T${form.value.time}:00`
      : `${form.value.date}T00:00:00`

    const selectedOp = operators.value.find(op => op._id === form.value.operatorId)
    const selectedProf = professionals.value.find(p => p._id === form.value.professionalId)
    const selectedSvc = services.value.find(s => s._id === form.value.serviceId)

    const payload = {
      title: form.value.title,
      date: dateTime,
      duration: form.value.duration,
      contactName: form.value.contactName || undefined,
      contactIdentifier: form.value.contactIdentifier || undefined,
      operatorId: form.value.operatorId || undefined,
      operatorName: selectedOp?.name || undefined,
      professionalId: form.value.professionalId || undefined,
      professionalName: selectedProf?.name || undefined,
      serviceId: form.value.serviceId || undefined,
      serviceName: selectedSvc?.name || undefined,
      description: form.value.description || undefined,
    }

    if (isEditing.value && props.appointment) {
      await appointmentsApi.update(props.appointment._id, payload)
      toast.success('Agendamento atualizado')
    } else {
      await appointmentsApi.create(payload)
      toast.success('Agendamento criado')
    }

    emit('saved')
    close()
  } catch {
    toast.error('Erro ao salvar agendamento')
  } finally {
    isSaving.value = false
  }
}

const isUpdatingStatus = ref(false)

async function handleStatusChange(status: string) {
  if (!props.appointment) return
  isUpdatingStatus.value = true
  try {
    await appointmentsApi.updateStatus(props.appointment._id, status)
    toast.success(
      status === 'confirmed' ? 'Agendamento aprovado' :
      status === 'cancelled' ? 'Agendamento rejeitado' :
      status === 'completed' ? 'Agendamento concluido' :
      'Status atualizado'
    )
    emit('saved')
    close()
  } catch {
    toast.error('Erro ao atualizar status')
  } finally {
    isUpdatingStatus.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      @click.self="close"
    >
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">
            {{ modalTitle }}
          </h2>
          <button @click="close" class="p-2 rounded-lg hover:bg-gray-100">
            <X class="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="flex-1 overflow-y-auto p-4 space-y-4">
          <!-- Service -->
          <div v-if="services.length > 0">
            <label class="label">Servico</label>
            <select v-model="form.serviceId" class="select">
              <option value="">Nenhum</option>
              <option
                v-for="svc in filteredServices"
                :key="svc._id"
                :value="svc._id"
              >
                {{ svc.name }} ({{ svc.defaultDuration }}min)
              </option>
            </select>
          </div>

          <!-- Professional -->
          <div v-if="professionals.length > 0">
            <label class="label">Profissional</label>
            <select v-model="form.professionalId" class="select">
              <option value="">Nenhum</option>
              <option
                v-for="prof in professionals"
                :key="prof._id"
                :value="prof._id"
              >
                {{ prof.name }}
              </option>
            </select>
          </div>

          <!-- Title -->
          <div>
            <label class="label">Titulo *</label>
            <input
              v-model="form.title"
              type="text"
              class="input"
              placeholder="Titulo do agendamento"
              required
            />
          </div>

          <!-- Date + Time -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">Data *</label>
              <input
                v-model="form.date"
                type="date"
                class="input"
                required
              />
            </div>

            <div>
              <label class="label">Horario</label>
              <select v-model="form.time" class="select">
                <option value="">Selecione...</option>
                <option
                  v-for="slot in availableSlots"
                  :key="slot.start"
                  :value="slot.start"
                >
                  {{ slot.start }} - {{ slot.end }}
                </option>
                <!-- Allow custom time if preselected or editing -->
                <option
                  v-if="form.time && !availableSlots.find(s => s.start === form.time)"
                  :value="form.time"
                >
                  {{ form.time }} (manual)
                </option>
              </select>
            </div>
          </div>

          <!-- Duration -->
          <div>
            <label class="label">Duracao (minutos)</label>
            <input
              v-model.number="form.duration"
              type="number"
              class="input"
              min="5"
              max="480"
              step="5"
            />
            <p v-if="selectedService" class="text-xs text-gray-400 mt-1">
              Duracao padrao do servico: {{ selectedService.defaultDuration }}min
            </p>
          </div>

          <!-- Contact Name + Identifier -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">Nome do contato</label>
              <input
                v-model="form.contactName"
                type="text"
                class="input"
                placeholder="Nome"
              />
            </div>

            <div>
              <label class="label">Telefone</label>
              <input
                v-model="form.contactIdentifier"
                type="text"
                class="input"
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          <!-- Operator -->
          <div>
            <label class="label">Operador (quem marcou)</label>
            <select v-model="form.operatorId" class="select">
              <option value="">Nenhum</option>
              <option
                v-for="op in operators"
                :key="op._id"
                :value="op._id"
              >
                {{ op.name }}
              </option>
            </select>
          </div>

          <!-- Description -->
          <div>
            <label class="label">Observacoes</label>
            <textarea
              v-model="form.description"
              class="input"
              rows="3"
              placeholder="Observacoes do agendamento..."
            />
          </div>
        </form>

        <!-- Status Actions (when editing) -->
        <div
          v-if="isEditing && appointment && (appointment.status === 'scheduled' || appointment.status === 'confirmed')"
          class="flex items-center gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50"
        >
          <span class="text-xs font-medium text-gray-500 mr-auto">Ações:</span>
          <button
            v-if="appointment.status === 'scheduled'"
            @click="handleStatusChange('confirmed')"
            :disabled="isUpdatingStatus"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <CheckCircle class="w-3.5 h-3.5" />
            Aprovar
          </button>
          <button
            v-if="appointment.status === 'confirmed'"
            @click="handleStatusChange('completed')"
            :disabled="isUpdatingStatus"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Check class="w-3.5 h-3.5" />
            Concluir
          </button>
          <button
            @click="handleStatusChange('cancelled')"
            :disabled="isUpdatingStatus"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
          >
            <XCircle class="w-3.5 h-3.5" />
            Rejeitar
          </button>
        </div>

        <!-- Footer -->
        <div class="flex gap-3 p-4 border-t border-gray-200">
          <button type="button" @click="close" class="btn-secondary flex-1">
            Cancelar
          </button>
          <button
            @click="handleSubmit"
            :disabled="isSaving"
            class="btn-primary flex-1"
          >
            {{ isSaving ? 'Salvando...' : 'Salvar' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
