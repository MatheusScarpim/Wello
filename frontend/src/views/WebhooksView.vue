<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { webhooksApi } from '@/api'
import {
  Webhook,
  Plus,
  Search,
  Edit2,
  Trash2,
  Play,
  Power,
  PowerOff,
  ExternalLink,
  Filter,
  X
} from 'lucide-vue-next'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Pagination from '@/components/ui/Pagination.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import WebhookFormModal from '@/components/webhooks/WebhookFormModal.vue'
import { useToast } from 'vue-toastification'
import type { Webhook as WebhookType, Pagination as PaginationType, WebhookStats } from '@/types'
import ExcelActions from '@/components/ui/ExcelActions.vue'

const toast = useToast()

const webhooks = ref<WebhookType[]>([])
const pagination = ref<PaginationType>({
  total: 0,
  page: 1,
  pageSize: 10,
  totalPages: 0
})
const stats = ref<WebhookStats | null>(null)
const availableEvents = ref<string[]>([])
const isLoading = ref(true)

// Filters
const search = ref('')
const enabledFilter = ref<string>('')

// Modals
const showFormModal = ref(false)
const editingWebhook = ref<WebhookType | null>(null)
const deleteConfirm = ref<WebhookType | null>(null)
const testingId = ref<string | null>(null)

const activeFiltersCount = computed(() => {
  let count = 0
  if (search.value) count++
  if (enabledFilter.value) count++
  return count
})

function clearWebhookFilters() {
  search.value = ''
  enabledFilter.value = ''
  fetchWebhooks()
}

async function fetchWebhooks() {
  isLoading.value = true
  try {
    const [webhooksRes, statsRes, eventsRes] = await Promise.all([
      webhooksApi.list({
        page: pagination.value.page,
        limit: pagination.value.pageSize,
        search: search.value || undefined,
        enabled: enabledFilter.value ? enabledFilter.value === 'true' : undefined
      }),
      webhooksApi.getStats(),
      webhooksApi.getEvents()
    ])

    if (webhooksRes.data) {
      webhooks.value = webhooksRes.data.items
      pagination.value = webhooksRes.data.pagination
    }
    if (statsRes.data) stats.value = statsRes.data
    if (eventsRes.data) availableEvents.value = (eventsRes.data as any).events || []
  } catch {
    toast.error('Erro ao carregar webhooks')
  } finally {
    isLoading.value = false
  }
}

async function toggleWebhook(webhook: WebhookType) {
  try {
    if (webhook.enabled) {
      await webhooksApi.disable(webhook._id)
    } else {
      await webhooksApi.enable(webhook._id)
    }
    toast.success(`Webhook ${webhook.enabled ? 'desativado' : 'ativado'}`)
    fetchWebhooks()
  } catch {
    toast.error('Erro ao alterar status do webhook')
  }
}

async function testWebhook(webhook: WebhookType) {
  testingId.value = webhook._id
  try {
    const response = await webhooksApi.test(webhook._id)
    if (response.data?.success) {
      toast.success('Webhook testado com sucesso')
    } else {
      toast.warning('Webhook testado, mas retornou erro')
    }
  } catch {
    toast.error('Erro ao testar webhook')
  } finally {
    testingId.value = null
  }
}

async function deleteWebhook() {
  if (!deleteConfirm.value) return
  try {
    await webhooksApi.delete(deleteConfirm.value._id)
    toast.success('Webhook excluído')
    deleteConfirm.value = null
    fetchWebhooks()
  } catch {
    toast.error('Erro ao excluir webhook')
  }
}

function openEdit(webhook: WebhookType) {
  editingWebhook.value = webhook
  showFormModal.value = true
}

function openCreate() {
  editingWebhook.value = null
  showFormModal.value = true
}

function handlePageChange(page: number) {
  pagination.value.page = page
  fetchWebhooks()
}

// Excel handlers
const exportData = computed(() => {
  return webhooks.value.map(webhook => ({
    Nome: webhook.name,
    URL: webhook.url,
    Eventos: webhook.events.join(', '),
    Status: webhook.enabled ? 'Ativo' : 'Inativo',
    'Total Enviados': webhook.totalSent || 0,
    'Total Sucesso': webhook.totalSuccess || 0,
    'Total Falhas': webhook.totalFailed || 0,
    'Criado em': webhook.createdAt ? new Date(webhook.createdAt).toLocaleString('pt-BR') : '',
  }))
})

async function handleImport(data: any[]) {
  toast.info('Importação de webhooks não é suportada por questões de segurança. Por favor, adicione manualmente.')
}

onMounted(fetchWebhooks)
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Webhooks</h1>
        <p class="text-gray-500">Configure endpoints para receber eventos</p>
      </div>
      <div class="flex flex-col sm:flex-row gap-2">
        <ExcelActions
          :data="exportData"
          :export-options="{
            filename: 'webhooks.xlsx',
            sheetName: 'Webhooks'
          }"
          :on-import="handleImport"
        />
        <button @click="openCreate" class="btn-primary">
          <Plus class="w-4 h-4" />
          Novo Webhook
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="card card-body">
        <p class="text-sm text-gray-500">Total de Webhooks</p>
        <p class="text-2xl font-bold text-gray-900">{{ pagination.total }}</p>
      </div>
      <div class="card card-body">
        <p class="text-sm text-gray-500">Enviados</p>
        <p class="text-2xl font-bold text-green-600">{{ stats?.totalSent || 0 }}</p>
      </div>
      <div class="card card-body">
        <p class="text-sm text-gray-500">Falhas</p>
        <p class="text-2xl font-bold text-red-600">{{ stats?.totalFailed || 0 }}</p>
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
          @click="clearWebhookFilters"
          class="text-xs text-gray-500 hover:text-primary-600 flex items-center gap-1 transition-colors"
        >
          <X class="w-3.5 h-3.5" />
          Limpar filtros
        </button>
      </div>
      <div class="p-5">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="lg:col-span-2">
            <label class="label">Buscar</label>
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                v-model="search"
                @input="fetchWebhooks"
                type="text"
                placeholder="Buscar webhooks..."
                class="input pl-10"
              />
            </div>
          </div>
          <div>
            <label class="label">Status</label>
            <select v-model="enabledFilter" @change="fetchWebhooks" class="select">
              <option value="">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
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
      v-else-if="webhooks.length === 0"
      title="Nenhum webhook encontrado"
      description="Configure um webhook para receber notificações de eventos."
    >
      <template #icon>
        <Webhook class="w-8 h-8 text-gray-400" />
      </template>
      <template #action>
        <button @click="openCreate" class="btn-primary">
          <Plus class="w-4 h-4" />
          Criar Webhook
        </button>
      </template>
    </EmptyState>

    <!-- Webhooks List -->
    <template v-else>
      <div class="card overflow-hidden">
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>URL</th>
                <th>Eventos</th>
                <th>Status</th>
                <th class="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="webhook in webhooks" :key="webhook._id">
                <td class="font-medium text-gray-900">{{ webhook.name }}</td>
                <td>
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-sm text-gray-600 truncate max-w-[200px]">
                      {{ webhook.url }}
                    </span>
                    <a
                      :href="webhook.url"
                      target="_blank"
                      class="text-gray-400 hover:text-gray-600"
                    >
                      <ExternalLink class="w-4 h-4" />
                    </a>
                  </div>
                </td>
                <td>
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="event in webhook.events.slice(0, 2)"
                      :key="event"
                      class="badge badge-info"
                    >
                      {{ event }}
                    </span>
                    <span v-if="webhook.events.length > 2" class="badge badge-neutral">
                      +{{ webhook.events.length - 2 }}
                    </span>
                  </div>
                </td>
                <td>
                  <span :class="webhook.enabled ? 'badge-success' : 'badge-neutral'">
                    {{ webhook.enabled ? 'Ativo' : 'Inativo' }}
                  </span>
                </td>
                <td>
                  <div class="flex items-center justify-end gap-1">
                    <button
                      @click="testWebhook(webhook)"
                      :disabled="testingId === webhook._id"
                      class="btn-ghost btn-sm"
                      title="Testar"
                    >
                      <Play
                        class="w-4 h-4"
                        :class="{ 'animate-pulse': testingId === webhook._id }"
                      />
                    </button>
                    <button
                      @click="toggleWebhook(webhook)"
                      class="btn-ghost btn-sm"
                      :title="webhook.enabled ? 'Desativar' : 'Ativar'"
                    >
                      <component
                        :is="webhook.enabled ? PowerOff : Power"
                        class="w-4 h-4"
                      />
                    </button>
                    <button
                      @click="openEdit(webhook)"
                      class="btn-ghost btn-sm"
                      title="Editar"
                    >
                      <Edit2 class="w-4 h-4" />
                    </button>
                    <button
                      @click="deleteConfirm = webhook"
                      class="btn-ghost btn-sm text-red-600"
                      title="Excluir"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
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
    <WebhookFormModal
      v-if="showFormModal"
      :webhook="editingWebhook"
      :available-events="availableEvents"
      @close="showFormModal = false"
      @saved="fetchWebhooks"
    />

    <!-- Delete Confirm -->
    <Teleport to="body">
      <ConfirmModal
        v-if="deleteConfirm"
        title="Excluir webhook"
        :message="`Tem certeza que deseja excluir o webhook '${deleteConfirm.name}'?`"
        variant="danger"
        @confirm="deleteWebhook"
        @cancel="deleteConfirm = null"
      />
    </Teleport>
  </div>
</template>
