<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { expensesApi } from '@/api'
import {
  Receipt,
  Plus,
  Search,
  Edit2,
  Calendar,
  DollarSign,
  FileSpreadsheet,
  Building,
  Filter,
  X
} from 'lucide-vue-next'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Pagination from '@/components/ui/Pagination.vue'
import ExpenseFormModal from '@/components/expenses/ExpenseFormModal.vue'
import { useToast } from 'vue-toastification'
import { format } from 'date-fns'
import type { Expense, Pagination as PaginationType, WeeklySheet } from '@/types'
import ExcelActions from '@/components/ui/ExcelActions.vue'

const toast = useToast()

const expenses = ref<Expense[]>([])
const clients = ref<string[]>([])
const pagination = ref<PaginationType>({
  total: 0,
  page: 1,
  pageSize: 10,
  totalPages: 0
})
const weeklySheet = ref<WeeklySheet | null>(null)
const isLoading = ref(true)

// Filters
const search = ref('')
const clientFilter = ref('')
const weeklyDate = ref(format(new Date(), 'yyyy-MM-dd'))

// Modals
const showFormModal = ref(false)
const editingExpense = ref<Expense | null>(null)
const showWeeklySheet = ref(false)

const activeFiltersCount = computed(() => {
  let count = 0
  if (search.value) count++
  if (clientFilter.value) count++
  return count
})

function clearExpenseFilters() {
  search.value = ''
  clientFilter.value = ''
  fetchExpenses()
}

const totalValue = computed(() => {
  return expenses.value.reduce((sum, exp) => sum + exp.valor, 0)
})

async function fetchExpenses() {
  isLoading.value = true
  try {
    const [expensesRes, clientsRes] = await Promise.all([
      expensesApi.list({
        page: pagination.value.page,
        limit: pagination.value.pageSize,
        search: search.value || undefined,
        cliente: clientFilter.value || undefined
      }),
      expensesApi.getClients()
    ])

    if (expensesRes.data) {
      expenses.value = expensesRes.data.items
      pagination.value = expensesRes.data.pagination
    }
    if (clientsRes.data) {
      clients.value = clientsRes.data as unknown as string[]
    }
  } catch {
    toast.error('Erro ao carregar despesas')
  } finally {
    isLoading.value = false
  }
}

async function fetchWeeklySheet() {
  try {
    const response = await expensesApi.getWeeklySheet(
      clientFilter.value || undefined,
      weeklyDate.value
    )
    if (response.data) {
      weeklySheet.value = response.data
      showWeeklySheet.value = true
    }
  } catch {
    toast.error('Erro ao carregar planilha semanal')
  }
}

function openEdit(expense: Expense) {
  editingExpense.value = expense
  showFormModal.value = true
}

function openCreate() {
  editingExpense.value = null
  showFormModal.value = true
}

function handlePageChange(page: number) {
  pagination.value.page = page
  fetchExpenses()
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

function formatDate(date?: string) {
  if (!date) return '-'
  return format(new Date(date), 'dd/MM/yyyy')
}

// Excel handlers
const exportData = computed(() => {
  return expenses.value.map(exp => ({
    Descrição: exp.descricao,
    Cliente: exp.cliente,
    Valor: exp.valor,
    Data: formatDate(exp.data),
    Categoria: exp.categoria || '',
    'Criado em': exp.createdAt ? new Date(exp.createdAt).toLocaleString('pt-BR') : '',
  }))
})

async function handleImport(data: any[]) {
  const validExpenses = data.filter(row => row.Descrição || row.descricao)

  if (validExpenses.length === 0) {
    toast.error('Nenhuma despesa válida encontrada no arquivo')
    return
  }

  let created = 0
  let failed = 0

  for (const row of validExpenses) {
    try {
      const descricao = row.Descrição || row.descricao
      const cliente = row.Cliente || row.cliente || ''
      const valor = parseFloat(String(row.Valor || row.valor || 0).replace(/[^\d,-]/g, '').replace(',', '.'))
      const dataStr = row.Data || row.data
      let data = new Date().toISOString()

      if (dataStr) {
        const [day, month, year] = dataStr.split('/')
        if (day && month && year) {
          data = new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toISOString()
        }
      }

      await expensesApi.create({
        descricao,
        cliente,
        valor,
        data,
        categoria: row.Categoria || row.categoria || ''
      })
      created++
    } catch (error) {
      console.error('Erro ao criar despesa:', error)
      failed++
    }
  }

  if (created > 0) {
    toast.success(`${created} despesa(s) importada(s) com sucesso!`)
    fetchExpenses()
  }

  if (failed > 0) {
    toast.warning(`${failed} despesa(s) falharam ao importar`)
  }
}

onMounted(fetchExpenses)
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Despesas</h1>
        <p class="text-gray-500">Controle de despesas e gastos</p>
      </div>
      <div class="flex flex-col sm:flex-row gap-2">
        <ExcelActions
          :data="exportData"
          :export-options="{
            filename: 'despesas.xlsx',
            sheetName: 'Despesas'
          }"
          :on-import="handleImport"
        />
        <button @click="fetchWeeklySheet" class="btn-outline">
          <FileSpreadsheet class="w-4 h-4" />
          Planilha Semanal
        </button>
        <button @click="openCreate" class="btn-primary">
          <Plus class="w-4 h-4" />
          Nova Despesa
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="card card-body">
        <p class="text-sm text-gray-500">Total de Despesas</p>
        <p class="text-2xl font-bold text-gray-900">{{ pagination.total }}</p>
      </div>
      <div class="card card-body">
        <p class="text-sm text-gray-500">Valor Total (página)</p>
        <p class="text-2xl font-bold text-primary-600">{{ formatCurrency(totalValue) }}</p>
      </div>
      <div class="card card-body">
        <p class="text-sm text-gray-500">Clientes</p>
        <p class="text-2xl font-bold text-gray-900">{{ clients.length }}</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="card overflow-hidden">
      <div class="flex items-center justify-between px-5 py-3 bg-gray-50/80 border-b border-gray-100">
        <div class="flex items-center gap-2 text-gray-600">
          <Filter class="w-4 h-4" />
          <span class="text-sm font-semibold">Filtros</span>
          <span
            v-if="activeFiltersCount > 0"
            class="ml-1 w-5 h-5 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center"
          >
            {{ activeFiltersCount }}
          </span>
        </div>
        <button
          v-if="activeFiltersCount > 0"
          @click="clearExpenseFilters"
          class="text-xs text-gray-500 hover:text-primary-600 flex items-center gap-1 transition-colors"
        >
          <X class="w-3.5 h-3.5" />
          Limpar filtros
        </button>
      </div>
      <div class="p-5">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="sm:col-span-2">
            <label class="label">Buscar</label>
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                v-model="search"
                @input="fetchExpenses"
                type="text"
                placeholder="Buscar despesas..."
                class="input pl-10"
              />
            </div>
          </div>
          <div>
            <label class="label">Cliente</label>
            <select v-model="clientFilter" @change="fetchExpenses" class="select">
              <option value="">Todos os clientes</option>
              <option v-for="client in clients" :key="client" :value="client">
                {{ client }}
              </option>
            </select>
          </div>
          <div>
            <label class="label">Data referência</label>
            <input
              v-model="weeklyDate"
              type="date"
              class="input"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <LoadingSpinner size="lg" />
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else-if="expenses.length === 0"
      title="Nenhuma despesa encontrada"
      description="Cadastre uma nova despesa para começar."
    >
      <template #icon>
        <Receipt class="w-8 h-8 text-gray-400" />
      </template>
      <template #action>
        <button @click="openCreate" class="btn-primary">
          <Plus class="w-4 h-4" />
          Nova Despesa
        </button>
      </template>
    </EmptyState>

    <!-- Expenses List -->
    <template v-else>
      <div class="card overflow-hidden">
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Cliente / Obra</th>
                <th>Tipo</th>
                <th>Vencimento</th>
                <th>Valor</th>
                <th class="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="expense in expenses" :key="expense._id">
                <td>
                  <div>
                    <p class="font-medium text-gray-900">{{ expense.descricao }}</p>
                    <p v-if="expense.documentoVinculado" class="text-xs text-gray-500">
                      Doc: {{ expense.documentoVinculado }}
                    </p>
                  </div>
                </td>
                <td>
                  <div class="flex items-center gap-2">
                    <Building class="w-4 h-4 text-gray-400" />
                    <div>
                      <p class="text-gray-900">{{ expense.cliente }}</p>
                      <p class="text-xs text-gray-500">{{ expense.obra }}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="badge badge-info">{{ expense.tipoDespesa }}</span>
                </td>
                <td>
                  <div class="flex items-center gap-1 text-gray-600">
                    <Calendar class="w-4 h-4" />
                    {{ formatDate(expense.dataVencimento) }}
                  </div>
                </td>
                <td>
                  <div class="flex items-center gap-1 font-semibold text-gray-900">
                    <DollarSign class="w-4 h-4 text-green-600" />
                    {{ formatCurrency(expense.valor) }}
                  </div>
                </td>
                <td class="text-right">
                  <button
                    @click="openEdit(expense)"
                    class="btn-ghost btn-sm"
                    title="Editar"
                  >
                    <Edit2 class="w-4 h-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        v-if="pagination.totalPages > 1"
        :pagination="pagination"
        @page-change="handlePageChange"
      />
    </template>

    <!-- Form Modal -->
    <ExpenseFormModal
      v-if="showFormModal"
      :expense="editingExpense"
      :clients="clients"
      @close="showFormModal = false"
      @saved="fetchExpenses"
    />

    <!-- Weekly Sheet Modal -->
    <Teleport to="body">
      <div
        v-if="showWeeklySheet && weeklySheet"
        class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <div class="p-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">Planilha Semanal</h2>
            <p class="text-sm text-gray-500">
              {{ formatDate(weeklySheet.periodo.inicio) }} - {{ formatDate(weeklySheet.periodo.fim) }}
            </p>
          </div>

          <div class="flex-1 overflow-y-auto p-4">
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div class="card card-body">
                <p class="text-sm text-gray-500">Total de Itens</p>
                <p class="text-2xl font-bold text-gray-900">{{ weeklySheet.totalItens }}</p>
              </div>
              <div class="card card-body">
                <p class="text-sm text-gray-500">Valor Total</p>
                <p class="text-2xl font-bold text-primary-600">
                  {{ formatCurrency(weeklySheet.totalValor) }}
                </p>
              </div>
            </div>

            <div v-if="weeklySheet.itens.length > 0" class="space-y-2">
              <div
                v-for="item in weeklySheet.itens"
                :key="item._id"
                class="p-3 bg-gray-50 rounded-lg flex justify-between items-center"
              >
                <div>
                  <p class="font-medium text-gray-900">{{ item.descricao }}</p>
                  <p class="text-xs text-gray-500">{{ item.cliente }} - {{ item.obra }}</p>
                </div>
                <p class="font-semibold text-gray-900">{{ formatCurrency(item.valor) }}</p>
              </div>
            </div>

            <EmptyState
              v-else
              title="Nenhuma despesa no período"
              description="Não há despesas registradas para esta semana."
            />
          </div>

          <div class="p-4 border-t border-gray-200">
            <button @click="showWeeklySheet = false" class="btn-secondary w-full">
              Fechar
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
