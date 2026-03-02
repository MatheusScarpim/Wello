<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { Send, Plus, Eye, Copy, Trash2, Search, Filter, FileText, CheckCircle, Clock, PlayCircle, PauseCircle, XCircle } from 'lucide-vue-next'
import { campaignsApi } from '@/api'
import Pagination from '@/components/ui/Pagination.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const router = useRouter()
const toast = useToast()

const campaigns = ref<any[]>([])
const loading = ref(false)
const pagination = ref({ total: 0, page: 1, pageSize: 10, totalPages: 1 })

const searchQuery = ref('')
const filterStatus = ref('')
const filterType = ref('')

const showDeleteModal = ref(false)
const targetCampaign = ref<any>(null)

// Stats
const stats = computed(() => {
  const all = campaigns.value
  return {
    total: pagination.value.total,
    running: all.filter((c: any) => c.status === 'running').length,
    scheduled: all.filter((c: any) => c.status === 'scheduled').length,
    completed: all.filter((c: any) => c.status === 'completed').length,
  }
})

const statusConfig: Record<string, { label: string; badge: string; icon: any }> = {
  draft: { label: 'Rascunho', badge: 'bg-gray-100 text-gray-700', icon: FileText },
  scheduled: { label: 'Agendada', badge: 'bg-blue-100 text-blue-700', icon: Clock },
  running: { label: 'Em execução', badge: 'bg-green-100 text-green-700', icon: PlayCircle },
  paused: { label: 'Pausada', badge: 'bg-yellow-100 text-yellow-700', icon: PauseCircle },
  completed: { label: 'Concluída', badge: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelada', badge: 'bg-red-100 text-red-700', icon: XCircle },
  failed: { label: 'Falhou', badge: 'bg-red-100 text-red-700', icon: XCircle },
}

async function fetchCampaigns() {
  loading.value = true
  try {
    const params: any = { page: pagination.value.page, limit: pagination.value.pageSize }
    if (filterStatus.value) params.status = filterStatus.value
    if (filterType.value) params.type = filterType.value

    const res = await campaignsApi.list(params)
    const data = (res as any).data || {}
    campaigns.value = data.data || []
    pagination.value = {
      total: data.total || 0,
      page: data.page || 1,
      pageSize: data.pageSize || 10,
      totalPages: data.totalPages || 1,
    }
  } catch {
    toast.error('Erro ao carregar campanhas')
  } finally {
    loading.value = false
  }
}

async function duplicateCampaign(id: string) {
  try {
    await campaignsApi.duplicate(id)
    toast.success('Campanha duplicada')
    fetchCampaigns()
  } catch {
    toast.error('Erro ao duplicar')
  }
}

async function confirmDelete() {
  if (!targetCampaign.value) return
  try {
    await campaignsApi.delete(targetCampaign.value._id)
    toast.success('Campanha removida')
    showDeleteModal.value = false
    fetchCampaigns()
  } catch {
    toast.error('Erro ao remover')
  }
}

function progressPercent(c: any) {
  if (!c.totalContacts || c.totalContacts === 0) return 0
  return Math.round(((c.sent || 0) + (c.failed || 0)) / c.totalContacts * 100)
}

function onPageChange(page: number) {
  pagination.value.page = page
  fetchCampaigns()
}

const filteredCampaigns = computed(() => {
  if (!searchQuery.value) return campaigns.value
  const q = searchQuery.value.toLowerCase()
  return campaigns.value.filter((c: any) => c.name?.toLowerCase().includes(q))
})

// Socket.IO events
function handleCampaignUpdate(e: Event) {
  fetchCampaigns()
}

onMounted(() => {
  fetchCampaigns()
  window.addEventListener('ws:campaign-updated', handleCampaignUpdate)
})

onUnmounted(() => {
  window.removeEventListener('ws:campaign-updated', handleCampaignUpdate)
})
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Campanhas</h1>
        <p class="text-sm text-gray-500 mt-1">Gerencie e dispare campanhas para seus contatos</p>
      </div>
      <button
        @click="router.push('/campaigns/new')"
        class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
      >
        <Plus class="w-4 h-4" />
        Nova Campanha
      </button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <p class="text-sm text-gray-500">Total</p>
        <p class="text-2xl font-bold text-gray-900">{{ stats.total }}</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <p class="text-sm text-gray-500">Em execução</p>
        <p class="text-2xl font-bold text-green-600">{{ stats.running }}</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <p class="text-sm text-gray-500">Agendadas</p>
        <p class="text-2xl font-bold text-blue-600">{{ stats.scheduled }}</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <p class="text-sm text-gray-500">Concluídas</p>
        <p class="text-2xl font-bold text-gray-600">{{ stats.completed }}</p>
      </div>
    </div>

    <!-- Filtros -->
    <div class="flex flex-wrap gap-3 mb-6">
      <div class="relative flex-1 min-w-[200px]">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input v-model="searchQuery" type="text" placeholder="Buscar campanha..." class="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
      </div>
      <select v-model="filterStatus" @change="fetchCampaigns()" class="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
        <option value="">Todos os status</option>
        <option value="draft">Rascunho</option>
        <option value="scheduled">Agendada</option>
        <option value="running">Em execução</option>
        <option value="paused">Pausada</option>
        <option value="completed">Concluída</option>
        <option value="cancelled">Cancelada</option>
      </select>
      <select v-model="filterType" @change="fetchCampaigns()" class="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
        <option value="">Todos os tipos</option>
        <option value="official">Oficial (Meta)</option>
        <option value="unofficial">Não-oficial (WPP)</option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Empty -->
    <EmptyState v-else-if="filteredCampaigns.length === 0" title="Nenhuma campanha encontrada" description="Crie sua primeira campanha para começar" :icon="Send" />

    <!-- Campaign Cards -->
    <div v-else class="space-y-3">
      <div
        v-for="campaign in filteredCampaigns"
        :key="campaign._id"
        class="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors cursor-pointer"
        @click="router.push(`/campaigns/${campaign._id}`)"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <h3 class="font-semibold text-gray-900 truncate">{{ campaign.name }}</h3>
              <span :class="statusConfig[campaign.status]?.badge || 'bg-gray-100 text-gray-700'" class="px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap">
                {{ statusConfig[campaign.status]?.label || campaign.status }}
              </span>
              <span :class="campaign.type === 'official' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'" class="px-2 py-0.5 text-xs font-medium rounded-full">
                {{ campaign.type === 'official' ? 'Oficial' : 'Não-oficial' }}
              </span>
            </div>
            <p v-if="campaign.description" class="text-sm text-gray-500 truncate">{{ campaign.description }}</p>

            <!-- Progress bar -->
            <div v-if="['running', 'paused', 'completed'].includes(campaign.status)" class="mt-3">
              <div class="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>{{ campaign.sent || 0 }} de {{ campaign.totalContacts || 0 }} enviados</span>
                <span>{{ progressPercent(campaign) }}%</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-primary-600 h-2 rounded-full transition-all" :style="{ width: progressPercent(campaign) + '%' }"></div>
              </div>
            </div>

            <!-- Metrics row -->
            <div v-if="campaign.totalContacts > 0" class="flex gap-4 mt-2 text-xs text-gray-500">
              <span>Total: {{ campaign.totalContacts }}</span>
              <span class="text-green-600">Enviados: {{ campaign.sent || 0 }}</span>
              <span class="text-red-600">Falhos: {{ campaign.failed || 0 }}</span>
            </div>

            <div v-if="campaign.scheduledAt" class="text-xs text-gray-400 mt-1">
              Agendada para: {{ new Date(campaign.scheduledAt).toLocaleString('pt-BR') }}
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1" @click.stop>
            <button @click="router.push(`/campaigns/${campaign._id}`)" class="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50" title="Ver detalhes">
              <Eye class="w-4 h-4" />
            </button>
            <button @click="duplicateCampaign(campaign._id)" class="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50" title="Duplicar">
              <Copy class="w-4 h-4" />
            </button>
            <button
              v-if="['draft', 'cancelled', 'completed', 'failed'].includes(campaign.status)"
              @click="targetCampaign = campaign; showDeleteModal = true"
              class="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
              title="Remover"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="pagination.totalPages > 1" class="mt-4">
      <Pagination :total="pagination.total" :page="pagination.page" :page-size="pagination.pageSize" :total-pages="pagination.totalPages" @page-change="onPageChange" />
    </div>

    <!-- Delete Confirm -->
    <ConfirmModal
      v-if="showDeleteModal"
      title="Remover Campanha"
      message="Tem certeza que deseja remover esta campanha? Todos os dados de contatos e métricas serão perdidos."
      confirm-text="Remover"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>
