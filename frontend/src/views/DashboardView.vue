<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { queueApi, operatorsApi, departmentsApi } from '@/api'
import { useWhitelabelStore } from '@/stores/whitelabel'
import {
  MessageSquare,
  RefreshCw,
  Users,
  Inbox,
  Building2
} from 'lucide-vue-next'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import PieChart from '@/components/charts/PieChart.vue'
import BarChart from '@/components/charts/BarChart.vue'
import DoughnutChart from '@/components/charts/DoughnutChart.vue'
import type { Operator, Department } from '@/types'

const whitelabelStore = useWhitelabelStore()

const isLoading = ref(true)
const operators = ref<Operator[]>([])
const departments = ref<Department[]>([])
const queueStats = ref({ waiting: 0, inProgress: 0, resolved: 0, avgWaitTime: 0 })

let refreshInterval: ReturnType<typeof setInterval>

async function fetchData() {
  isLoading.value = true
  try {
    const [queueStatsRes, operatorsRes, departmentsRes] = await Promise.all([
      queueApi.getStats().catch(() => null),
      operatorsApi.list().catch(() => null),
      departmentsApi.list().catch(() => null)
    ])

    if (queueStatsRes?.data) queueStats.value = queueStatsRes.data
    if (operatorsRes?.data) operators.value = operatorsRes.data as Operator[]
    if (departmentsRes?.data) departments.value = departmentsRes.data as Department[]
  } finally {
    isLoading.value = false
  }
}

const onlineOperators = () => operators.value.filter((o: Operator) => o.status === 'online').length
const busyOperators = () => operators.value.filter((o: Operator) => o.status === 'busy').length

// Dados para os gráficos
const queueChartData = computed(() => [
  { label: 'Na Fila', value: queueStats.value.waiting, color: '#eab308' },
  { label: 'Em Atendimento', value: queueStats.value.inProgress, color: '#3b82f6' },
  { label: 'Finalizados Hoje', value: queueStats.value.resolved, color: '#22c55e' }
])

const operatorsStatusChartData = computed(() => {
  const online = onlineOperators()
  const busy = busyOperators()
  const offline = operators.value.length - online - busy
  return [
    { label: 'Online', value: online, color: '#22c55e' },
    { label: 'Ocupado', value: busy, color: '#ef4444' },
    { label: 'Offline', value: offline, color: '#9ca3af' }
  ]
})

const operatorsChartData = computed(() => {
  return operators.value
    .filter((o: Operator) => o.status === 'online' || o.status === 'busy')
    .slice(0, 8)
    .map((o: Operator, index: number) => ({
      label: o.name.split(' ')[0],
      value: o.metrics?.activeChats || 0,
      color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'][index % 8]
    }))
})

const departmentsChartData = computed(() => {
  return departments.value.slice(0, 6).map((d: Department) => ({
    label: d.name,
    value: d.operators.length,
    color: d.color || '#6366f1'
  }))
})

onMounted(() => {
  fetchData()
  refreshInterval = setInterval(fetchData, 30000)
})

onUnmounted(() => {
  clearInterval(refreshInterval)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p class="text-gray-500">Visão geral do {{ whitelabelStore.companyName }}</p>
      </div>
      <button @click="fetchData" class="btn-outline" :disabled="isLoading">
        <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
        Atualizar
      </button>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <LoadingSpinner size="lg" />
    </div>

    <template v-else>
      <!-- Charts Section -->
      <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        <!-- Queue Status Pie Chart -->
        <div class="card card-body">
          <h3 class="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Inbox class="w-4 h-4 text-yellow-500" />
            Status da Fila
          </h3>
          <PieChart
            v-if="queueStats.waiting + queueStats.inProgress + queueStats.resolved > 0"
            :data="queueChartData"
          />
          <div v-else class="h-72 flex items-center justify-center text-gray-400 text-sm">
            Sem dados disponíveis
          </div>
        </div>

        <!-- Operators Status Doughnut -->
        <div class="card card-body">
          <h3 class="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Users class="w-4 h-4 text-blue-500" />
            Status dos Operadores
          </h3>
          <DoughnutChart
            v-if="operators.length > 0"
            :data="operatorsStatusChartData"
            :center-text="String(operators.length)"
            center-subtext="Total"
          />
          <div v-else class="h-72 flex items-center justify-center text-gray-400 text-sm">
            Sem operadores cadastrados
          </div>
        </div>

        <!-- Active Chats Bar Chart -->
        <div class="card card-body">
          <h3 class="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <MessageSquare class="w-4 h-4 text-green-500" />
            Chats Ativos por Operador
          </h3>
          <BarChart
            v-if="operatorsChartData.length > 0"
            :data="operatorsChartData"
          />
          <div v-else class="h-72 flex items-center justify-center text-gray-400 text-sm">
            Nenhum operador ativo
          </div>
        </div>

        <!-- Departments Chart -->
        <div class="card card-body">
          <h3 class="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Building2 class="w-4 h-4 text-purple-500" />
            Operadores por Departamento
          </h3>
          <BarChart
            v-if="departmentsChartData.length > 0"
            :data="departmentsChartData"
            :horizontal="true"
          />
          <div v-else class="h-72 flex items-center justify-center text-gray-400 text-sm">
            Sem departamentos
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
