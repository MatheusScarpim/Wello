<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import { ArrowLeft, Play, Pause, Square, Download, Users, Send, CheckCircle, XCircle, Eye, Clock } from 'lucide-vue-next'
import { campaignsApi } from '@/api'
import Pagination from '@/components/ui/Pagination.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'

const router = useRouter()
const route = useRoute()
const toast = useToast()

const campaignId = computed(() => route.params.id as string)
const campaign = ref<any>(null)
const metrics = ref<any>({ total: 0, sent: 0, delivered: 0, read: 0, failed: 0, pending: 0 })
const contacts = ref<any[]>([])
const loading = ref(true)
const contactsPagination = ref({ total: 0, page: 1, pageSize: 20, totalPages: 1 })
const contactFilterStatus = ref('')
const refreshInterval = ref<number | null>(null)

const showCancelModal = ref(false)

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: 'bg-gray-100 text-gray-700' },
  scheduled: { label: 'Agendada', color: 'bg-blue-100 text-blue-700' },
  running: { label: 'Em execução', color: 'bg-green-100 text-green-700' },
  paused: { label: 'Pausada', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Concluída', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700' },
  failed: { label: 'Falhou', color: 'bg-red-100 text-red-700' },
}

const progressPercent = computed(() => {
  if (!metrics.value.total) return 0
  return Math.round((metrics.value.sent + metrics.value.failed) / metrics.value.total * 100)
})

const metricCards = computed(() => [
  { label: 'Total', value: metrics.value.total, icon: Users, color: 'text-gray-600' },
  { label: 'Enviados', value: metrics.value.sent, icon: Send, color: 'text-blue-600' },
  { label: 'Entregues', value: metrics.value.delivered, icon: CheckCircle, color: 'text-green-600' },
  { label: 'Lidos', value: metrics.value.read, icon: Eye, color: 'text-purple-600' },
  { label: 'Falhos', value: metrics.value.failed, icon: XCircle, color: 'text-red-600' },
  { label: 'Pendentes', value: metrics.value.pending, icon: Clock, color: 'text-yellow-600' },
])

async function fetchCampaign() {
  try {
    const res = await campaignsApi.getById(campaignId.value)
    const data = (res as any).data
    campaign.value = data
    if (data?.metrics) metrics.value = data.metrics
  } catch {
    toast.error('Erro ao carregar campanha')
  } finally {
    loading.value = false
  }
}

async function fetchMetrics() {
  try {
    const res = await campaignsApi.getMetrics(campaignId.value)
    const data = (res as any).data
    if (data) metrics.value = data
  } catch { /* ignore */ }
}

async function fetchContacts() {
  try {
    const params: any = { page: contactsPagination.value.page, limit: contactsPagination.value.pageSize }
    if (contactFilterStatus.value) params.status = contactFilterStatus.value

    const res = await campaignsApi.getContacts(campaignId.value, params)
    const data = (res as any).data || {}
    contacts.value = data.data || []
    contactsPagination.value = {
      total: data.total || 0,
      page: data.page || 1,
      pageSize: data.pageSize || 20,
      totalPages: data.totalPages || 1,
    }
  } catch { /* ignore */ }
}

async function startCampaign() {
  try {
    await campaignsApi.start(campaignId.value)
    toast.success('Campanha iniciada!')
    fetchCampaign()
  } catch (e: any) {
    toast.error(e?.response?.data?.error || 'Erro ao iniciar')
  }
}

async function pauseCampaign() {
  try {
    await campaignsApi.pause(campaignId.value)
    toast.success('Campanha pausada')
    fetchCampaign()
  } catch {
    toast.error('Erro ao pausar')
  }
}

async function resumeCampaign() {
  try {
    await campaignsApi.resume(campaignId.value)
    toast.success('Campanha retomada')
    fetchCampaign()
  } catch {
    toast.error('Erro ao retomar')
  }
}

async function cancelCampaign() {
  try {
    await campaignsApi.cancel(campaignId.value)
    toast.success('Campanha cancelada')
    showCancelModal.value = false
    fetchCampaign()
  } catch {
    toast.error('Erro ao cancelar')
  }
}

async function exportContacts() {
  try {
    await campaignsApi.exportContacts(campaignId.value)
    toast.success('Exportação iniciada')
  } catch {
    toast.error('Erro ao exportar')
  }
}

function onContactsPageChange(page: number) {
  contactsPagination.value.page = page
  fetchContacts()
}

function onContactFilterChange() {
  contactsPagination.value.page = 1
  fetchContacts()
}

const contactStatusBadge = (status: string) => {
  const map: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-700',
    delivered: 'bg-green-100 text-green-700',
    read: 'bg-purple-100 text-purple-700',
    failed: 'bg-red-100 text-red-700',
  }
  return map[status] || 'bg-gray-100 text-gray-700'
}

const contactStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    pending: 'Pendente',
    sent: 'Enviado',
    delivered: 'Entregue',
    read: 'Lido',
    failed: 'Falhou',
  }
  return map[status] || status
}

// Socket.IO progress
function handleProgress(e: Event) {
  const detail = (e as CustomEvent).detail
  if (detail?.campaignId === campaignId.value) {
    metrics.value = { ...metrics.value, ...detail }
  }
}

function handleCampaignUpdate(e: Event) {
  const detail = (e as CustomEvent).detail
  if (detail?.campaignId === campaignId.value) {
    fetchCampaign()
  }
}

onMounted(async () => {
  await fetchCampaign()
  await fetchContacts()

  // Auto-refresh for running campaigns
  refreshInterval.value = window.setInterval(() => {
    if (campaign.value?.status === 'running') {
      fetchMetrics()
      fetchContacts()
    }
  }, 5000)

  window.addEventListener('ws:campaign-progress', handleProgress)
  window.addEventListener('ws:campaign-updated', handleCampaignUpdate)
})

onUnmounted(() => {
  if (refreshInterval.value) clearInterval(refreshInterval.value)
  window.removeEventListener('ws:campaign-progress', handleProgress)
  window.removeEventListener('ws:campaign-updated', handleCampaignUpdate)
})
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <template v-else-if="campaign">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div class="flex items-center gap-3">
          <button @click="router.push('/campaigns')" class="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft class="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-2xl font-bold text-gray-900">{{ campaign.name }}</h1>
              <span :class="statusConfig[campaign.status]?.color" class="px-2.5 py-0.5 text-xs font-medium rounded-full">
                {{ statusConfig[campaign.status]?.label }}
              </span>
              <span :class="campaign.type === 'official' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'" class="px-2 py-0.5 text-xs font-medium rounded-full">
                {{ campaign.type === 'official' ? 'Oficial' : 'Não-oficial' }}
              </span>
            </div>
            <p v-if="campaign.description" class="text-sm text-gray-500">{{ campaign.description }}</p>
          </div>
        </div>

        <div class="flex gap-2">
          <button
            v-if="['draft', 'scheduled'].includes(campaign.status)"
            @click="startCampaign"
            class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
          >
            <Play class="w-4 h-4" />
            Iniciar
          </button>
          <button
            v-if="campaign.status === 'running'"
            @click="pauseCampaign"
            class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700"
          >
            <Pause class="w-4 h-4" />
            Pausar
          </button>
          <button
            v-if="campaign.status === 'paused'"
            @click="resumeCampaign"
            class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
          >
            <Play class="w-4 h-4" />
            Retomar
          </button>
          <button
            v-if="['running', 'paused', 'scheduled'].includes(campaign.status)"
            @click="showCancelModal = true"
            class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
          >
            <Square class="w-4 h-4" />
            Cancelar
          </button>
          <button
            @click="exportContacts"
            class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download class="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      <!-- Progress bar -->
      <div v-if="['running', 'paused', 'completed'].includes(campaign.status)" class="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div class="flex items-center justify-between text-sm mb-2">
          <span class="text-gray-600">Progresso geral</span>
          <span class="font-medium">{{ progressPercent }}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-3">
          <div
            class="h-3 rounded-full transition-all duration-500"
            :class="campaign.status === 'running' ? 'bg-green-500' : 'bg-primary-600'"
            :style="{ width: progressPercent + '%' }"
          ></div>
        </div>
        <div class="flex justify-between text-xs text-gray-400 mt-1">
          <span>{{ metrics.sent + metrics.failed }} de {{ metrics.total }}</span>
          <span v-if="campaign.status === 'running'" class="text-green-600 font-medium animate-pulse">Enviando...</span>
        </div>
      </div>

      <!-- Metrics -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div v-for="m in metricCards" :key="m.label" class="bg-white rounded-xl border border-gray-200 p-4">
          <div class="flex items-center gap-2 mb-1">
            <component :is="m.icon" class="w-4 h-4" :class="m.color" />
            <span class="text-xs text-gray-500">{{ m.label }}</span>
          </div>
          <p class="text-xl font-bold" :class="m.color">{{ m.value }}</p>
        </div>
      </div>

      <!-- Contacts Table -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 class="font-semibold text-gray-900">Contatos</h3>
          <select v-model="contactFilterStatus" @change="onContactFilterChange" class="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
            <option value="">Todos</option>
            <option value="pending">Pendente</option>
            <option value="sent">Enviado</option>
            <option value="delivered">Entregue</option>
            <option value="read">Lido</option>
            <option value="failed">Falhou</option>
          </select>
        </div>

        <table class="w-full">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nome</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Telefone</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Enviado em</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Erro</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="contact in contacts" :key="contact._id" class="hover:bg-gray-50">
              <td class="px-4 py-3 text-sm text-gray-900">{{ contact.name || '-' }}</td>
              <td class="px-4 py-3 text-sm text-gray-600 font-mono">{{ contact.phone }}</td>
              <td class="px-4 py-3">
                <span :class="contactStatusBadge(contact.status)" class="px-2 py-0.5 text-xs font-medium rounded-full">
                  {{ contactStatusLabel(contact.status) }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-500">{{ contact.sentAt ? new Date(contact.sentAt).toLocaleString('pt-BR') : '-' }}</td>
              <td class="px-4 py-3 text-sm text-red-500">{{ contact.errorMessage || '-' }}</td>
            </tr>
            <tr v-if="contacts.length === 0">
              <td colspan="5" class="px-4 py-8 text-center text-sm text-gray-400">Nenhum contato encontrado</td>
            </tr>
          </tbody>
        </table>

        <div v-if="contactsPagination.totalPages > 1" class="p-4 border-t border-gray-200">
          <Pagination
            :total="contactsPagination.total"
            :page="contactsPagination.page"
            :page-size="contactsPagination.pageSize"
            :total-pages="contactsPagination.totalPages"
            @page-change="onContactsPageChange"
          />
        </div>
      </div>
    </template>

    <!-- Cancel Confirm -->
    <ConfirmModal
      v-if="showCancelModal"
      title="Cancelar Campanha"
      message="Tem certeza que deseja cancelar esta campanha? Os envios pendentes não serão realizados."
      confirm-text="Cancelar Campanha"
      variant="danger"
      @confirm="cancelCampaign"
      @cancel="showCancelModal = false"
    />
  </div>
</template>
