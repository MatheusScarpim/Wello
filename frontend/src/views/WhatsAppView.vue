<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { botsApi, whatsappInstancesApi, departmentsApi } from '@/api'
import { useToast } from 'vue-toastification'
import type {
  WhatsAppInstance,
  WhatsAppInstancePayload,
  BotListResponse,
  AutomaticMessages,
  Department,
} from '@/types'
import {
  Smartphone,
  Wifi,
  WifiOff,
  RefreshCw,
  Power,
  QrCode,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  Star,
  Edit2,
  X,
  MessageSquare,
  Save,
  ArrowRightLeft
} from 'lucide-vue-next'

const toast = useToast()

const instances = ref<WhatsAppInstance[]>([])
const registeredBots = ref<string[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const connectingIds = ref<Set<string>>(new Set())
const disconnectingIds = ref<Set<string>>(new Set())
const updatingBotIds = ref<Set<string>>(new Set())
const updatingDepartmentInstances = ref<Set<string>>(new Set())
const savingMetaConfigIds = ref<Set<string>>(new Set())
const departments = ref<Department[]>([])

// Modal states
const showCreateModal = ref(false)
const showQrModal = ref(false)
const showMessagesModal = ref(false)
const selectedInstance = ref<WhatsAppInstance | null>(null)
const currentQrCode = ref<string | null>(null)

// Automatic messages form
const messagesForm = ref<AutomaticMessages>({
  welcome: { enabled: false, message: '' },
  assign: { enabled: false, message: '' },
  finalization: { enabled: false, message: '' }
})
const isSavingMessages = ref(false)

// Transfer modal states
const showTransferModal = ref(false)
const transferSourceId = ref('')
const transferTargetId = ref('')
const transferMode = ref<'all' | 'by_status'>('all')
const transferStatuses = ref<string[]>([])
const isTransferring = ref(false)
const transferResult = ref<{ transferred: number; skipped: number; errors: string[] } | null>(null)

// Form state
const newInstanceForm = ref<WhatsAppInstancePayload>({
  name: '',
  connectionType: 'wppconnect',
  metaConfig: {
    enabled: false,
    accessToken: '',
    phoneNumberId: '',
    instagramAccountId: '',
    apiVersion: 'v17.0',
    baseUrl: 'https://graph.facebook.com',
  },
  isDefault: false,
  autoConnect: true,
  departmentIds: [],
  fairDistributionEnabled: false,
})
const isCreating = ref(false)

function handleWhatsAppInstancesUpdate(event: Event) {
  const customEvent = event as CustomEvent
  const payload = customEvent.detail
  if (payload?.instances) {
    instances.value = payload.instances as WhatsAppInstance[]
    isLoading.value = false
  }
}

const departmentOptions = computed(() =>
  departments.value.filter((dept) => dept.isActive),
)

const departmentSelectSize = computed(() => {
  if (departmentOptions.value.length === 0) return 3
  return Math.min(5, departmentOptions.value.length)
})

const stats = computed(() => {
  const total = instances.value.length
  const connected = instances.value.filter(i => i.connected).length
  const disconnected = total - connected
  return { total, connected, disconnected }
})

async function fetchInstances() {
  try {
    error.value = null
    const response = await whatsappInstancesApi.list()
    if (response.data) {
      instances.value = response.data as WhatsAppInstance[]
    }
  } catch (err: any) {
    error.value = err.message || 'Erro ao buscar instancias'
  } finally {
    isLoading.value = false
  }
}

async function fetchDepartments() {
  try {
    const response = await departmentsApi.list()
    if (response.data) {
      departments.value = response.data
    }
  } catch (err: any) {
    toast.error(err.message || 'Erro ao carregar departamentos')
  }
}

async function updateInstanceDepartments(
  instance: WhatsAppInstance,
  departmentIds: string[],
) {
  if (updatingDepartmentInstances.value.has(instance.id)) return
  updatingDepartmentInstances.value.add(instance.id)

  try {
    await whatsappInstancesApi.update(instance.id, { departmentIds })
    instance.departmentIds = [...departmentIds]
    toast.success('Departamentos atualizados')
  } catch (err: any) {
    toast.error(err.message || 'Erro ao atualizar departamentos')
  } finally {
    updatingDepartmentInstances.value.delete(instance.id)
  }
}

function handleInstanceDepartmentsChange(
  instance: WhatsAppInstance,
  event: Event,
) {
  const target = event.target as HTMLSelectElement
  const selected = Array.from(target.selectedOptions).map((option) => option.value)
  updateInstanceDepartments(instance, selected)
}

function handleNewInstanceDepartmentChange(event: Event) {
  const target = event.target as HTMLSelectElement
  const selected = Array.from(target.selectedOptions).map((option) => option.value)
  newInstanceForm.value.departmentIds = selected
}

async function fetchBots() {
  try {
    const response = await botsApi.list()
    const data = response.data as BotListResponse | undefined
    registeredBots.value = data?.registered || []
  } catch {
    registeredBots.value = []
  }
}

async function createInstance() {
  if (!newInstanceForm.value.name.trim()) {
    toast.error('Nome da instancia e obrigatorio')
    return
  }

  if (newInstanceForm.value.connectionType === 'meta_official') {
    const accessToken = newInstanceForm.value.metaConfig?.accessToken?.trim()
    const phoneNumberId = newInstanceForm.value.metaConfig?.phoneNumberId?.trim()
    const instagramAccountId =
      newInstanceForm.value.metaConfig?.instagramAccountId?.trim()
    if (!accessToken || (!phoneNumberId && !instagramAccountId)) {
      toast.error(
        'Para Meta oficial, preencha Access Token e Phone Number ID ou Instagram Account ID',
      )
      return
    }
    newInstanceForm.value.metaConfig = {
      enabled: true,
      accessToken,
      phoneNumberId,
      instagramAccountId,
      apiVersion: newInstanceForm.value.metaConfig?.apiVersion || 'v17.0',
      baseUrl:
        newInstanceForm.value.metaConfig?.baseUrl ||
        'https://graph.facebook.com',
    }
  }

  isCreating.value = true
  try {
    const response = await whatsappInstancesApi.create(newInstanceForm.value)
    if (response.data) {
      instances.value.push(response.data as WhatsAppInstance)
      toast.success('Instancia criada com sucesso!')
      showCreateModal.value = false
      newInstanceForm.value = {
        name: '',
        connectionType: 'wppconnect',
        metaConfig: {
          enabled: false,
          accessToken: '',
          phoneNumberId: '',
          instagramAccountId: '',
          apiVersion: 'v17.0',
          baseUrl: 'https://graph.facebook.com',
        },
        isDefault: false,
        autoConnect: true,
        departmentIds: [],
        fairDistributionEnabled: false,
      }

      // Auto connect the new instance
      const instance = response.data as WhatsAppInstance
      if (instance.connectionType !== 'meta_official') {
        await connectInstance(instance.id)
      }
    }
  } catch (err: any) {
    toast.error(err.message || 'Erro ao criar instancia')
  } finally {
    isCreating.value = false
  }
}

async function connectInstance(id: string) {
  const targetInstance = instances.value.find(i => i.id === id)
  if (targetInstance?.connectionType === 'meta_official') {
    const configured =
      !!targetInstance.metaConfig?.enabled &&
      !!targetInstance.metaConfig?.accessToken &&
      !!(
        targetInstance.metaConfig?.phoneNumberId ||
        targetInstance.metaConfig?.instagramAccountId
      )
    if (!configured) {
      toast.error(
        'Configure Access Token e Phone Number ID ou Instagram Account ID para conectar Meta',
      )
      return
    }
  }

  connectingIds.value.add(id)
  try {
    await whatsappInstancesApi.connect(id)
    toast.success('Conectando...')

    // Abre o modal imediatamente para mostrar "Gerando QR Code..."
    const instance = instances.value.find(i => i.id === id)
    if (instance) {
      selectedInstance.value = { ...instance, status: 'connecting' }
      currentQrCode.value = null
      showQrModal.value = true
      // Inicia polling para QR code
      pollQrCode(id)
    }
  } catch (err: any) {
    toast.error(err.message || 'Erro ao conectar')
  } finally {
    connectingIds.value.delete(id)
  }
}

async function disconnectInstance(id: string) {
  if (!confirm('Tem certeza que deseja desconectar esta instancia?')) return

  disconnectingIds.value.add(id)
  try {
    await whatsappInstancesApi.disconnect(id)
    toast.success('Desconectado com sucesso')
    await fetchInstances()
  } catch (err: any) {
    toast.error(err.message || 'Erro ao desconectar')
  } finally {
    disconnectingIds.value.delete(id)
  }
}

async function deleteInstance(id: string) {
  if (!confirm('Tem certeza que deseja excluir esta instancia? Esta acao não pode ser desfeita.')) return

  try {
    await whatsappInstancesApi.delete(id)
    instances.value = instances.value.filter(i => i.id !== id)
    toast.success('Instancia excluida')
  } catch (err: any) {
    toast.error(err.message || 'Erro ao excluir')
  }
}

async function setDefault(id: string) {
  try {
    await whatsappInstancesApi.setDefault(id)
    instances.value = instances.value.map(i => ({
      ...i,
      isDefault: i.id === id
    }))
    toast.success('Instancia definida como padrao')
  } catch (err: any) {
    toast.error(err.message || 'Erro ao definir padrao')
  }
}

async function toggleInstanceBot(instance: WhatsAppInstance) {
  if (updatingBotIds.value.has(instance.id)) return
  updatingBotIds.value.add(instance.id)
  try {
    const nextEnabled = !(instance.botEnabled ?? true)
    await whatsappInstancesApi.update(instance.id, { botEnabled: nextEnabled })
    instance.botEnabled = nextEnabled
    toast.success(`Bot ${nextEnabled ? 'ativado' : 'desativado'} para ${instance.name}`)
  } catch (err: any) {
    toast.error(err.message || 'Erro ao atualizar bot da instancia')
  } finally {
    updatingBotIds.value.delete(instance.id)
  }
}

async function toggleFairDistribution(instance: WhatsAppInstance, enabled: boolean) {
  try {
    await whatsappInstancesApi.update(instance.id, {
      fairDistributionEnabled: enabled,
    })
    instance.fairDistributionEnabled = enabled
    toast.success(
      `Distribuição justa ${enabled ? 'ativada' : 'desativada'} para ${instance.name}`,
    )
  } catch (err: any) {
    toast.error(err.message || 'Erro ao atualizar distribuição justa')
  }
}

async function setInstanceBot(instance: WhatsAppInstance, botId: string) {
  if (updatingBotIds.value.has(instance.id)) return
  updatingBotIds.value.add(instance.id)
  try {
    const value = botId || null
    await whatsappInstancesApi.update(instance.id, { botId: value })
    instance.botId = value
    toast.success(`Bot atualizado para ${instance.name}`)
  } catch (err: any) {
    toast.error(err.message || 'Erro ao atualizar bot da instancia')
  } finally {
    updatingBotIds.value.delete(instance.id)
  }
}

function handleBotSelect(instance: WhatsAppInstance, event: Event) {
  const target = event.target as HTMLSelectElement
  setInstanceBot(instance, target.value)
}

function openMessagesModal(instance: WhatsAppInstance) {
  selectedInstance.value = instance
  // Carrega as mensagens da instância ou usa defaults
  messagesForm.value = instance.automaticMessages ? { ...instance.automaticMessages } : {
    welcome: { enabled: false, message: 'Olá! Seja bem-vindo. Em breve um atendente irá atendê-lo.' },
    assign: { enabled: false, message: 'Olá! Meu nome é {operatorName} e vou atendê-lo.' },
    finalization: { enabled: false, message: 'Atendimento finalizado. Obrigado pelo contato!' }
  }
  showMessagesModal.value = true
}

async function saveAutomaticMessages() {
  if (!selectedInstance.value) return

  isSavingMessages.value = true
  try {
    await whatsappInstancesApi.update(selectedInstance.value.id, {
      automaticMessages: messagesForm.value
    })
    // Atualiza a instância na lista
    const idx = instances.value.findIndex(i => i.id === selectedInstance.value?.id)
    if (idx !== -1) {
      instances.value[idx].automaticMessages = { ...messagesForm.value }
    }
    toast.success('Mensagens automáticas salvas!')
    showMessagesModal.value = false
  } catch (err: any) {
    toast.error(err.message || 'Erro ao salvar mensagens automáticas')
  } finally {
    isSavingMessages.value = false
  }
}

function openTransferModal(instance: WhatsAppInstance) {
  transferSourceId.value = instance.id
  transferTargetId.value = ''
  transferMode.value = 'all'
  transferStatuses.value = []
  transferResult.value = null
  showTransferModal.value = true
}

async function executeTransfer() {
  if (!transferSourceId.value || !transferTargetId.value) {
    toast.error('Selecione a instância de destino')
    return
  }

  if (transferSourceId.value === transferTargetId.value) {
    toast.error('Instância de origem e destino não podem ser iguais')
    return
  }

  isTransferring.value = true
  transferResult.value = null

  try {
    const { data } = await whatsappInstancesApi.transferConversations({
      sourceInstanceId: transferSourceId.value,
      targetInstanceId: transferTargetId.value,
      filter: {
        mode: transferMode.value,
        ...(transferMode.value === 'by_status' && { statuses: transferStatuses.value }),
      },
    })

    if (data) {
      transferResult.value = data
      toast.success(`${data.transferred} conversas transferidas${data.skipped > 0 ? `, ${data.skipped} ignoradas` : ''}`)
    }
  } catch (err: any) {
    toast.error(err?.response?.data?.error || err.message || 'Erro ao transferir conversas')
  } finally {
    isTransferring.value = false
  }
}

async function openQrModal(instance: WhatsAppInstance) {
  if (instance.connectionType === 'meta_official') {
    toast.info('Instância Meta oficial não usa QR Code')
    return
  }
  selectedInstance.value = instance
  currentQrCode.value = instance.qrCode
  showQrModal.value = true

  // Start polling for QR code updates
  pollQrCode(instance.id)
}

async function retryConnection() {
  if (!selectedInstance.value) return

  const id = selectedInstance.value.id
  currentQrCode.value = null
  selectedInstance.value = { ...selectedInstance.value, status: 'connecting' }

  try {
    await whatsappInstancesApi.connect(id)
    pollQrCode(id)
  } catch (err: any) {
    toast.error(err.message || 'Erro ao reconectar')
  }
}

async function pollQrCode(id: string) {
  if (!showQrModal.value) return

  try {
    // Busca QR code
    const response = await whatsappInstancesApi.getQrCode(id)
    console.log('QR Response:', response.data)
    if (response.data) {
      const data = response.data as { qrCode: string | null; sessionName?: string }
      if (data.qrCode) {
        currentQrCode.value = data.qrCode
        console.log('QR Code recebido:', data.qrCode.substring(0, 50) + '...')
      }
    }

    // Check if connected
    await fetchInstances()
    const instance = instances.value.find(i => i.id === id)

    // Atualiza info da instancia no modal
    if (instance) {
      selectedInstance.value = instance
    }

    // Só fecha o modal quando realmente autenticado (status === 'connected' E authenticated === true)
    if (instance?.status === 'connected' && instance?.authenticated) {
      showQrModal.value = false
      toast.success(`${instance.name} conectado!`)
      return
    }

    // Se houve erro, mostra no modal mas continua polling por mais um tempo
    // pois o backend pode estar fazendo retry
    if (instance?.status === 'error') {
      // Não mostra toast aqui pois o modal já mostra o erro
      // Continua polling por mais alguns segundos caso o backend esteja fazendo retry
      if (showQrModal.value) {
        setTimeout(() => pollQrCode(id), 3000)
      }
      return
    }

    // Continue polling (intervalo menor para QR code)
    if (showQrModal.value) {
      setTimeout(() => pollQrCode(id), 2000)
    }
  } catch (err) {
    console.error('Erro ao buscar QR:', err)
    // Continua tentando mesmo com erro
    if (showQrModal.value) {
      setTimeout(() => pollQrCode(id), 3000)
    }
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'connected': return 'green'
    case 'qrcode': return 'yellow'
    case 'connecting': return 'blue'
    case 'error': return 'red'
    default: return 'gray'
  }
}

function getStatusText(status: string) {
  switch (status) {
    case 'connected': return 'Conectado'
    case 'qrcode': return 'Aguardando QR'
    case 'connecting': return 'Conectando...'
    case 'error': return 'Erro'
    default: return 'Desconectado'
  }
}

function getConnectionTypeLabel(connectionType?: string) {
  return connectionType === 'meta_official'
    ? 'Meta Oficial (Cloud API)'
    : 'WhatsApp Web (QR Code)'
}

function ensureMetaConfig(instance: WhatsAppInstance) {
  if (!instance.metaConfig) {
    instance.metaConfig = {
      enabled: true,
      accessToken: '',
      phoneNumberId: '',
      instagramAccountId: '',
      apiVersion: 'v17.0',
      baseUrl: 'https://graph.facebook.com',
    }
    return
  }

  instance.metaConfig.enabled = instance.metaConfig.enabled ?? true
  instance.metaConfig.apiVersion = instance.metaConfig.apiVersion || 'v17.0'
  instance.metaConfig.baseUrl =
    instance.metaConfig.baseUrl || 'https://graph.facebook.com'
}

async function saveInstanceMetaConfig(instance: WhatsAppInstance) {
  if (savingMetaConfigIds.value.has(instance.id)) return
  ensureMetaConfig(instance)

  const hasRequired =
    !!instance.metaConfig?.accessToken?.trim() &&
    !!(
      instance.metaConfig?.phoneNumberId?.trim() ||
      instance.metaConfig?.instagramAccountId?.trim()
    )
  if (!hasRequired) {
    toast.error(
      'Preencha Access Token e Phone Number ID ou Instagram Account ID da Meta',
    )
    return
  }

  savingMetaConfigIds.value.add(instance.id)
  try {
    await whatsappInstancesApi.update(instance.id, {
      connectionType: 'meta_official',
      metaConfig: {
        enabled: true,
        accessToken: instance.metaConfig?.accessToken?.trim(),
        phoneNumberId: instance.metaConfig?.phoneNumberId?.trim(),
        instagramAccountId: instance.metaConfig?.instagramAccountId?.trim(),
        apiVersion: instance.metaConfig?.apiVersion || 'v17.0',
        baseUrl: instance.metaConfig?.baseUrl || 'https://graph.facebook.com',
      },
    })
    await fetchInstances()
    toast.success('Configuração Meta salva')
  } catch (err: any) {
    toast.error(err.message || 'Erro ao salvar configuração Meta')
  } finally {
    savingMetaConfigIds.value.delete(instance.id)
  }
}

onMounted(async () => {
  await fetchInstances()
  await fetchBots()
  await fetchDepartments()

  window.addEventListener('ws:whatsapp-instances', handleWhatsAppInstancesUpdate)
})

onUnmounted(() => {
  window.removeEventListener('ws:whatsapp-instances', handleWhatsAppInstancesUpdate)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Instancias</h1>
        <p class="text-gray-500 mt-1">Gerencie suas instancias de canais</p>
      </div>
      <button @click="showCreateModal = true" class="btn-primary">
        <Plus class="w-4 h-4" />
        Nova Instancia
      </button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Smartphone class="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p class="text-sm text-gray-500">Total</p>
            <p class="text-xl font-semibold">{{ stats.total }}</p>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <Wifi class="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p class="text-sm text-gray-500">Conectados</p>
            <p class="text-xl font-semibold text-green-600">{{ stats.connected }}</p>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
            <WifiOff class="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <p class="text-sm text-gray-500">Desconectados</p>
            <p class="text-xl font-semibold text-gray-600">{{ stats.disconnected }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="card p-12 text-center">
      <Loader2 class="w-12 h-12 animate-spin text-primary-600 mx-auto" />
      <p class="mt-4 text-gray-500">Carregando instancias...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="card p-8 text-center">
      <AlertCircle class="w-16 h-16 text-red-500 mx-auto" />
      <h3 class="mt-4 text-lg font-medium text-gray-900">Erro de conexao</h3>
      <p class="mt-2 text-gray-500">{{ error }}</p>
      <button @click="fetchInstances" class="btn-primary mt-4">
        <RefreshCw class="w-4 h-4" />
        Tentar novamente
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="instances.length === 0" class="card p-12 text-center">
      <div class="w-20 h-20 mx-auto rounded-full bg-gray-100 flex items-center justify-center">
        <Smartphone class="w-10 h-10 text-gray-400" />
      </div>
      <h3 class="mt-4 text-lg font-medium text-gray-900">Nenhuma instancia</h3>
      <p class="mt-2 text-gray-500">Crie sua primeira instancia para comecar</p>
      <button @click="showCreateModal = true" class="btn-primary mt-4">
        <Plus class="w-4 h-4" />
        Criar Instancia
      </button>
    </div>

    <!-- Instances List -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div
        v-for="instance in instances"
        :key="instance.id"
        class="card overflow-hidden"
      >
        <div class="p-5">
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <div
                class="w-12 h-12 rounded-full flex items-center justify-center"
                :class="{
                  'bg-green-100': instance.status === 'connected',
                  'bg-yellow-100': instance.status === 'qrcode',
                  'bg-blue-100': instance.status === 'connecting',
                  'bg-red-100': instance.status === 'error',
                  'bg-gray-100': instance.status === 'disconnected'
                }"
              >
                <Smartphone
                  class="w-6 h-6"
                  :class="{
                    'text-green-600': instance.status === 'connected',
                    'text-yellow-600': instance.status === 'qrcode',
                    'text-blue-600': instance.status === 'connecting',
                    'text-red-600': instance.status === 'error',
                    'text-gray-600': instance.status === 'disconnected'
                  }"
                />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-semibold text-gray-900">{{ instance.name }}</h3>
                  <Star
                    v-if="instance.isDefault"
                    class="w-4 h-4 text-yellow-500 fill-yellow-500"
                    title="Instancia padrao"
                  />
                </div>
                <p class="text-sm text-gray-500">
                  {{ instance.phoneNumber || instance.sessionName }}
                </p>
                <p class="text-xs text-gray-400 mt-1">
                  {{ getConnectionTypeLabel(instance.connectionType) }}
                </p>
              </div>
            </div>

            <span
              class="px-2.5 py-1 rounded-full text-xs font-medium"
              :class="{
                'bg-green-100 text-green-800': instance.status === 'connected',
                'bg-yellow-100 text-yellow-800': instance.status === 'qrcode',
                'bg-blue-100 text-blue-800': instance.status === 'connecting',
                'bg-red-100 text-red-800': instance.status === 'error',
                'bg-gray-100 text-gray-800': instance.status === 'disconnected'
              }"
            >
              {{ getStatusText(instance.status) }}
            </span>
          </div>

          <!-- Connected Info -->
          <div v-if="instance.connected && instance.profileName" class="mt-4 p-3 bg-gray-50 rounded-lg">
            <div class="flex items-center gap-2 text-sm">
              <CheckCircle2 class="w-4 h-4 text-green-500" />
              <span class="text-gray-600">{{ instance.profileName }}</span>
              <span v-if="instance.phoneNumber" class="text-gray-400">- {{ instance.phoneNumber }}</span>
            </div>
          </div>

          <!-- Bot Settings -->
          <div class="mt-4 p-3 bg-gray-50 rounded-lg">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">Bot nesta instancia</span>
              <input
                type="checkbox"
                class="w-4 h-4"
                :checked="instance.botEnabled ?? true"
                :disabled="updatingBotIds.has(instance.id)"
                @change="toggleInstanceBot(instance)"
              />
            </div>
          <div class="mt-2">
            <select
              class="select w-full"
              :disabled="!(instance.botEnabled ?? true) || updatingBotIds.has(instance.id)"
              @change="handleBotSelect(instance, $event)"
            >
              <option value="">Padrao (env)</option>
              <option
                v-for="botId in registeredBots"
                :key="botId"
                :value="botId"
                :selected="instance.botId === botId"
              >
                {{ botId }}
              </option>
            </select>
          </div>
        </div>

        <!-- Fair Distribution Toggle -->
          <div class="mt-4 p-3 bg-gray-50 rounded-lg">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-sm font-semibold text-gray-900">Distribuição justa</span>
                <p class="text-xs text-gray-500">
                  Oferece a conversa para um operador por 3 minutos antes de passar para o próximo.
                </p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  class="sr-only peer"
                  :checked="instance.fairDistributionEnabled"
                  @change="toggleFairDistribution(instance, $event.target.checked)"
                />
                <div
                  class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-primary-500 transition-all duration-200 relative"
                >
                  <span class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 peer-checked:translate-x-5" />
                </div>
              </label>
            </div>
          </div>

          <div class="mt-4 p-3 bg-white border border-gray-100 rounded-lg">
            <div class="flex items-center justify-between mb-2">
              <div>
                <p class="text-xs font-semibold text-gray-600">Departamentos responsáveis</p>
                <p class="text-[10px] text-gray-400">Os operadores ativos neste departamento serão contemplados pela distribuição justa.</p>
              </div>
              <span
                class="text-xs text-gray-500"
                v-if="!departmentOptions.length"
              >
                Cadastre um departamento
              </span>
            </div>
            <select
              multiple
              :size="departmentSelectSize"
              class="select w-full"
              :disabled="updatingDepartmentInstances.has(instance.id) || departmentOptions.length === 0"
              :value="instance.departmentIds || []"
              @change="handleInstanceDepartmentsChange(instance, $event)"
            >
              <option
                v-for="dept in departmentOptions"
                :key="dept._id"
                :value="dept._id"
                :selected="instance.departmentIds?.includes(dept._id)"
              >
                {{ dept.name }}
              </option>
            </select>
          </div>

          <!-- Mensagens Automáticas -->
          <div class="mt-4 p-3 bg-gray-50 rounded-lg">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <MessageSquare class="w-4 h-4 text-gray-500" />
                <span class="text-sm text-gray-600">Mensagens Automáticas</span>
              </div>
              <button
                @click="openMessagesModal(instance)"
                class="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Configurar
              </button>
            </div>
            <div class="mt-2 text-xs text-gray-500">
              <span v-if="instance.automaticMessages?.welcome.enabled" class="inline-block mr-2 px-2 py-0.5 bg-green-100 text-green-700 rounded">Boas-vindas</span>
              <span v-if="instance.automaticMessages?.assign.enabled" class="inline-block mr-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Assumir</span>
              <span v-if="instance.automaticMessages?.finalization.enabled" class="inline-block mr-2 px-2 py-0.5 bg-orange-100 text-orange-700 rounded">Finalização</span>
              <span v-if="!instance.automaticMessages?.welcome.enabled && !instance.automaticMessages?.assign.enabled && !instance.automaticMessages?.finalization.enabled" class="text-gray-400">Nenhuma ativa</span>
            </div>
          </div>

          <div
            v-if="instance.connectionType === 'meta_official'"
            class="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-blue-900">Configuração Meta Oficial</span>
              <button
                @click="saveInstanceMetaConfig(instance)"
                :disabled="savingMetaConfigIds.has(instance.id)"
                class="btn-sm btn-primary"
              >
                <Loader2 v-if="savingMetaConfigIds.has(instance.id)" class="w-4 h-4 animate-spin" />
                <Save v-else class="w-4 h-4" />
                Salvar
              </button>
            </div>

            <div class="space-y-2">
              <input
                :value="instance.metaConfig?.accessToken || ''"
                @input="ensureMetaConfig(instance); instance.metaConfig!.accessToken = ($event.target as HTMLInputElement).value"
                type="text"
                class="input w-full text-sm"
                placeholder="Meta Access Token"
              />
              <input
                :value="instance.metaConfig?.phoneNumberId || ''"
                @input="ensureMetaConfig(instance); instance.metaConfig!.phoneNumberId = ($event.target as HTMLInputElement).value"
                type="text"
                class="input w-full text-sm"
                placeholder="Meta Phone Number ID"
              />
              <input
                :value="instance.metaConfig?.instagramAccountId || ''"
                @input="ensureMetaConfig(instance); instance.metaConfig!.instagramAccountId = ($event.target as HTMLInputElement).value"
                type="text"
                class="input w-full text-sm"
                placeholder="Instagram Account ID"
              />
              <input
                :value="instance.metaConfig?.apiVersion || 'v17.0'"
                @input="ensureMetaConfig(instance); instance.metaConfig!.apiVersion = ($event.target as HTMLInputElement).value"
                type="text"
                class="input w-full text-sm"
                placeholder="API Version (ex: v17.0)"
              />
              <input
                :value="instance.metaConfig?.baseUrl || 'https://graph.facebook.com'"
                @input="ensureMetaConfig(instance); instance.metaConfig!.baseUrl = ($event.target as HTMLInputElement).value"
                type="text"
                class="input w-full text-sm"
                placeholder="Base URL"
              />
            </div>
          </div>

          <!-- Actions -->
          <div class="mt-4 flex flex-wrap gap-2">
            <!-- Connect / Show QR -->
            <button
              v-if="instance.connectionType !== 'meta_official' && !instance.connected"
              @click="instance.qrCode ? openQrModal(instance) : connectInstance(instance.id)"
              :disabled="connectingIds.has(instance.id)"
              class="btn-sm btn-primary"
            >
              <Loader2 v-if="connectingIds.has(instance.id)" class="w-4 h-4 animate-spin" />
              <QrCode v-else-if="instance.qrCode" class="w-4 h-4" />
              <Wifi v-else class="w-4 h-4" />
              {{ connectingIds.has(instance.id) ? 'Conectando...' : instance.qrCode ? 'Ver QR Code' : 'Conectar' }}
            </button>

            <!-- Disconnect -->
            <button
              v-if="instance.connectionType !== 'meta_official' && instance.connected"
              @click="disconnectInstance(instance.id)"
              :disabled="disconnectingIds.has(instance.id)"
              class="btn-sm btn-outline text-red-600 border-red-300 hover:bg-red-50"
            >
              <Loader2 v-if="disconnectingIds.has(instance.id)" class="w-4 h-4 animate-spin" />
              <Power v-else class="w-4 h-4" />
              Desconectar
            </button>

            <!-- Set Default -->
            <button
              v-if="!instance.isDefault"
              @click="setDefault(instance.id)"
              class="btn-sm btn-ghost"
              title="Definir como padrao"
            >
              <Star class="w-4 h-4" />
              Padrao
            </button>

            <!-- Transfer Conversations -->
            <button
              v-if="instances.length > 1"
              @click="openTransferModal(instance)"
              class="btn-sm btn-ghost"
              title="Transferir conversas para outra instancia"
            >
              <ArrowRightLeft class="w-4 h-4" />
              Transferir
            </button>

            <!-- Delete -->
            <button
              @click="deleteInstance(instance.id)"
              class="btn-sm btn-ghost text-red-600 hover:bg-red-50"
              title="Excluir instancia"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Info Card -->
    <div class="card p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Informacoes importantes</h3>
      <ul class="space-y-2 text-gray-600">
        <li class="flex items-start gap-2">
          <CheckCircle2 class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <span>Cada instancia representa um numero de WhatsApp diferente</span>
        </li>
        <li class="flex items-start gap-2">
          <CheckCircle2 class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <span>A instancia padrao sera usada para envios quando nenhuma for especificada</span>
        </li>
        <li class="flex items-start gap-2">
          <AlertCircle class="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <span>Mantenha os celulares conectados a internet para as instancias funcionarem</span>
        </li>
        <li class="flex items-start gap-2">
          <AlertCircle class="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <span>Ao desconectar uma instancia, sera necessario escanear o QR Code novamente</span>
        </li>
      </ul>
    </div>

    <!-- Create Modal -->
    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        @click.self="showCreateModal = false"
      >
        <div class="bg-white rounded-xl shadow-xl max-w-md w-full">
          <div class="p-6 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold text-gray-900">Nova Instancia</h2>
              <button @click="showCreateModal = false" class="p-2 hover:bg-gray-100 rounded-lg">
                <X class="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          <div class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Nome da Instancia *
              </label>
              <input
                v-model="newInstanceForm.name"
                type="text"
                placeholder="Ex: Atendimento Principal"
                class="input"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Conexao
              </label>
              <select v-model="newInstanceForm.connectionType" class="select w-full">
                <option value="wppconnect">WhatsApp Web (QR Code)</option>
                <option value="meta_official">Meta Oficial (Cloud API)</option>
              </select>
            </div>

            <div
              v-if="newInstanceForm.connectionType === 'meta_official'"
              class="space-y-2 p-3 bg-blue-50 border border-blue-100 rounded-lg"
            >
              <p class="text-xs text-blue-800">
                Configure as credenciais da API oficial da Meta para esta instância.
              </p>
              <input
                v-model="newInstanceForm.metaConfig!.accessToken"
                type="text"
                class="input w-full"
                placeholder="Meta Access Token"
              />
              <input
                v-model="newInstanceForm.metaConfig!.phoneNumberId"
                type="text"
                class="input w-full"
                placeholder="Meta Phone Number ID"
              />
              <input
                v-model="newInstanceForm.metaConfig!.instagramAccountId"
                type="text"
                class="input w-full"
                placeholder="Instagram Account ID"
              />
              <input
                v-model="newInstanceForm.metaConfig!.apiVersion"
                type="text"
                class="input w-full"
                placeholder="API Version (v17.0)"
              />
              <input
                v-model="newInstanceForm.metaConfig!.baseUrl"
                type="text"
                class="input w-full"
                placeholder="Base URL"
              />
            </div>

            <div class="flex items-center gap-2">
              <input
                v-model="newInstanceForm.isDefault"
                type="checkbox"
                id="isDefault"
                class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label for="isDefault" class="text-sm text-gray-700">
                Definir como instancia padrao
              </label>
            </div>

            <div
              v-if="newInstanceForm.connectionType !== 'meta_official'"
              class="flex items-center gap-2"
            >
              <input
                v-model="newInstanceForm.autoConnect"
                type="checkbox"
                id="autoConnect"
                class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label for="autoConnect" class="text-sm text-gray-700">
                Conectar automaticamente ao iniciar
              </label>
            </div>

            <div class="mt-4">
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Departamentos responsáveis
              </label>
            <select
              multiple
              :size="departmentSelectSize"
              class="select w-full"
              :value="newInstanceForm.departmentIds || []"
              @change="handleNewInstanceDepartmentChange"
              :disabled="departmentOptions.length === 0"
            >
              <option
                v-for="dept in departmentOptions"
                :key="dept._id"
                :value="dept._id"
                :selected="newInstanceForm.departmentIds?.includes(dept._id)"
              >
                {{ dept.name }}
              </option>
            </select>
              <p v-if="departmentOptions.length === 0" class="mt-1 text-xs text-gray-400">
                Crie um departamento ativo antes de atribuir.
              </p>
            </div>
          </div>

          <div class="p-6 border-t border-gray-200 flex justify-end gap-3">
            <button @click="showCreateModal = false" class="btn-outline">
              Cancelar
            </button>
            <button
              @click="createInstance"
              :disabled="isCreating || !newInstanceForm.name.trim()"
              class="btn-primary"
            >
              <Loader2 v-if="isCreating" class="w-4 h-4 animate-spin" />
              <Plus v-else class="w-4 h-4" />
              {{ isCreating ? 'Criando...' : 'Criar Instancia' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- QR Code Modal -->
    <Teleport to="body">
      <div
        v-if="showQrModal && selectedInstance"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      >
        <div class="bg-white rounded-xl shadow-xl max-w-lg w-full">
          <div class="p-6 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold text-gray-900">
                Conectar {{ selectedInstance.name }}
              </h2>
              <button @click="showQrModal = false" class="p-2 hover:bg-gray-100 rounded-lg">
                <X class="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          <div class="p-8">
            <div class="text-center">
              <!-- QR Code disponível -->
              <div v-if="currentQrCode" class="bg-white p-4 rounded-xl shadow-lg inline-block">
                <img
                  v-if="currentQrCode.startsWith('data:') || currentQrCode.startsWith('http')"
                  :src="currentQrCode"
                  alt="QR Code"
                  class="w-64 h-64"
                />
                <div v-else class="w-64 h-64 flex items-center justify-center bg-gray-100 rounded-lg">
                  <QrCode class="w-32 h-32 text-gray-400" />
                </div>
              </div>
              <!-- Erro ao conectar -->
              <div v-else-if="selectedInstance?.status === 'error'" class="p-8">
                <XCircle class="w-16 h-16 text-red-500 mx-auto" />
                <p class="mt-4 text-gray-700 font-medium">Erro ao conectar</p>
                <p class="mt-2 text-gray-500">Não foi possível iniciar a sessão. Tente novamente.</p>
                <button
                  @click="retryConnection"
                  class="btn-primary mt-4"
                >
                  <RefreshCw class="w-4 h-4" />
                  Tentar Novamente
                </button>
              </div>
              <!-- Gerando QR Code -->
              <div v-else class="p-8">
                <Loader2 class="w-12 h-12 animate-spin text-primary-600 mx-auto" />
                <p class="mt-4 text-gray-500">
                  {{ selectedInstance?.status === 'connecting' ? 'Iniciando sessão...' : 'Gerando QR Code...' }}
                </p>
                <p class="mt-2 text-xs text-gray-400">Isso pode levar alguns segundos</p>
              </div>

              <div class="mt-6 space-y-3 text-left">
                <h3 class="text-lg font-medium text-gray-900 text-center">Como conectar:</h3>
                <ol class="text-gray-600 space-y-2">
                  <li class="flex items-start gap-2">
                    <span class="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-medium">1</span>
                    <span>Abra o WhatsApp no seu celular</span>
                  </li>
                  <li class="flex items-start gap-2">
                    <span class="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-medium">2</span>
                    <span>Toque em Menu e selecione "Aparelhos conectados"</span>
                  </li>
                  <li class="flex items-start gap-2">
                    <span class="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-medium">3</span>
                    <span>Toque em "Conectar um aparelho"</span>
                  </li>
                  <li class="flex items-start gap-2">
                    <span class="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-medium">4</span>
                    <span>Aponte a camera para este QR Code</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>

          <!-- Fair Distribution Toggle -->
          <div class="p-6 border-t border-gray-200 flex justify-end">
            <button @click="showQrModal = false" class="btn-outline">
              Fechar
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Automatic Messages Modal -->
    <Teleport to="body">
      <div
        v-if="showMessagesModal && selectedInstance"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        @click.self="showMessagesModal = false"
      >
        <div class="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div class="p-6 border-b border-gray-200 sticky top-0 bg-white">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-xl font-semibold text-gray-900">Mensagens Automáticas</h2>
                <p class="text-sm text-gray-500 mt-1">{{ selectedInstance.name }}</p>
              </div>
              <button @click="showMessagesModal = false" class="p-2 hover:bg-gray-100 rounded-lg">
                <X class="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          <div class="p-6 space-y-6">
            <!-- Boas-vindas -->
            <div class="border border-gray-200 rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <div>
                  <h4 class="font-medium text-gray-900">Mensagem de Boas-vindas</h4>
                  <p class="text-xs text-gray-500">Enviada quando o cliente inicia uma nova conversa</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="messagesForm.welcome.enabled" class="sr-only peer" />
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              <textarea
                v-model="messagesForm.welcome.message"
                :disabled="!messagesForm.welcome.enabled"
                class="input w-full resize-none"
                :class="{ 'opacity-50': !messagesForm.welcome.enabled }"
                rows="2"
                placeholder="Olá! Seja bem-vindo..."
              />
            </div>

            <!-- Assumir -->
            <div class="border border-gray-200 rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <div>
                  <h4 class="font-medium text-gray-900">Mensagem ao Assumir</h4>
                  <p class="text-xs text-gray-500">Enviada quando um operador assume o atendimento</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="messagesForm.assign.enabled" class="sr-only peer" />
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              <textarea
                v-model="messagesForm.assign.message"
                :disabled="!messagesForm.assign.enabled"
                class="input w-full resize-none"
                :class="{ 'opacity-50': !messagesForm.assign.enabled }"
                rows="2"
                placeholder="Olá! Meu nome é {operatorName}..."
              />
              <p class="text-xs text-gray-400 mt-1">Use <code class="bg-gray-100 px-1 rounded">{operatorName}</code> para o nome do operador</p>
            </div>

            <!-- Finalização -->
            <div class="border border-gray-200 rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <div>
                  <h4 class="font-medium text-gray-900">Mensagem de Finalização</h4>
                  <p class="text-xs text-gray-500">Enviada quando o atendimento é finalizado</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="messagesForm.finalization.enabled" class="sr-only peer" />
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              <textarea
                v-model="messagesForm.finalization.message"
                :disabled="!messagesForm.finalization.enabled"
                class="input w-full resize-none"
                :class="{ 'opacity-50': !messagesForm.finalization.enabled }"
                rows="2"
                placeholder="Atendimento finalizado..."
              />
            </div>

            <p class="text-xs text-gray-400">
              Variáveis disponíveis: <code class="bg-gray-100 px-1 rounded">{customerName}</code>, <code class="bg-gray-100 px-1 rounded">{protocolNumber}</code>, <code class="bg-gray-100 px-1 rounded">{operatorName}</code> (apenas em "Assumir")
            </p>
          </div>

          <div class="p-6 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
            <button @click="showMessagesModal = false" class="btn-outline">
              Cancelar
            </button>
            <button
              @click="saveAutomaticMessages"
              :disabled="isSavingMessages"
              class="btn-primary"
            >
              <Loader2 v-if="isSavingMessages" class="w-4 h-4 animate-spin" />
              {{ isSavingMessages ? 'Salvando...' : 'Salvar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Transfer Conversations Modal -->
    <Teleport to="body">
      <div
        v-if="showTransferModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        @click.self="showTransferModal = false"
      >
        <div class="bg-white rounded-xl shadow-xl max-w-md w-full">
          <div class="p-6 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold text-gray-900">Transferir Conversas</h2>
              <button @click="showTransferModal = false" class="p-2 hover:bg-gray-100 rounded-lg">
                <X class="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p class="text-sm text-gray-500 mt-1">
              De: <span class="font-medium">{{ instances.find(i => i.id === transferSourceId)?.name }}</span>
            </p>
          </div>

          <div class="p-6 space-y-4">
            <!-- Target Instance -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Instancia de destino *
              </label>
              <select v-model="transferTargetId" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                <option value="">Selecione...</option>
                <option
                  v-for="inst in instances.filter(i => i.id !== transferSourceId)"
                  :key="inst.id"
                  :value="inst.id"
                >
                  {{ inst.name }} ({{ inst.connected ? 'Conectado' : 'Desconectado' }})
                </option>
              </select>
            </div>

            <!-- Filter Mode -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Quais conversas transferir?
              </label>
              <select v-model="transferMode" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                <option value="all">Todas as conversas ativas</option>
                <option value="by_status">Filtrar por status</option>
              </select>
            </div>

            <!-- Status Filter -->
            <div v-if="transferMode === 'by_status'" class="space-y-2">
              <label class="block text-sm font-medium text-gray-700">Status</label>
              <label v-for="s in [{ value: 'active', label: 'Ativo' }, { value: 'waiting', label: 'Aguardando' }, { value: 'inactive', label: 'Inativo' }]" :key="s.value" class="flex items-center gap-2">
                <input type="checkbox" :value="s.value" v-model="transferStatuses" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                <span class="text-sm text-gray-700">{{ s.label }}</span>
              </label>
            </div>

            <!-- Warning -->
            <div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div class="flex items-start gap-2">
                <AlertCircle class="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <p class="text-sm text-yellow-800">
                  As conversas transferidas passarao a enviar e receber mensagens pela instancia de destino.
                </p>
              </div>
            </div>

            <!-- Result -->
            <div v-if="transferResult" class="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p class="text-sm text-green-800 font-medium">Transferencia concluida</p>
              <p class="text-sm text-green-700">{{ transferResult.transferred }} transferidas, {{ transferResult.skipped }} ignoradas</p>
              <div v-if="transferResult.errors.length > 0" class="mt-2 space-y-1">
                <p v-for="(err, idx) in transferResult.errors" :key="idx" class="text-xs text-red-600">{{ err }}</p>
              </div>
            </div>
          </div>

          <div class="p-6 border-t border-gray-200 flex justify-end gap-3">
            <button @click="showTransferModal = false" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              {{ transferResult ? 'Fechar' : 'Cancelar' }}
            </button>
            <button
              v-if="!transferResult"
              @click="executeTransfer"
              :disabled="isTransferring || !transferTargetId"
              class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <Loader2 v-if="isTransferring" class="w-4 h-4 animate-spin" />
              <ArrowRightLeft v-else class="w-4 h-4" />
              {{ isTransferring ? 'Transferindo...' : 'Transferir' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.btn-sm {
  @apply px-3 py-1.5 text-sm rounded-lg font-medium inline-flex items-center gap-1.5 transition-colors;
}
</style>

