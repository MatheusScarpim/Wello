<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { availabilityApi } from '@/api'
import { Clock, Save, Plus, Trash2, CalendarOff } from 'lucide-vue-next'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import { useToast } from 'vue-toastification'
import type { AvailabilitySettings, DaySchedule } from '@/types'

const toast = useToast()

const settings = ref<AvailabilitySettings | null>(null)
const isLoading = ref(false)
const isSaving = ref(false)
const newBlockedDate = ref('')

const weekDays: { key: keyof AvailabilitySettings['schedule']; label: string }[] = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terca-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sabado' },
  { key: 'sunday', label: 'Domingo' },
]

const defaultSchedule: DaySchedule = { enabled: true, start: '09:00', end: '18:00' }

function getDefaultSettings(): AvailabilitySettings {
  return {
    slotDuration: 30,
    schedule: {
      monday: { ...defaultSchedule },
      tuesday: { ...defaultSchedule },
      wednesday: { ...defaultSchedule },
      thursday: { ...defaultSchedule },
      friday: { ...defaultSchedule },
      saturday: { enabled: false, start: '09:00', end: '13:00' },
      sunday: { enabled: false, start: '09:00', end: '13:00' },
    },
    blockedDates: [],
  }
}

async function fetchSettings() {
  isLoading.value = true
  try {
    const res = await availabilityApi.get()
    if (res.data) {
      settings.value = res.data as AvailabilitySettings
    } else {
      settings.value = getDefaultSettings()
    }
  } catch {
    toast.error('Erro ao carregar configuracoes de disponibilidade')
    settings.value = getDefaultSettings()
  } finally {
    isLoading.value = false
  }
}

async function handleSave() {
  if (!settings.value) return
  isSaving.value = true
  try {
    await availabilityApi.update(settings.value)
    toast.success('Configuracoes salvas com sucesso')
  } catch {
    toast.error('Erro ao salvar configuracoes')
  } finally {
    isSaving.value = false
  }
}

function addBlockedDate() {
  if (!settings.value || !newBlockedDate.value) return

  if (settings.value.blockedDates.includes(newBlockedDate.value)) {
    toast.warning('Esta data ja esta bloqueada')
    return
  }

  settings.value.blockedDates.push(newBlockedDate.value)
  settings.value.blockedDates.sort()
  newBlockedDate.value = ''
}

function removeBlockedDate(index: number) {
  if (!settings.value) return
  settings.value.blockedDates.splice(index, 1)
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

onMounted(fetchSettings)
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Disponibilidade</h1>
      <p class="text-gray-500">Configure os horarios disponiveis para agendamentos</p>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <LoadingSpinner size="lg" />
    </div>

    <template v-else-if="settings">
      <!-- Slot Duration Card -->
      <div class="bg-white rounded-xl border border-gray-200 p-5">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <Clock class="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 class="text-sm font-semibold text-gray-900">Duracao padrao do slot</h2>
            <p class="text-xs text-gray-500">Tempo de cada agendamento</p>
          </div>
        </div>
        <select v-model.number="settings.slotDuration" class="input w-full sm:w-48">
          <option :value="15">15 minutos</option>
          <option :value="30">30 minutos</option>
          <option :value="45">45 minutos</option>
          <option :value="60">60 minutos</option>
        </select>
      </div>

      <!-- Weekly Schedule Card -->
      <div class="bg-white rounded-xl border border-gray-200 p-5">
        <div class="flex items-center gap-3 mb-5">
          <div class="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
            <Clock class="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 class="text-sm font-semibold text-gray-900">Horarios da Semana</h2>
            <p class="text-xs text-gray-500">Defina os horarios de atendimento para cada dia</p>
          </div>
        </div>

        <div class="space-y-3">
          <div
            v-for="day in weekDays"
            :key="day.key"
            class="flex items-center gap-3 py-2 px-3 rounded-lg transition-colors"
            :class="settings.schedule[day.key].enabled ? 'bg-gray-50' : 'bg-gray-50/50'"
          >
            <!-- Toggle Switch -->
            <button
              type="button"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0"
              :class="settings.schedule[day.key].enabled ? 'bg-green-500' : 'bg-gray-300'"
              @click="settings.schedule[day.key].enabled = !settings.schedule[day.key].enabled"
            >
              <span
                class="inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm"
                :class="settings.schedule[day.key].enabled ? 'translate-x-6' : 'translate-x-1'"
              />
            </button>

            <!-- Day Name -->
            <span
              class="text-sm w-32 flex-shrink-0 font-medium"
              :class="settings.schedule[day.key].enabled ? 'text-gray-900' : 'text-gray-400'"
            >
              {{ day.label }}
            </span>

            <!-- Time Inputs -->
            <div class="flex items-center gap-2">
              <input
                v-model="settings.schedule[day.key].start"
                type="time"
                class="input w-28 text-sm"
                :disabled="!settings.schedule[day.key].enabled"
                :class="{ 'opacity-50 cursor-not-allowed': !settings.schedule[day.key].enabled }"
              />
              <span
                class="text-sm"
                :class="settings.schedule[day.key].enabled ? 'text-gray-500' : 'text-gray-300'"
              >-</span>
              <input
                v-model="settings.schedule[day.key].end"
                type="time"
                class="input w-28 text-sm"
                :disabled="!settings.schedule[day.key].enabled"
                :class="{ 'opacity-50 cursor-not-allowed': !settings.schedule[day.key].enabled }"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Blocked Dates Card -->
      <div class="bg-white rounded-xl border border-gray-200 p-5">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
            <CalendarOff class="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 class="text-sm font-semibold text-gray-900">Datas Bloqueadas</h2>
            <p class="text-xs text-gray-500">Feriados ou dias sem atendimento</p>
          </div>
        </div>

        <!-- Add Blocked Date -->
        <div class="flex items-center gap-2 mb-4">
          <input
            v-model="newBlockedDate"
            type="date"
            class="input flex-1 sm:flex-none sm:w-48"
          />
          <button
            type="button"
            class="btn-primary"
            :disabled="!newBlockedDate"
            @click="addBlockedDate"
          >
            <Plus class="w-4 h-4" />
            Adicionar
          </button>
        </div>

        <!-- Blocked Dates List -->
        <div v-if="settings.blockedDates.length === 0" class="text-center py-6 bg-gray-50 rounded-lg">
          <CalendarOff class="w-6 h-6 text-gray-300 mx-auto mb-1" />
          <p class="text-xs text-gray-400">Nenhuma data bloqueada</p>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="(date, index) in settings.blockedDates"
            :key="date"
            class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg group"
          >
            <span class="text-sm text-gray-700 font-medium">{{ formatDate(date) }}</span>
            <button
              type="button"
              class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
              title="Remover data"
              @click="removeBlockedDate(index)"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- Save Button -->
      <div class="flex justify-end">
        <button
          type="button"
          class="btn-primary"
          :disabled="isSaving"
          @click="handleSave"
        >
          <LoadingSpinner v-if="isSaving" size="sm" />
          <Save v-else class="w-4 h-4" />
          Salvar Configuracoes
        </button>
      </div>
    </template>
  </div>
</template>
