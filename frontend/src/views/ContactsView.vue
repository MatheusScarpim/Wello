<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { contactsApi, tagsApi, conversationsApi, whatsappInstancesApi, operatorsApi } from '@/api'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Pagination from '@/components/ui/Pagination.vue'
import EditContactModal from '@/components/contacts/EditContactModal.vue'
import CreateContactModal from '@/components/contacts/CreateContactModal.vue'
import { Search, Users, Phone, MessageSquare, Clock, User, Tag, Pencil, MessageCircle, X, Plus, Trash2 } from 'lucide-vue-next'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from 'vue-toastification'
import type { Contact, Pagination as PaginationType, Tag as TagType, WhatsAppInstance, Operator } from '@/types'
import ExcelActions from '@/components/ui/ExcelActions.vue'

const router = useRouter()

const toast = useToast()
const contacts = ref<Contact[]>([])
const pagination = ref<PaginationType>({
  total: 0,
  page: 1,
  pageSize: 10,
  totalPages: 0,
})
const search = ref('')
const isLoading = ref(false)
const searchTimeout = ref<ReturnType<typeof setTimeout>>()

// Estado do modal de edicao
const selectedContact = ref<Contact | null>(null)
const showEditModal = ref(false)
const showCreateModal = ref(false)
const availableTags = ref<TagType[]>([])

// Estado do modal de exclusao
const showDeleteModal = ref(false)
const contactToDelete = ref<Contact | null>(null)
const isDeletingContact = ref(false)

// Estado para iniciar conversa
const startingConversation = ref<string | null>(null)
const showStartModal = ref(false)
const startContact = ref<Contact | null>(null)
const startInstances = ref<WhatsAppInstance[]>([])
const currentOperator = ref<Operator | null>(null)
const selectedInstanceId = ref<string | null>(null)
const isLoadingStartOptions = ref(false)
const isSubmittingStart = ref(false)

const avatarColors = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-orange-500',
]

function getAvatarColor(identifier: string) {
  let hash = 0
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash)
  }
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

function getInitials(contact: Contact) {
  const displayName = contact.customName || contact.name || ''
  if (displayName) {
    const parts = displayName.split(' ')
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
    }
    return displayName.charAt(0).toUpperCase()
  }
  return contact.identifier.slice(-2)
}

async function fetchContacts() {
  isLoading.value = true

  try {
    const response = await contactsApi.list({
      page: pagination.value.page,
      limit: pagination.value.pageSize,
      search: search.value.trim() || undefined,
    })

    if (response.data) {
      contacts.value = response.data.items
      pagination.value = response.data.pagination
    }
  } catch (error) {
    console.error('Erro ao carregar contatos:', error)
    toast.error('Erro ao carregar contatos')
  } finally {
    isLoading.value = false
  }
}

function handleSearch() {
  clearTimeout(searchTimeout.value)
  searchTimeout.value = setTimeout(() => {
    pagination.value.page = 1
    fetchContacts()
  }, 300)
}

function handlePageChange(page: number) {
  pagination.value.page = page
  fetchContacts()
}

function formatRelative(date?: string) {
  if (!date) {
    return 'Sem atividade'
  }
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR })
}

function isRecentActivity(date?: string) {
  if (!date) return false
  const diff = Date.now() - new Date(date).getTime()
  return diff < 24 * 60 * 60 * 1000 // últimas 24 horas
}

// Handlers do modal de edicao
function openEditModal(contact: Contact) {
  selectedContact.value = contact
  showEditModal.value = true
}

function closeEditModal() {
  showEditModal.value = false
  selectedContact.value = null
}

function handleContactSaved() {
  fetchContacts()
}

function handleContactCreated() {
  fetchContacts()
}

function openDeleteModal(contact: Contact) {
  contactToDelete.value = contact
  showDeleteModal.value = true
}

function closeDeleteModal() {
  showDeleteModal.value = false
  contactToDelete.value = null
}

async function confirmDelete() {
  if (!contactToDelete.value) return

  isDeletingContact.value = true
  try {
    await contactsApi.delete(contactToDelete.value._id)
    toast.success('Contato deletado com sucesso')
    closeDeleteModal()
    fetchContacts()
  } catch (error) {
    console.error('Erro ao deletar contato:', error)
    toast.error('Erro ao deletar contato')
  } finally {
    isDeletingContact.value = false
  }
}

// Funcao para obter cor da tag
function getTagColor(tagName: string) {
  const tag = availableTags.value.find(t => t.name === tagName)
  return tag?.color || '#6B7280'
}

const selectedInstance = computed(() =>
  startInstances.value.find(instance => instance.id === selectedInstanceId.value) || null
)

const selectedOperator = computed(() => currentOperator.value)

// Buscar tags disponiveis
async function fetchTags() {
  try {
    const response = await tagsApi.list()
    if (response.data) {
      availableTags.value = response.data
    }
  } catch (error) {
    console.error('Erro ao carregar tags:', error)
  }
}

async function loadStartOptions(provider: string) {
  isLoadingStartOptions.value = true

  try {
    const requests: Promise<any>[] = [
      operatorsApi.getCurrentOperator(),
    ]

    if (provider === 'whatsapp') {
      requests.push(whatsappInstancesApi.list())
    }

    const [operatorResponse, instancesResponse] = await Promise.all(requests)

    if (operatorResponse?.data) {
      currentOperator.value = operatorResponse.data as Operator
    } else {
      currentOperator.value = null
    }

    if (provider === 'whatsapp' && instancesResponse?.data) {
      startInstances.value = instancesResponse.data as WhatsAppInstance[]
      const defaultInstance = startInstances.value.find(i => i.isDefault && i.connected)
      const firstConnected = startInstances.value.find(i => i.connected)
      selectedInstanceId.value = defaultInstance?.id || firstConnected?.id || startInstances.value[0]?.id || null
    } else {
      startInstances.value = []
      selectedInstanceId.value = null
    }
  } catch (error) {
    console.error('Erro ao carregar opcoes de inicio de conversa:', error)
    toast.error('Erro ao carregar opcoes de conversa')
  } finally {
    isLoadingStartOptions.value = false
  }
}

function openStartModal(contact: Contact) {
  startContact.value = contact
  showStartModal.value = true
  selectedInstanceId.value = null
  loadStartOptions(contact.provider)
}

function closeStartModal() {
  showStartModal.value = false
  startContact.value = null
  startInstances.value = []
  currentOperator.value = null
  selectedInstanceId.value = null
  isLoadingStartOptions.value = false
  isSubmittingStart.value = false
}

// Iniciar conversa com contato
async function startConversation(contact: Contact) {
  openStartModal(contact)
}

async function confirmStartConversation() {
  const contact = startContact.value
  if (!contact) return

  if (contact.provider === 'whatsapp' && !selectedInstance.value) {
    toast.error('Selecione uma sessao WhatsApp')
    return
  }

  if (!selectedOperator.value) {
    toast.error('Nao foi possivel identificar o operador logado')
    return
  }

  isSubmittingStart.value = true
  startingConversation.value = contact._id

  try {
    // Verificar se ja existe conversa ativa
    const checkResponse = await contactsApi.checkConversation(contact._id)

    if (checkResponse.data?.exists && checkResponse.data.conversationId) {
      // Ja existe conversa ativa
      if (checkResponse.data.operatorId) {
        // Esta em atendimento com um operador
        toast.warning(`Este contato ja esta em atendimento com ${checkResponse.data.operatorName || 'um operador'}`)
        return
      }

      // Existe conversa mas sem operador - atribuir operador
      await conversationsApi.assignOperator(
        checkResponse.data.conversationId,
        selectedOperator.value._id,
        selectedOperator.value.name,
        true,
      )

      // Se a conversa ainda nao tem sessao, atualiza com a sessao escolhida
      if (selectedInstance.value) {
        await conversationsApi.update(checkResponse.data.conversationId, {
          sessionName: selectedInstance.value.sessionName,
          instanceId: selectedInstance.value.id,
          instanceName: selectedInstance.value.name,
        })
      }

      toast.success('Operador atribuido com sucesso')
      router.push({
        name: 'conversation-detail',
        params: { id: checkResponse.data.conversationId },
      })
      closeStartModal()
      return
    }

    // Nao existe conversa ativa - criar nova
    const createResponse = await conversationsApi.create({
      identifier: contact.identifier,
      provider: contact.provider,
      name: contact.customName || contact.name,
      instanceId: selectedInstance.value?.id,
      sessionName: selectedInstance.value?.sessionName,
      instanceName: selectedInstance.value?.name,
      contactId: contact.contactId,
      suppressWelcomeMessage: true,
    })

    if (createResponse.data) {
      await conversationsApi.assignOperator(
        createResponse.data._id,
        selectedOperator.value._id,
        selectedOperator.value.name,
        true,
      )
      toast.success('Conversa iniciada com sucesso')
      router.push({
        name: 'conversation-detail',
        params: { id: createResponse.data._id },
      })
      closeStartModal()
    }
  } catch (error) {
    console.error('Erro ao iniciar conversa:', error)
    toast.error('Erro ao iniciar conversa')
  } finally {
    isSubmittingStart.value = false
    startingConversation.value = null
  }
}

// Handlers para exportacao/importacao Excel
const exportData = computed(() => {
  return contacts.value.map(contact => ({
    Nome: contact.customName || contact.name || '',
    'Número': contact.identifier,
    Provedor: contact.provider,
    Tags: (contact.tags || []).join(', '),
    'Última Mensagem': contact.lastMessage || '',
    'Última Atividade': contact.lastMessageAt ? new Date(contact.lastMessageAt).toLocaleString('pt-BR') : '',
  }))
})

async function handleImport(data: any[]) {
  const validContacts = data.filter(row => row['Número'] || row.numero || row.identifier)

  if (validContacts.length === 0) {
    toast.error('Nenhum contato válido encontrado no arquivo')
    return
  }

  let created = 0
  let failed = 0

  for (const row of validContacts) {
    try {
      const identifier = row['Número'] || row.numero || row.identifier
      const name = row.Nome || row.name || ''
      const provider = row.Provedor || row.provider || 'whatsapp'
      const tagsStr = row.Tags || row.tags || ''
      const tags = tagsStr ? tagsStr.split(',').map((t: string) => t.trim()).filter(Boolean) : []

      await contactsApi.create({
        identifier,
        name,
        provider,
        tags,
      })
      created++
    } catch (error) {
      console.error('Erro ao criar contato:', error)
      failed++
    }
  }

  if (created > 0) {
    toast.success(`${created} contato(s) importado(s) com sucesso!`)
    fetchContacts()
  }

  if (failed > 0) {
    toast.warning(`${failed} contato(s) falharam ao importar (podem já existir)`)
  }
}

onMounted(() => {
  fetchContacts()
  fetchTags()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header com gradiente -->
    <div class="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white shadow-lg">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div class="flex items-center gap-3 mb-2">
            <div class="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Users class="w-6 h-6" />
            </div>
            <h1 class="text-2xl font-bold">Contatos</h1>
          </div>
          <p class="text-primary-100">Sempre que um número novo entrar em contato ele será listado aqui.</p>
        </div>
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <button
            @click="showCreateModal = true"
            class="bg-white text-primary-600 px-4 py-2 rounded-lg font-medium hover:bg-white/90 transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus class="w-5 h-5" />
            <span>Novo Contato</span>
          </button>
          <ExcelActions
            :data="exportData"
            :export-options="{
              filename: 'contatos.xlsx',
              sheetName: 'Contatos'
            }"
            :on-import="handleImport"
          />
          <div class="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
            </span>
            <span class="text-sm font-medium">Atualizado em tempo real</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Barra de pesquisa -->
    <div class="card card-body shadow-sm">
      <div class="flex flex-col sm:flex-row gap-4">
        <div class="flex-1 relative">
          <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            v-model="search"
            @input="handleSearch"
            type="text"
            placeholder="Buscar por nome ou número..."
            class="input pl-12 py-3 text-base bg-gray-50 border-gray-200 focus:bg-white transition-colors"
          />
        </div>
        <div class="flex items-center gap-2 text-sm text-gray-500 px-4 py-2 bg-gray-50 rounded-lg">
          <User class="w-4 h-4" />
          <span class="font-medium">{{ pagination.total }}</span>
          <span>contatos</span>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-16">
      <div class="text-center">
        <LoadingSpinner size="lg" />
        <p class="mt-4 text-gray-500">Carregando contatos...</p>
      </div>
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else-if="contacts.length === 0"
      title="Nenhum contato encontrado"
      description="Os contatos serão listados assim que alguém iniciar uma conversa."
    >
      <template #icon>
        <div class="p-4 bg-gray-100 rounded-full">
          <Users class="w-8 h-8 text-gray-400" />
        </div>
      </template>
    </EmptyState>

    <!-- Lista de contatos -->
    <div v-else class="card overflow-hidden shadow-sm">
      <div class="table-container">
        <table class="table">
          <thead class="bg-gray-50">
            <tr>
              <th class="font-semibold text-gray-700">
                <div class="flex items-center gap-2">
                  <User class="w-4 h-4 text-gray-400" />
                  Contato
                </div>
              </th>
              <th class="font-semibold text-gray-700">
                <div class="flex items-center gap-2">
                  <Phone class="w-4 h-4 text-gray-400" />
                  Número
                </div>
              </th>
              <th class="font-semibold text-gray-700">Provedor</th>
              <th class="font-semibold text-gray-700">
                <div class="flex items-center gap-2">
                  <Tag class="w-4 h-4 text-gray-400" />
                  Tags
                </div>
              </th>
              <th class="font-semibold text-gray-700">
                <div class="flex items-center gap-2">
                  <MessageSquare class="w-4 h-4 text-gray-400" />
                  Última mensagem
                </div>
              </th>
              <th class="font-semibold text-gray-700">
                <div class="flex items-center gap-2">
                  <Clock class="w-4 h-4 text-gray-400" />
                  Última atividade
                </div>
              </th>
              <th class="font-semibold text-gray-700 text-right">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="contact in contacts"
              :key="contact._id"
              class="hover:bg-gray-50/50 transition-colors"
            >
              <td>
                <div class="flex items-center gap-3">
                  <div
                    :class="[
                      'w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm',
                      getAvatarColor(contact.identifier)
                    ]"
                  >
                    {{ getInitials(contact) }}
                  </div>
                  <div>
                    <p class="font-semibold text-gray-900">{{ contact.customName || contact.name || 'Sem nome' }}</p>
                    <p class="text-xs text-gray-400 mt-0.5">ID: {{ contact.identifier.slice(-8) }}</p>
                  </div>
                </div>
              </td>
              <td>
                <span class="inline-flex items-center gap-1.5 text-sm text-gray-600 font-mono bg-gray-100 px-2.5 py-1 rounded-md">
                  {{ contact.identifier }}
                </span>
              </td>
              <td>
                <span
                  v-if="contact.provider === 'whatsapp'"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"
                >
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </span>
                <span
                  v-else
                  class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 capitalize"
                >
                  {{ contact.provider }}
                </span>
              </td>
              <td>
                <div class="flex flex-wrap gap-1 max-w-[200px]">
                  <span
                    v-for="tagName in (contact.tags || []).slice(0, 3)"
                    :key="tagName"
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                    :style="{ backgroundColor: getTagColor(tagName) }"
                  >
                    {{ tagName }}
                  </span>
                  <span
                    v-if="(contact.tags || []).length > 3"
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600"
                  >
                    +{{ (contact.tags || []).length - 3 }}
                  </span>
                  <span v-if="!contact.tags || contact.tags.length === 0" class="text-sm text-gray-400 italic">
                    Sem tags
                  </span>
                </div>
              </td>
              <td>
                <p
                  v-if="contact.lastMessage"
                  class="text-sm text-gray-600 max-w-xs truncate"
                  :title="contact.lastMessage"
                >
                  {{ contact.lastMessage }}
                </p>
                <span v-else class="text-sm text-gray-400 italic">Nenhuma mensagem</span>
              </td>
              <td>
                <div class="flex items-center gap-2">
                  <span
                    :class="[
                      'w-2 h-2 rounded-full',
                      isRecentActivity(contact.lastMessageAt) ? 'bg-green-500' : 'bg-gray-300'
                    ]"
                  ></span>
                  <span
                    :class="[
                      'text-sm',
                      isRecentActivity(contact.lastMessageAt) ? 'text-gray-700 font-medium' : 'text-gray-500'
                    ]"
                  >
                    {{ formatRelative(contact.lastMessageAt) }}
                  </span>
                </div>
              </td>
              <td class="text-right">
                <div class="flex items-center justify-end gap-1">
                  <button
                    @click="startConversation(contact)"
                    :disabled="startingConversation === contact._id"
                    class="p-2 rounded-lg hover:bg-green-50 text-gray-500 hover:text-green-600 transition-colors disabled:opacity-50"
                    title="Iniciar conversa"
                  >
                    <MessageCircle v-if="startingConversation !== contact._id" class="w-4 h-4" />
                    <LoadingSpinner v-else size="sm" />
                  </button>
                  <button
                    @click="openEditModal(contact)"
                    class="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary-600 transition-colors"
                    title="Editar contato"
                  >
                    <Pencil class="w-4 h-4" />
                  </button>
                  <button
                    @click="openDeleteModal(contact)"
                    class="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
                    title="Deletar contato"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="border-t border-gray-100">
        <Pagination
          :pagination="pagination"
          @page-change="handlePageChange"
        />
      </div>
    </div>

    <!-- Modal de Edicao de Contato -->
    <EditContactModal
      v-if="showEditModal && selectedContact"
      :contact="selectedContact"
      @close="closeEditModal"
      @saved="handleContactSaved"
    />

    <!-- Modal de Criacao de Contato -->
    <CreateContactModal
      v-if="showCreateModal"
      @close="showCreateModal = false"
      @created="handleContactCreated"
    />

    <!-- Modal de Confirmacao de Exclusao -->
    <Teleport to="body">
      <div
        v-if="showDeleteModal && contactToDelete"
        class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        @click.self="closeDeleteModal"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
          <div class="p-6">
            <div class="flex items-center gap-4 mb-4">
              <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 class="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 class="text-lg font-semibold text-gray-900">Deletar contato</h2>
                <p class="text-sm text-gray-500">Esta ação não pode ser desfeita</p>
              </div>
            </div>

            <div class="bg-gray-50 rounded-lg p-4 mb-4">
              <p class="text-sm text-gray-700 mb-2">Você está prestes a deletar o contato:</p>
              <p class="font-medium text-gray-900">
                {{ contactToDelete.customName || contactToDelete.name || contactToDelete.identifier }}
              </p>
              <p class="text-sm text-gray-500 font-mono">{{ contactToDelete.identifier }}</p>
            </div>

            <p class="text-sm text-gray-600 mb-6">
              Todos os dados associados a este contato serão removidos permanentemente.
              Tem certeza que deseja continuar?
            </p>

            <div class="flex gap-3">
              <button
                @click="closeDeleteModal"
                :disabled="isDeletingContact"
                class="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                @click="confirmDelete"
                :disabled="isDeletingContact"
                class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {{ isDeletingContact ? 'Deletando...' : 'Deletar Contato' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal de Inicio de Conversa -->
    <div
      v-if="showStartModal && startContact"
      class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      @click.self="closeStartModal"
    >
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div class="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">Iniciar conversa</h2>
            <p class="text-xs text-gray-500">
              {{ startContact.customName || startContact.name || startContact.identifier }}
            </p>
          </div>
          <button @click="closeStartModal" class="p-2 rounded-lg hover:bg-gray-100">
            <X class="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div class="p-4 space-y-4">
          <div v-if="startContact.provider === 'whatsapp'">
            <label class="label">Sessao WhatsApp</label>
            <select
              v-model="selectedInstanceId"
              class="select"
              :disabled="isLoadingStartOptions || startInstances.length === 0"
            >
              <option value="" disabled>Selecione uma sessao</option>
              <option
                v-for="instance in startInstances"
                :key="instance.id"
                :value="instance.id"
              >
                {{ instance.name }} {{ instance.connected ? '(conectada)' : '(desconectada)' }}
              </option>
            </select>
            <p v-if="!isLoadingStartOptions && startInstances.length === 0" class="text-xs text-red-500 mt-1">
              Nenhuma sessao WhatsApp encontrada.
            </p>
          </div>

          <div>
            <label class="label">Operador</label>
            <div class="input bg-gray-50 text-sm text-gray-700">
              {{ selectedOperator?.name || 'Operador nao identificado' }}
            </div>
            <p v-if="!selectedOperator" class="text-xs text-red-500 mt-1">
              Nao foi possivel identificar o operador logado.
            </p>
          </div>
        </div>

        <div class="flex gap-3 p-4 border-t border-gray-200">
          <button
            type="button"
            @click="closeStartModal"
            class="btn-secondary flex-1"
            :disabled="isSubmittingStart"
          >
            Cancelar
          </button>
          <button
            type="button"
            @click="confirmStartConversation"
            class="btn-primary flex-1 justify-center"
            :disabled="isSubmittingStart || isLoadingStartOptions"
          >
            <LoadingSpinner v-if="isSubmittingStart" size="sm" />
            <span v-else>Iniciar</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
