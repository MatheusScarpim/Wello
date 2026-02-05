<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Users,
  Calendar,
  FileText,
  Award,
  BarChart3,
  Filter
} from 'lucide-vue-next'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import Pagination from '@/components/ui/Pagination.vue'
import { finalizationMetricsApi } from '@/api'
import type {
  FinalizationMetrics,
  FinalizationDetail,
  FinalizationTypeSummary,
  MetricsPeriod,
  Pagination as PaginationType
} from '@/types'

const isLoading = ref(true)
const metrics = ref<FinalizationMetrics | null>(null)
const detailedList = ref<FinalizationDetail[]>([])
const pagination = ref<PaginationType>({
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0
})

// Filters
const selectedPeriod = ref<MetricsPeriod>('today')
const customStartDate = ref('')
const customEndDate = ref('')
const selectedOperator = ref('')
const selectedFinalizationType = ref<'gain' | 'loss' | ''>('')
const selectedFinalizationId = ref('')

const periodOptions = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Última Semana' },
  { value: 'month', label: 'Último Mês' },
  { value: 'custom', label: 'Personalizado' }
]

async function fetchMetrics() {
  isLoading.value = true
  try {
    const params: Record<string, unknown> = { period: selectedPeriod.value }

    if (selectedPeriod.value === 'custom' && customStartDate.value && customEndDate.value) {
      params.startDate = customStartDate.value
      params.endDate = customEndDate.value
    }

    params.operatorId = selectedOperator.value || undefined
    params.finalizationType = selectedFinalizationType.value || undefined
    params.finalizationId = selectedFinalizationId.value || undefined
    const [metricsRes, listRes] = await Promise.all([
      finalizationMetricsApi.getMetrics(
        params as {
          period: MetricsPeriod
          startDate?: string
          endDate?: string
          finalizationId?: string
        },
      ),
      finalizationMetricsApi.getDetailedList({
        period: selectedPeriod.value,
        startDate: selectedPeriod.value === 'custom' ? customStartDate.value : undefined,
        endDate: selectedPeriod.value === 'custom' ? customEndDate.value : undefined,
        page: pagination.value.page,
        limit: pagination.value.pageSize,
        operatorId: selectedOperator.value || undefined,
        finalizationType: selectedFinalizationType.value || undefined,
        finalizationId: selectedFinalizationId.value || undefined,
      })
    ])

    if (metricsRes?.data) {
      metrics.value = metricsRes.data
    }

    if (listRes?.data) {
      detailedList.value = listRes.data.items
      pagination.value = listRes.data.pagination
    }
  } catch (err) {
    console.error('Erro ao carregar métricas:', err)
  } finally {
    isLoading.value = false
  }
}

function handlePageChange(page: number) {
  pagination.value.page = page
  fetchMetrics()
}

function formatDateTime(date?: string) {
  if (!date) return '-'
  return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: ptBR })
}

function formatFinalizationList(detail: FinalizationDetail) {
  if (detail.finalizations?.length) {
    return detail.finalizations
      .map((entry) => entry.finalizationName || entry.finalizationId || '-')
      .join(', ')
  }
  return detail.finalizationName || '-'
}

function applyCustomPeriod() {
  if (customStartDate.value && customEndDate.value) {
    pagination.value.page = 1
    fetchMetrics()
  }
}

// Computed para cálculo de porcentagem
const gainPercentage = computed(() => {
  if (!metrics.value || metrics.value.total === 0) return 0
  return Math.round((metrics.value.gains / metrics.value.total) * 100)
})

const lossPercentage = computed(() => {
  if (!metrics.value || metrics.value.total === 0) return 0
  return Math.round((metrics.value.losses / metrics.value.total) * 100)
})

const finalizationOptions = computed<FinalizationTypeSummary[]>(() => {
  const list = metrics.value?.byFinalizationType ?? []
  const seen = new Map<string, FinalizationTypeSummary>()
  list.forEach((entry) => {
    if (!entry.finalizationId) return
    const key = entry.finalizationId
    if (!seen.has(key)) {
      seen.set(key, entry)
    }
  })
  return Array.from(seen.values())
})

watch([selectedPeriod], () => {
  if (selectedPeriod.value !== 'custom') {
    pagination.value.page = 1
    fetchMetrics()
  }
})

watch([selectedOperator, selectedFinalizationType, selectedFinalizationId], () => {
  pagination.value.page = 1
  fetchMetrics()
})

onMounted(fetchMetrics)
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Métricas de Finalizações</h1>
        <p class="text-gray-500">Acompanhe o desempenho dos atendimentos finalizados</p>
      </div>
      <button @click="fetchMetrics" class="btn-outline" :disabled="isLoading">
        <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
        Atualizar
      </button>
    </div>

    <!-- Filters -->
    <div class="card card-body space-y-4">
      <div class="flex flex-col sm:flex-row gap-4 items-end">
        <div>
          <label class="label">Período</label>
          <select v-model="selectedPeriod" class="select">
            <option v-for="opt in periodOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <template v-if="selectedPeriod === 'custom'">
          <div>
            <label class="label">Data Início</label>
            <input v-model="customStartDate" type="date" class="input" />
          </div>
          <div>
            <label class="label">Data Fim</label>
            <input v-model="customEndDate" type="date" class="input" />
          </div>
          <button @click="applyCustomPeriod" class="btn-primary">
            <Calendar class="w-4 h-4" />
            Aplicar
          </button>
        </template>
      </div>

      <div class="grid gap-4 md:grid-cols-3">
        <div>
          <label class="label">Operador</label>
          <select v-model="selectedOperator" class="select w-full">
            <option value="">Todos Operadores</option>
            <option
              v-for="op in metrics?.byOperator || []"
              :key="op.operatorId"
              :value="op.operatorId"
            >
              {{ op.operatorName || 'Desconhecido' }}
            </option>
          </select>
        </div>

        <div>
          <label class="label">Tipo</label>
          <select v-model="selectedFinalizationType" class="select w-full">
            <option value="">Todos Tipos</option>
            <option value="gain">Ganhos</option>
            <option value="loss">Perdas</option>
          </select>
        </div>

        <div>
          <label class="label">Finalização</label>
          <select
            v-model="selectedFinalizationId"
            class="select w-full"
            :disabled="finalizationOptions.length === 0"
          >
            <option value="">Todas Finalizações</option>
            <option
              v-for="entry in finalizationOptions"
              :key="entry.finalizationId"
              :value="entry.finalizationId"
            >
              {{ entry.finalizationName || entry.finalizationId || 'Sem nome' }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <LoadingSpinner size="lg" />
    </div>

    <template v-else-if="metrics">
      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Total -->
        <div class="card card-body">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">Total Finalizadas</p>
              <p class="text-3xl font-bold text-gray-900">{{ metrics.total }}</p>
            </div>
            <div class="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <CheckCircle class="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <!-- Gains -->
        <div class="card card-body">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">Ganhos</p>
              <p class="text-3xl font-bold text-emerald-600">{{ metrics.gains }}</p>
            </div>
            <div class="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <TrendingUp class="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <div class="mt-2">
            <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                class="h-full bg-emerald-500 transition-all"
                :style="{ width: gainPercentage + '%' }"
              />
            </div>
            <p class="text-xs text-gray-500 mt-1">{{ gainPercentage }}% do total</p>
          </div>
        </div>

        <!-- Losses -->
        <div class="card card-body">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">Perdas</p>
              <p class="text-3xl font-bold text-red-600">{{ metrics.losses }}</p>
            </div>
            <div class="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
              <TrendingDown class="w-6 h-6 text-red-600" />
            </div>
          </div>
          <div class="mt-2">
            <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                class="h-full bg-red-500 transition-all"
                :style="{ width: lossPercentage + '%' }"
              />
            </div>
            <p class="text-xs text-gray-500 mt-1">{{ lossPercentage }}% do total</p>
          </div>
        </div>

        <!-- Top Performer -->
        <div class="card card-body">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">Melhor Operador</p>
              <p class="text-xl font-bold text-gray-900 truncate">
                {{ metrics.byOperator[0]?.operatorName || '-' }}
              </p>
            </div>
            <div class="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Award class="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <p v-if="metrics.byOperator[0]" class="text-sm text-gray-500 mt-1">
            {{ metrics.byOperator[0].total }} finalizações
          </p>
        </div>
      </div>

      <!-- Rankings -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- By Operator -->
        <div class="card">
          <div class="p-4 border-b border-gray-200">
            <h3 class="font-semibold text-gray-900 flex items-center gap-2">
              <Users class="w-5 h-5 text-gray-400" />
              Ranking por Operador
            </h3>
          </div>
          <div class="p-4 space-y-3">
            <div
              v-for="(op, idx) in metrics.byOperator.slice(0, 10)"
              :key="op.operatorId"
              class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
            >
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                :class="{
                  'bg-amber-100 text-amber-700': idx === 0,
                  'bg-gray-200 text-gray-600': idx > 0
                }"
              >
                {{ idx + 1 }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-medium text-gray-900 truncate">{{ op.operatorName }}</p>
                <div class="flex gap-3 text-xs">
                  <span class="text-emerald-600">{{ op.gains }} ganhos</span>
                  <span class="text-red-600">{{ op.losses }} perdas</span>
                </div>
              </div>
              <div class="text-right">
                <p class="font-bold text-gray-900">{{ op.total }}</p>
                <p class="text-xs text-gray-500">total</p>
              </div>
            </div>
            <p v-if="metrics.byOperator.length === 0" class="text-center text-gray-500 py-4">
              Nenhum dado disponível
            </p>
          </div>
        </div>

        <!-- By Finalization Type -->
        <div class="card">
          <div class="p-4 border-b border-gray-200">
            <h3 class="font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 class="w-5 h-5 text-gray-400" />
              Por Tipo de Finalização
            </h3>
          </div>
          <div class="p-4 space-y-3">
            <div
              v-for="ft in metrics.byFinalizationType"
              :key="ft.finalizationId"
              class="flex items-center gap-3 p-3 rounded-lg"
              :class="ft.finalizationType === 'gain' ? 'bg-emerald-50' : 'bg-red-50'"
            >
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center"
                :class="ft.finalizationType === 'gain' ? 'bg-emerald-100' : 'bg-red-100'"
              >
                <TrendingUp
                  v-if="ft.finalizationType === 'gain'"
                  class="w-5 h-5 text-emerald-600"
                />
                <TrendingDown v-else class="w-5 h-5 text-red-600" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-medium text-gray-900 truncate">{{ ft.finalizationName }}</p>
                <p class="text-xs text-gray-500">
                  {{ ft.finalizationType === 'gain' ? 'Ganho' : 'Perda' }}
                </p>
              </div>
              <div
                class="text-xl font-bold"
                :class="ft.finalizationType === 'gain' ? 'text-emerald-600' : 'text-red-600'"
              >
                {{ ft.count }}
              </div>
            </div>
            <p v-if="metrics.byFinalizationType.length === 0" class="text-center text-gray-500 py-4">
              Nenhum dado disponível
            </p>
          </div>
        </div>
      </div>

      <!-- Detailed Table -->
      <div class="card">
        <div class="p-4 border-b border-gray-200">
          <h3 class="font-semibold text-gray-900 flex items-center gap-2">
            <FileText class="w-5 h-5 text-gray-400" />
            Detalhamento de Finalizações
          </h3>
        </div>

        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Contato</th>
                <th>Operador</th>
                <th>Finalização</th>
                <th>Tipo</th>
                <th>Data</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in detailedList" :key="item.conversationId">
                <td>
                  <div>
                    <p class="font-medium">{{ item.name || 'Sem nome' }}</p>
                    <p class="text-xs text-gray-500">{{ item.identifier }}</p>
                  </div>
                </td>
                <td>{{ item.operatorName || '-' }}</td>
                <td>{{ formatFinalizationList(item) }}</td>
                <td>
                  <span
                    class="badge"
                    :class="item.finalizationType === 'gain' ? 'badge-success' : 'badge-danger'"
                  >
                    {{ item.finalizationType === 'gain' ? 'Ganho' : 'Perda' }}
                  </span>
                </td>
                <td class="text-sm whitespace-nowrap">{{ formatDateTime(item.finalizationAt) }}</td>
                <td class="max-w-xs truncate">{{ item.finalizationNotes || '-' }}</td>
              </tr>
              <tr v-if="detailedList.length === 0">
                <td colspan="6" class="text-center text-gray-500 py-8">
                  Nenhuma finalização encontrada para o período selecionado
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <Pagination
          v-if="pagination.totalPages > 1"
          :pagination="pagination"
          @page-change="handlePageChange"
          class="p-4 border-t border-gray-200"
        />
      </div>
    </template>
  </div>
</template>
