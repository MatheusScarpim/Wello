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
  MessageSquare,
  Send,
  Inbox,
  Clock,
  Eye
} from 'lucide-vue-next'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import Pagination from '@/components/ui/Pagination.vue'
import ConversationMessagesModal from '@/components/conversations/ConversationMessagesModal.vue'
import { finalizationMetricsApi, messageMetricsApi, messagesApi, conversationsApi } from '@/api'
import type {
  FinalizationMetrics,
  FinalizationDetail,
  FinalizationTypeSummary,
  MessageMetrics,
  MetricsPeriod,
  Pagination as PaginationType,
  Message,
  Conversation
} from '@/types'
import ExcelActions from '@/components/ui/ExcelActions.vue'

const isLoading = ref(true)
const finalizationMetrics = ref<FinalizationMetrics | null>(null)
const messageMetrics = ref<MessageMetrics | null>(null)
const detailedList = ref<FinalizationDetail[]>([])
const pagination = ref<PaginationType>({
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0
})

// Modal state
const showConversationModal = ref(false)
const selectedConversation = ref<Conversation | null>(null)
const selectedFinalization = ref<FinalizationDetail | null>(null)
const conversationMessages = ref<Message[]>([])
const loadingMessages = ref(false)

// Filters
const selectedPeriod = ref<MetricsPeriod>('week')
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

const finalizationOptions = computed<FinalizationTypeSummary[]>(() => {
  const list = finalizationMetrics.value?.byFinalizationType ?? []
  const seen = new Map<string, FinalizationTypeSummary>()
  list.forEach((entry) => {
    if (!entry.finalizationId) return
    if (!seen.has(entry.finalizationId)) {
      seen.set(entry.finalizationId, entry)
    }
  })
  return Array.from(seen.values())
})

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

    const [finalizationRes, messageRes, listRes] = await Promise.all([
      finalizationMetricsApi.getMetrics(params as {
        period: MetricsPeriod
        startDate?: string
        endDate?: string
        operatorId?: string
        finalizationType?: 'gain' | 'loss'
        finalizationId?: string
      }),
      messageMetricsApi.getMetrics(params as { period: MetricsPeriod; startDate?: string; endDate?: string }),
      finalizationMetricsApi.getDetailedList({
        period: selectedPeriod.value,
        startDate: selectedPeriod.value === 'custom' ? customStartDate.value : undefined,
        endDate: selectedPeriod.value === 'custom' ? customEndDate.value : undefined,
        page: pagination.value.page,
        limit: pagination.value.pageSize,
        operatorId: selectedOperator.value || undefined,
        finalizationType: selectedFinalizationType.value || undefined,
        finalizationId: selectedFinalizationId.value || undefined
      })
    ])

    if (finalizationRes?.data) {
      finalizationMetrics.value = finalizationRes.data
    }

    if (messageRes?.data) {
      messageMetrics.value = messageRes.data
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

function getFinalizationEntries(detail: FinalizationDetail) {
  if (detail.finalizations?.length) {
    return detail.finalizations
  }
  if (detail.finalizationId) {
    return [
      {
        finalizationId: detail.finalizationId,
        finalizationName: detail.finalizationName,
        finalizationType: detail.finalizationType,
      },
    ]
  }
  return []
}

function getPrimaryFinalization(detail: FinalizationDetail) {
  return getFinalizationEntries(detail)[0] ?? null
}

function getPrimaryFinalizationName(detail: FinalizationDetail) {
  const primary = getPrimaryFinalization(detail)
  return primary?.finalizationName || primary?.finalizationId || '-'
}

function getFinalizationTooltip(detail: FinalizationDetail) {
  const entries = getFinalizationEntries(detail)
  return entries
    .map((entry) => entry.finalizationName || entry.finalizationId || '-')
    .join(', ')
}

function getAdditionalFinalizationCount(detail: FinalizationDetail) {
  return Math.max(0, getFinalizationEntries(detail).length - 1)
}

function getAdditionalFinalizationTooltip(detail: FinalizationDetail) {
  const entries = getFinalizationEntries(detail).slice(1)
  return entries
    .map((entry) => entry.finalizationName || entry.finalizationId || '-')
    .join(', ')
}

function getFinalizationBadgeType(detail: FinalizationDetail) {
  return getPrimaryFinalization(detail)?.finalizationType ?? 'gain'
}

function getEntryBadgeClass(entry: { finalizationType?: 'gain' | 'loss' }) {
  return entry.finalizationType === 'loss'
    ? 'bg-red-50 text-red-700 border-red-100'
    : 'bg-emerald-50 text-emerald-700 border-emerald-100'
}

function getVisualFinalizations(detail: FinalizationDetail) {
  return getFinalizationEntries(detail).slice(0, 2)
}

function formatResponseTime(ms: number): string {
  if (ms === 0) return '-'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

function applyCustomPeriod() {
  if (customStartDate.value && customEndDate.value) {
    pagination.value.page = 1
    fetchMetrics()
  }
}

async function viewConversation(item: FinalizationDetail) {
  selectedFinalization.value = item
  showConversationModal.value = true
  loadingMessages.value = true

  try {
    const [convRes, msgsRes] = await Promise.all([
      conversationsApi.getById(item.conversationId),
      messagesApi.list({ conversationId: item.conversationId, limit: 100 })
    ])

    if (convRes?.data) {
      selectedConversation.value = convRes.data
    }

    if (msgsRes?.data?.items) {
      // Ordenar do mais antigo para o mais recente
      conversationMessages.value = [...msgsRes.data.items].reverse()
    }
  } catch (err) {
    console.error('Erro ao carregar conversa:', err)
  } finally {
    loadingMessages.value = false
  }
}

function closeModal() {
  showConversationModal.value = false
  selectedConversation.value = null
  selectedFinalization.value = null
  conversationMessages.value = []
}

// Computed para finalization info do modal
const modalFinalizationInfo = computed(() => {
  if (!selectedFinalization.value) return undefined
  return {
    type: selectedFinalization.value.finalizationType as 'gain' | 'loss',
    name: selectedFinalization.value.finalizationName || '',
    date: selectedFinalization.value.finalizationAt,
    notes: selectedFinalization.value.finalizationNotes,
    operatorName: selectedFinalization.value.operatorName
  }
})

// Computed para cálculo de porcentagem
const gainPercentage = computed(() => {
  if (!finalizationMetrics.value || finalizationMetrics.value.total === 0) return 0
  return Math.round((finalizationMetrics.value.gains / finalizationMetrics.value.total) * 100)
})

const lossPercentage = computed(() => {
  if (!finalizationMetrics.value || finalizationMetrics.value.total === 0) return 0
  return Math.round((finalizationMetrics.value.losses / finalizationMetrics.value.total) * 100)
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

// Excel handlers
const exportData = computed(() => {
  return detailedList.value.map(item => ({
    'ID Conversa': item.conversationId,
    Contato: item.contactName || item.identifier,
    Operador: item.operatorName || '-',
    Finalização: getPrimaryFinalizationName(item),
    Tipo: getFinalizationBadgeType(item) === 'gain' ? 'Ganho' : 'Perda',
    'Tempo de Resposta': formatResponseTime(item.responseTimeMs || 0),
    'Finalizado em': formatDateTime(item.finalizationAt),
    Notas: item.finalizationNotes || '',
  }))
})

async function handleImport(_data: any[]) {
  toast.info('Importação de métricas não é suportada. Os dados são gerados automaticamente.')
}

onMounted(fetchMetrics)
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Métricas</h1>
        <p class="text-gray-500">Visão geral de chats finalizados e mensagens</p>
      </div>
      <div class="flex flex-col sm:flex-row gap-2">
        <ExcelActions
          :data="exportData"
          :export-options="{
            filename: 'metricas.xlsx',
            sheetName: 'Métricas'
          }"
          :on-import="handleImport"
        />
        <button @click="fetchMetrics" class="btn-outline" :disabled="isLoading">
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
          Atualizar
        </button>
      </div>
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
              v-for="op in finalizationMetrics?.byOperator || []"
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

    <template v-else>
      <!-- ==================== SEÇÃO: CHATS FINALIZADOS ==================== -->
      <div class="space-y-6">
        <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <CheckCircle class="w-5 h-5 text-blue-500" />
          Chats Finalizados
        </h2>

        <template v-if="finalizationMetrics">
          <!-- Stats Cards -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Total -->
            <div class="card card-body">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-gray-500">Total Finalizadas</p>
                  <p class="text-3xl font-bold text-gray-900">{{ finalizationMetrics.total }}</p>
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
                  <p class="text-3xl font-bold text-emerald-600">{{ finalizationMetrics.gains }}</p>
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
                  <p class="text-3xl font-bold text-red-600">{{ finalizationMetrics.losses }}</p>
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
                    {{ finalizationMetrics.byOperator[0]?.operatorName || '-' }}
                  </p>
                </div>
                <div class="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Award class="w-6 h-6 text-amber-600" />
                </div>
              </div>
              <p v-if="finalizationMetrics.byOperator[0]" class="text-sm text-gray-500 mt-1">
                {{ finalizationMetrics.byOperator[0].total }} finalizações
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
              <div class="p-4 space-y-3 max-h-96 overflow-y-auto">
                <div
                  v-for="(op, idx) in finalizationMetrics.byOperator.slice(0, 10)"
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
                <p v-if="finalizationMetrics.byOperator.length === 0" class="text-center text-gray-500 py-4">
                  Nenhum dado disponível
                </p>
              </div>
            </div>

            <!-- By Finalization Type -->
            <div class="card">
              <div class="p-4 border-b border-gray-200">
                <h3 class="font-semibold text-gray-900 flex items-center gap-2">
                  <BarChart3 class="w-5 h-5 text-gray-400" />
                  Por Motivo de Finalização
                </h3>
              </div>
              <div class="p-4 space-y-3 max-h-96 overflow-y-auto">
                <div
                  v-for="ft in finalizationMetrics.byFinalizationType"
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
                <p v-if="finalizationMetrics.byFinalizationType.length === 0" class="text-center text-gray-500 py-4">
                  Nenhum dado disponível
                </p>
              </div>
            </div>
          </div>

          <!-- Detailed Table -->
          <div class="card">
            <div class="p-4 border-b border-gray-200 flex items-center gap-2">
              <h3 class="font-semibold text-gray-900 flex items-center gap-2">
                <FileText class="w-5 h-5 text-gray-400" />
                Lista de Chats Finalizados
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
                    <th class="w-20">Ações</th>
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
                    <td>
                      <div class="flex flex-wrap gap-2">
                        <span
                          v-for="entry in getVisualFinalizations(item)"
                          :key="entry.finalizationId || entry.finalizationName"
                          class="px-2 py-0.5 rounded-full text-xs font-medium shadow-sm border"
                          :class="getEntryBadgeClass(entry)"
                          :title="entry.finalizationName || entry.finalizationId || '-'"
                        >
                          {{ entry.finalizationName || entry.finalizationId || '-' }}
                        </span>
                        <div
                          v-if="getAdditionalFinalizationCount(item) > 0"
                          class="relative group/tags inline-flex"
                        >
                          <span
                            class="text-xs px-2 py-0.5 rounded-full border border-gray-200 bg-gray-100 text-gray-600"
                          >
                            +{{ getAdditionalFinalizationCount(item) }}
                          </span>
                          <div
                            class="absolute left-0 top-full mt-1 z-[100] hidden w-max min-w-[180px] flex-col gap-1 rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-lg group-hover/tags:flex"
                          >
                            <p class="text-xs font-semibold text-gray-500">Outras finalizações</p>
                            <div class="flex flex-wrap gap-1">
                              <span
                                v-for="entry in getFinalizationEntries(item).slice(1)"
                                :key="entry.finalizationId || entry.finalizationName"
                                class="px-2 py-0.5 rounded-full bg-gray-50 text-gray-600"
                              >
                                {{ entry.finalizationName || entry.finalizationId || '-' }}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        class="badge"
                        :class="getFinalizationBadgeType(item) === 'gain' ? 'badge-success' : 'badge-danger'"
                      >
                        {{ getFinalizationBadgeType(item) === 'gain' ? 'Ganho' : 'Perda' }}
                      </span>
                    </td>
                    <td class="text-sm whitespace-nowrap">{{ formatDateTime(item.finalizationAt) }}</td>
                    <td class="max-w-xs truncate">{{ item.finalizationNotes || '-' }}</td>
                    <td>
                      <button
                        @click="viewConversation(item)"
                        class="btn-ghost p-2 text-blue-600 hover:bg-blue-50"
                        title="Ver conversa"
                      >
                        <Eye class="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                  <tr v-if="detailedList.length === 0">
                    <td colspan="7" class="text-center text-gray-500 py-8">
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

      <!-- ==================== SEÇÃO: ESTATÍSTICAS DE MENSAGENS ==================== -->
      <div class="space-y-6 pt-6 border-t border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <MessageSquare class="w-5 h-5 text-purple-500" />
          Estatísticas de Mensagens
        </h2>

        <template v-if="messageMetrics">
          <!-- Message Stats Cards -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Total Messages -->
            <div class="card card-body">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-gray-500">Total de Mensagens</p>
                  <p class="text-3xl font-bold text-gray-900">{{ messageMetrics.overview.totalMessages.toLocaleString() }}</p>
                </div>
                <div class="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                  <MessageSquare class="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <!-- Sent -->
            <div class="card card-body">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-gray-500">Enviadas</p>
                  <p class="text-3xl font-bold text-blue-600">{{ messageMetrics.overview.totalSent.toLocaleString() }}</p>
                </div>
                <div class="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Send class="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <!-- Received -->
            <div class="card card-body">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-gray-500">Recebidas</p>
                  <p class="text-3xl font-bold text-violet-600">{{ messageMetrics.overview.totalReceived.toLocaleString() }}</p>
                </div>
                <div class="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Inbox class="w-6 h-6 text-violet-600" />
                </div>
              </div>
            </div>

            <!-- Avg Response Time -->
            <div class="card card-body">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-gray-500">Tempo Médio de Resposta</p>
                  <p class="text-2xl font-bold text-amber-600">
                    {{ formatResponseTime(messageMetrics.overview.avgResponseTimeMs) }}
                  </p>
                </div>
                <div class="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Clock class="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </div>
          </div>

          <!-- Messages by Operator -->
          <div class="card">
            <div class="p-4 border-b border-gray-200">
              <h3 class="font-semibold text-gray-900 flex items-center gap-2">
                <Users class="w-5 h-5 text-gray-400" />
                Mensagens por Operador
              </h3>
            </div>
            <div class="overflow-x-auto">
              <table class="table">
                <thead>
                  <tr>
                    <th>Operador</th>
                    <th class="text-right">Enviadas</th>
                    <th class="text-right">Recebidas</th>
                    <th class="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="op in messageMetrics.byOperator" :key="op.operatorId">
                    <td class="font-medium">{{ op.operatorName }}</td>
                    <td class="text-right text-blue-600">{{ op.sent.toLocaleString() }}</td>
                    <td class="text-right text-violet-600">{{ op.received.toLocaleString() }}</td>
                    <td class="text-right font-bold">{{ op.total.toLocaleString() }}</td>
                  </tr>
                  <tr v-if="messageMetrics.byOperator.length === 0">
                    <td colspan="4" class="text-center text-gray-500 py-8">
                      Nenhum dado disponível
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </div>
    </template>

    <!-- Modal de Detalhes da Conversa -->
    <ConversationMessagesModal
      :show="showConversationModal"
      :conversation="selectedConversation"
      :messages="conversationMessages"
      :loading="loadingMessages"
      :finalization-info="modalFinalizationInfo"
      @close="closeModal"
    />
  </div>
</template>
