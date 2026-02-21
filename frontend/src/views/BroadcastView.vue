<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { contactsApi, whatsappInstancesApi, whatsappFeaturesApi } from '@/api'
import { useToast } from 'vue-toastification'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import Pagination from '@/components/ui/Pagination.vue'
import ExcelActions from '@/components/ui/ExcelActions.vue'
import {
  Send,
  Search,
  Users,
  CheckSquare,
  Square,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Plus,
  Minus,
} from 'lucide-vue-next'
import type { Contact, Pagination as PaginationType, WhatsAppInstance } from '@/types'

const toast = useToast()

// State
const contacts = ref<Contact[]>([])
const selectedContacts = ref<Set<string>>(new Set())
const manualNumbers = ref('')
const message = ref('')
const delayMs = ref(3000)
const isLoading = ref(false)
const isSending = ref(false)
const search = ref('')
const searchTimeout = ref<ReturnType<typeof setTimeout>>()
const instances = ref<WhatsAppInstance[]>([])
const selectedInstanceId = ref('')
const pagination = ref<PaginationType>({
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,
})

// Results
const sendResults = ref<Array<{ contact: string; success: boolean; error?: string }>>([])
const showResults = ref(false)

// Computed
const allSelected = computed(() => {
  return contacts.value.length > 0 && contacts.value.every(c => selectedContacts.value.has(c.identifier))
})

const totalRecipients = computed(() => {
  const manual = manualNumbers.value
    .split('\n')
    .map(n => n.trim())
    .filter(Boolean)
  return selectedContacts.value.size + manual.length
})

const canSend = computed(() => {
  return totalRecipients.value > 0 && message.value.trim() && selectedInstanceId.value && !isSending.value
})

const selectedInstance = computed(() => {
  return instances.value.find(i => i.id === selectedInstanceId.value)
})

// Methods
async function loadContacts() {
  isLoading.value = true
  try {
    const response = await contactsApi.list({
      page: pagination.value.page,
      limit: pagination.value.pageSize,
      search: search.value || undefined,
    })
    if (response.data) {
      contacts.value = response.data.items
      pagination.value = response.data.pagination
    }
  } catch {
    toast.error('Erro ao carregar contatos')
  } finally {
    isLoading.value = false
  }
}

async function loadInstances() {
  try {
    const response = await whatsappInstancesApi.list()
    const all = (response.data as WhatsAppInstance[]) || []
    instances.value = all.filter((i) => i.connected)
    if (instances.value.length === 1) {
      selectedInstanceId.value = instances.value[0].id
    }
  } catch {
    toast.error('Erro ao carregar instâncias')
  }
}

function handleSearch() {
  clearTimeout(searchTimeout.value)
  searchTimeout.value = setTimeout(() => {
    pagination.value.page = 1
    loadContacts()
  }, 400)
}

function toggleContact(identifier: string) {
  const s = new Set(selectedContacts.value)
  if (s.has(identifier)) {
    s.delete(identifier)
  } else {
    s.add(identifier)
  }
  selectedContacts.value = s
}

function toggleAll() {
  if (allSelected.value) {
    const s = new Set(selectedContacts.value)
    contacts.value.forEach(c => s.delete(c.identifier))
    selectedContacts.value = s
  } else {
    const s = new Set(selectedContacts.value)
    contacts.value.forEach(c => s.add(c.identifier))
    selectedContacts.value = s
  }
}

function clearSelection() {
  selectedContacts.value = new Set()
  manualNumbers.value = ''
}

function handlePageChange(page: number) {
  pagination.value.page = page
  loadContacts()
}

function handleImportNumbers(data: any[]) {
  const numbers: string[] = []
  for (const row of data) {
    const num = row['Número'] || row.numero || row.number || row.identifier || ''
    if (num) numbers.push(String(num).trim())
  }
  if (numbers.length === 0) {
    toast.error('Nenhum número encontrado no arquivo')
    return
  }
  manualNumbers.value = (manualNumbers.value ? manualNumbers.value + '\n' : '') + numbers.join('\n')
  toast.success(`${numbers.length} números importados`)
}

async function sendBroadcast() {
  if (!canSend.value) return

  const instance = selectedInstance.value
  if (!instance) {
    toast.error('Selecione uma instância')
    return
  }

  // Collect all contacts
  const allContacts: string[] = [...selectedContacts.value]
  const manual = manualNumbers.value
    .split('\n')
    .map(n => n.trim())
    .filter(Boolean)
  manual.forEach(n => {
    if (!allContacts.includes(n)) allContacts.push(n)
  })

  if (allContacts.length === 0) {
    toast.error('Nenhum destinatário selecionado')
    return
  }

  isSending.value = true
  sendResults.value = []
  showResults.value = false

  try {
    const response = await whatsappFeaturesApi.sendBroadcast({
      sessionName: instance.sessionName || instance.name,
      contacts: allContacts,
      message: message.value.trim(),
      delayMs: delayMs.value,
    })

    const data = response.data?.data || response.data
    sendResults.value = data.results || []
    showResults.value = true

    const sent = data.sent || 0
    const failed = data.failed || 0

    if (failed === 0) {
      toast.success(`Disparo concluído! ${sent} mensagens enviadas`)
    } else {
      toast.warning(`Disparo concluído: ${sent} enviadas, ${failed} falharam`)
    }
  } catch (err: any) {
    toast.error('Erro ao enviar disparo em massa')
    console.error(err)
  } finally {
    isSending.value = false
  }
}

onMounted(() => {
  loadContacts()
  loadInstances()
})
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Disparo em Massa</h1>
        <p class="text-sm text-gray-500 mt-1">Envie mensagens para múltiplos contatos de uma vez</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left: Contact Selection -->
      <div class="lg:col-span-2 space-y-4">
        <!-- Search + Select All -->
        <div class="bg-white rounded-xl border border-gray-200 p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Users class="w-4 h-4" />
              Selecionar Contatos
            </h2>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500">
                {{ selectedContacts.size }} selecionados
              </span>
              <button
                v-if="selectedContacts.size > 0"
                @click="clearSelection"
                class="text-xs text-red-500 hover:text-red-700"
              >
                Limpar
              </button>
            </div>
          </div>

          <!-- Search -->
          <div class="relative mb-3">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              v-model="search"
              @input="handleSearch"
              type="text"
              placeholder="Buscar contatos..."
              class="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <!-- Select All -->
          <button
            @click="toggleAll"
            class="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 mb-2 px-1"
          >
            <component :is="allSelected ? CheckSquare : Square" class="w-4 h-4" />
            Selecionar todos da página
          </button>

          <!-- Contact List -->
          <div v-if="isLoading" class="flex justify-center py-8">
            <LoadingSpinner />
          </div>
          <div v-else class="space-y-1 max-h-[400px] overflow-y-auto">
            <button
              v-for="contact in contacts"
              :key="contact._id"
              @click="toggleContact(contact.identifier)"
              class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors"
              :class="selectedContacts.has(contact.identifier) ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50 border border-transparent'"
            >
              <component
                :is="selectedContacts.has(contact.identifier) ? CheckSquare : Square"
                class="w-4 h-4 flex-shrink-0"
                :class="selectedContacts.has(contact.identifier) ? 'text-primary-600' : 'text-gray-400'"
              />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 truncate">
                  {{ contact.customName || contact.name || contact.identifier || 'Sem nome' }}
                </p>
                <p class="text-xs text-gray-500">{{ contact.identifier || contact._id }}</p>
              </div>
              <div v-if="contact.tags?.length" class="flex gap-1">
                <span
                  v-for="tag in contact.tags.slice(0, 2)"
                  :key="tag"
                  class="px-1.5 py-0.5 text-[10px] rounded bg-gray-100 text-gray-500"
                >
                  {{ tag }}
                </span>
              </div>
            </button>

            <p v-if="contacts.length === 0" class="text-center text-sm text-gray-400 py-8">
              Nenhum contato encontrado
            </p>
          </div>

          <!-- Pagination -->
          <div v-if="pagination.totalPages > 1" class="mt-3">
            <Pagination
              :current-page="pagination.page"
              :total-pages="pagination.totalPages"
              :total="pagination.total"
              @page-change="handlePageChange"
            />
          </div>
        </div>

        <!-- Manual Numbers -->
        <div class="bg-white rounded-xl border border-gray-200 p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Plus class="w-4 h-4" />
              Números Manuais
            </h2>
            <ExcelActions
              :export-data="[]"
              export-filename=""
              :show-export="false"
              @import="handleImportNumbers"
            />
          </div>
          <textarea
            v-model="manualNumbers"
            rows="4"
            placeholder="Cole números aqui, um por linha. Ex:&#10;5511999998888&#10;5511988887777"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
          />
          <p class="text-xs text-gray-400 mt-1">
            Um número por linha. Formato: código do país + DDD + número (sem espaços ou caracteres especiais)
          </p>
        </div>
      </div>

      <!-- Right: Message Composer -->
      <div class="space-y-4">
        <!-- Instance Selector -->
        <div class="bg-white rounded-xl border border-gray-200 p-4">
          <h2 class="text-sm font-semibold text-gray-700 mb-3">Instância</h2>
          <select
            v-model="selectedInstanceId"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Selecione uma instância</option>
            <option v-for="inst in instances" :key="inst.id" :value="inst.id">
              {{ inst.name }} ({{ inst.sessionName }})
            </option>
          </select>
          <p v-if="instances.length === 0" class="text-xs text-amber-500 mt-2 flex items-center gap-1">
            <AlertTriangle class="w-3 h-3" />
            Nenhuma instância conectada
          </p>
        </div>

        <!-- Message -->
        <div class="bg-white rounded-xl border border-gray-200 p-4">
          <h2 class="text-sm font-semibold text-gray-700 mb-3">Mensagem</h2>
          <textarea
            v-model="message"
            rows="6"
            placeholder="Digite a mensagem que será enviada para todos os contatos..."
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
          />
          <p class="text-xs text-gray-400 mt-1">{{ message.length }} caracteres</p>
        </div>

        <!-- Delay -->
        <div class="bg-white rounded-xl border border-gray-200 p-4">
          <h2 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Clock class="w-4 h-4" />
            Intervalo entre mensagens
          </h2>
          <div class="flex items-center gap-3">
            <button
              @click="delayMs = Math.max(1000, delayMs - 1000)"
              class="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              <Minus class="w-4 h-4" />
            </button>
            <span class="text-sm font-medium text-gray-900 min-w-[60px] text-center">
              {{ (delayMs / 1000).toFixed(0) }}s
            </span>
            <button
              @click="delayMs = Math.min(30000, delayMs + 1000)"
              class="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              <Plus class="w-4 h-4" />
            </button>
          </div>
          <p class="text-xs text-gray-400 mt-2">
            Intervalo recomendado: 3-5 segundos para evitar bloqueio
          </p>
        </div>

        <!-- Summary + Send -->
        <div class="bg-white rounded-xl border border-gray-200 p-4">
          <div class="space-y-2 mb-4">
            <div class="flex justify-between text-sm">
              <span class="text-gray-500">Destinatários</span>
              <span class="font-medium">{{ totalRecipients }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-500">Tempo estimado</span>
              <span class="font-medium">~{{ Math.ceil((totalRecipients * delayMs) / 60000) }} min</span>
            </div>
          </div>

          <button
            @click="sendBroadcast"
            :disabled="!canSend"
            class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
            :class="canSend
              ? 'bg-primary-600 hover:bg-primary-700 text-white'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'"
          >
            <Loader2 v-if="isSending" class="w-4 h-4 animate-spin" />
            <Send v-else class="w-4 h-4" />
            {{ isSending ? 'Enviando...' : 'Enviar Disparo' }}
          </button>

          <p v-if="isSending" class="text-xs text-amber-500 text-center mt-2 flex items-center justify-center gap-1">
            <AlertTriangle class="w-3 h-3" />
            Não feche esta página durante o envio
          </p>
        </div>
      </div>
    </div>

    <!-- Results -->
    <div v-if="showResults" class="bg-white rounded-xl border border-gray-200 p-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold text-gray-700">Resultado do Disparo</h2>
        <button @click="showResults = false" class="p-1 rounded hover:bg-gray-100">
          <X class="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="p-3 rounded-lg bg-green-50 border border-green-200">
          <div class="flex items-center gap-2">
            <CheckCircle2 class="w-4 h-4 text-green-600" />
            <span class="text-sm font-medium text-green-700">
              {{ sendResults.filter(r => r.success).length }} enviadas
            </span>
          </div>
        </div>
        <div class="p-3 rounded-lg bg-red-50 border border-red-200">
          <div class="flex items-center gap-2">
            <XCircle class="w-4 h-4 text-red-600" />
            <span class="text-sm font-medium text-red-700">
              {{ sendResults.filter(r => !r.success).length }} falharam
            </span>
          </div>
        </div>
      </div>

      <!-- Failed details -->
      <div v-if="sendResults.some(r => !r.success)" class="space-y-1">
        <p class="text-xs font-semibold text-gray-500 mb-1">Falhas:</p>
        <div
          v-for="(result, i) in sendResults.filter(r => !r.success)"
          :key="i"
          class="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded"
        >
          <XCircle class="w-3 h-3 flex-shrink-0" />
          <span class="font-medium">{{ result.contact }}</span>
          <span class="text-red-400">{{ result.error }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
