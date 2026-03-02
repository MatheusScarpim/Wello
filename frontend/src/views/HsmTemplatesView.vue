<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { FileText, Plus, RefreshCw, Send, Trash2, Edit3, Eye, Search, X } from 'lucide-vue-next'
import { hsmTemplatesApi, whatsappInstancesApi } from '@/api'
import Pagination from '@/components/ui/Pagination.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const toast = useToast()

const templates = ref<any[]>([])
const instances = ref<any[]>([])
const loading = ref(false)
const saving = ref(false)
const syncing = ref(false)
const pagination = ref({ total: 0, page: 1, pageSize: 10, totalPages: 1 })

// Filtros
const searchQuery = ref('')
const filterStatus = ref('')
const filterCategory = ref('')
const filterInstance = ref('')

// Modal
const showModal = ref(false)
const editingTemplate = ref<any>(null)
const form = ref({
  name: '',
  category: 'marketing' as 'marketing' | 'utility' | 'authentication',
  language: 'pt_BR',
  instanceId: '',
  wabaId: '',
  components: [] as any[],
  variables: [] as any[],
  headerType: 'none',
  headerText: '',
  headerMediaUrl: '',
  bodyText: '',
  footerText: '',
  buttonsType: 'none',
  buttons: [] as any[],
})

// Confirm modals
const showDeleteModal = ref(false)
const showSubmitModal = ref(false)
const targetTemplate = ref<any>(null)

// Preview
const showPreview = ref(false)
const previewTemplate = ref<any>(null)

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }
  return map[status] || 'bg-gray-100 text-gray-700'
}

const statusLabel = (status: string) => {
  const map: Record<string, string> = { draft: 'Rascunho', pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado' }
  return map[status] || status
}

const categoryLabel = (cat: string) => {
  const map: Record<string, string> = { marketing: 'Marketing', utility: 'Utilidade', authentication: 'Autenticação' }
  return map[cat] || cat
}

const categoryBadge = (cat: string) => {
  const map: Record<string, string> = { marketing: 'bg-blue-100 text-blue-700', utility: 'bg-purple-100 text-purple-700', authentication: 'bg-orange-100 text-orange-700' }
  return map[cat] || 'bg-gray-100 text-gray-700'
}

const metaInstances = computed(() => instances.value.filter((i: any) => i.connectionType === 'meta_official'))

async function fetchTemplates() {
  loading.value = true
  try {
    const params: any = { page: pagination.value.page, limit: pagination.value.pageSize }
    if (filterStatus.value) params.status = filterStatus.value
    if (filterCategory.value) params.category = filterCategory.value
    if (filterInstance.value) params.instanceId = filterInstance.value

    const res = await hsmTemplatesApi.list(params)
    const data = (res as any).data || {}
    templates.value = data.data || []
    pagination.value = {
      total: data.total || 0,
      page: data.page || 1,
      pageSize: data.pageSize || 10,
      totalPages: data.totalPages || 1,
    }
  } catch {
    toast.error('Erro ao carregar templates')
  } finally {
    loading.value = false
  }
}

async function fetchInstances() {
  try {
    const res = await whatsappInstancesApi.list()
    if ((res as any).data) instances.value = (res as any).data
  } catch { /* ignore */ }
}

function openCreateModal() {
  editingTemplate.value = null
  form.value = { name: '', category: 'marketing', language: 'pt_BR', instanceId: '', wabaId: '', components: [], variables: [], headerType: 'none', headerText: '', headerMediaUrl: '', bodyText: '', footerText: '', buttonsType: 'none', buttons: [] }
  showModal.value = true
}

function openEditModal(template: any) {
  editingTemplate.value = template
  const header = template.components?.find((c: any) => c.type === 'HEADER')
  const body = template.components?.find((c: any) => c.type === 'BODY')
  const footer = template.components?.find((c: any) => c.type === 'FOOTER')
  const btns = template.components?.find((c: any) => c.type === 'BUTTONS')

  form.value = {
    name: template.name,
    category: template.category,
    language: template.language,
    instanceId: template.instanceId || '',
    wabaId: template.wabaId || '',
    components: template.components || [],
    variables: template.variables || [],
    headerType: header ? (header.format?.toLowerCase() || 'text') : 'none',
    headerText: header?.text || '',
    headerMediaUrl: '',
    bodyText: body?.text || '',
    footerText: footer?.text || '',
    buttonsType: btns?.buttons?.length ? (btns.buttons[0].type === 'QUICK_REPLY' ? 'quick_reply' : 'call_to_action') : 'none',
    buttons: btns?.buttons || [],
  }
  showModal.value = true
}

function buildComponents() {
  const components: any[] = []
  if (form.value.headerType !== 'none') {
    const header: any = { type: 'HEADER', format: form.value.headerType.toUpperCase() }
    if (form.value.headerType === 'text') header.text = form.value.headerText
    components.push(header)
  }
  if (form.value.bodyText) {
    components.push({ type: 'BODY', text: form.value.bodyText })
  }
  if (form.value.footerText) {
    components.push({ type: 'FOOTER', text: form.value.footerText })
  }
  if (form.value.buttonsType !== 'none' && form.value.buttons.length > 0) {
    components.push({ type: 'BUTTONS', buttons: form.value.buttons })
  }
  return components
}

function extractVariables() {
  const matches = form.value.bodyText.match(/\{\{(\d+)\}\}/g) || []
  return matches.map((m: string, i: number) => ({ key: m.replace(/[{}]/g, ''), example: '', position: i + 1 }))
}

async function saveTemplate() {
  if (!form.value.name || !form.value.bodyText) {
    toast.warning('Nome e corpo da mensagem são obrigatórios')
    return
  }
  saving.value = true
  try {
    const payload = {
      name: form.value.name,
      category: form.value.category,
      language: form.value.language,
      instanceId: form.value.instanceId || undefined,
      wabaId: form.value.wabaId || undefined,
      components: buildComponents(),
      variables: extractVariables(),
    }

    if (editingTemplate.value) {
      await hsmTemplatesApi.update(editingTemplate.value._id, payload)
      toast.success('Template atualizado')
    } else {
      await hsmTemplatesApi.create(payload)
      toast.success('Template criado')
    }
    showModal.value = false
    fetchTemplates()
  } catch {
    toast.error('Erro ao salvar template')
  } finally {
    saving.value = false
  }
}

function addButton() {
  if (form.value.buttons.length >= 3) return
  if (form.value.buttonsType === 'quick_reply') {
    form.value.buttons.push({ type: 'QUICK_REPLY', text: '' })
  } else {
    form.value.buttons.push({ type: 'URL', text: '', url: '' })
  }
}

function removeButton(index: number) {
  form.value.buttons.splice(index, 1)
}

async function confirmDelete() {
  if (!targetTemplate.value) return
  try {
    await hsmTemplatesApi.delete(targetTemplate.value._id)
    toast.success('Template removido')
    showDeleteModal.value = false
    fetchTemplates()
  } catch {
    toast.error('Erro ao remover template')
  }
}

async function confirmSubmit() {
  if (!targetTemplate.value) return
  try {
    await hsmTemplatesApi.submitToMeta(targetTemplate.value._id)
    toast.success('Template enviado para aprovação no Meta')
    showSubmitModal.value = false
    fetchTemplates()
  } catch {
    toast.error('Erro ao submeter template')
  }
}

async function syncTemplates() {
  if (!filterInstance.value) {
    toast.warning('Selecione uma instância Meta para sincronizar')
    return
  }
  syncing.value = true
  try {
    const res = await hsmTemplatesApi.syncFromMeta(filterInstance.value)
    const data = (res as any).data || {}
    toast.success(`${data.synced || 0} templates sincronizados`)
    fetchTemplates()
  } catch {
    toast.error('Erro ao sincronizar templates do Meta')
  } finally {
    syncing.value = false
  }
}

function onPageChange(page: number) {
  pagination.value.page = page
  fetchTemplates()
}

const filteredTemplates = computed(() => {
  if (!searchQuery.value) return templates.value
  const q = searchQuery.value.toLowerCase()
  return templates.value.filter((t: any) => t.name?.toLowerCase().includes(q))
})

// Preview do template
const previewText = computed(() => {
  let text = ''
  if (form.value.headerType === 'text' && form.value.headerText) {
    text += `*${form.value.headerText}*\n\n`
  }
  if (form.value.bodyText) text += form.value.bodyText
  if (form.value.footerText) text += `\n\n_${form.value.footerText}_`
  return text
})

onMounted(() => {
  fetchTemplates()
  fetchInstances()
})
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Templates HSM</h1>
        <p class="text-sm text-gray-500 mt-1">Gerencie seus templates de mensagem para a API oficial do WhatsApp</p>
      </div>
      <div class="flex gap-2">
        <button
          @click="syncTemplates"
          :disabled="syncing || !filterInstance"
          class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': syncing }" />
          Sincronizar do Meta
        </button>
        <button
          @click="openCreateModal"
          class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
        >
          <Plus class="w-4 h-4" />
          Novo Template
        </button>
      </div>
    </div>

    <!-- Filtros -->
    <div class="flex flex-wrap gap-3 mb-6">
      <div class="relative flex-1 min-w-[200px]">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar por nome..."
          class="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>
      <select v-model="filterStatus" @change="fetchTemplates()" class="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
        <option value="">Todos os status</option>
        <option value="draft">Rascunho</option>
        <option value="pending">Pendente</option>
        <option value="approved">Aprovado</option>
        <option value="rejected">Rejeitado</option>
      </select>
      <select v-model="filterCategory" @change="fetchTemplates()" class="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
        <option value="">Todas categorias</option>
        <option value="marketing">Marketing</option>
        <option value="utility">Utilidade</option>
        <option value="authentication">Autenticação</option>
      </select>
      <select v-model="filterInstance" @change="fetchTemplates()" class="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
        <option value="">Todas instâncias</option>
        <option v-for="inst in metaInstances" :key="inst.id || inst._id" :value="inst.id || inst._id">{{ inst.name }}</option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Empty state -->
    <EmptyState
      v-else-if="filteredTemplates.length === 0"
      title="Nenhum template encontrado"
      description="Crie um novo template ou sincronize do Meta"
      :icon="FileText"
    />

    <!-- Table -->
    <div v-else class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nome</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Categoria</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Idioma</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
            <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Ações</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="template in filteredTemplates" :key="template._id" class="hover:bg-gray-50">
            <td class="px-4 py-3">
              <div class="font-medium text-gray-900">{{ template.name }}</div>
              <div v-if="template.metaTemplateName" class="text-xs text-gray-400">{{ template.metaTemplateName }}</div>
            </td>
            <td class="px-4 py-3">
              <span :class="categoryBadge(template.category)" class="px-2 py-0.5 text-xs font-medium rounded-full">
                {{ categoryLabel(template.category) }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">{{ template.language }}</td>
            <td class="px-4 py-3">
              <span :class="statusBadge(template.status)" class="px-2 py-0.5 text-xs font-medium rounded-full">
                {{ statusLabel(template.status) }}
              </span>
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex items-center justify-end gap-1">
                <button @click="previewTemplate = template; showPreview = true" class="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50" title="Preview">
                  <Eye class="w-4 h-4" />
                </button>
                <button @click="openEditModal(template)" class="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50" title="Editar">
                  <Edit3 class="w-4 h-4" />
                </button>
                <button
                  v-if="template.status === 'draft'"
                  @click="targetTemplate = template; showSubmitModal = true"
                  class="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50"
                  title="Submeter ao Meta"
                >
                  <Send class="w-4 h-4" />
                </button>
                <button @click="targetTemplate = template; showDeleteModal = true" class="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50" title="Remover">
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="pagination.totalPages > 1" class="mt-4">
      <Pagination :total="pagination.total" :page="pagination.page" :page-size="pagination.pageSize" :total-pages="pagination.totalPages" @page-change="onPageChange" />
    </div>

    <!-- Create/Edit Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="showModal = false">
        <div class="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">{{ editingTemplate ? 'Editar Template' : 'Novo Template' }}</h2>
            <button @click="showModal = false" class="p-2 rounded-lg hover:bg-gray-100"><X class="w-5 h-5 text-gray-400" /></button>
          </div>

          <div class="p-6 space-y-5">
            <!-- Informações básicas -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input v-model="form.name" type="text" placeholder="nome_do_template" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <select v-model="form.category" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
                  <option value="marketing">Marketing</option>
                  <option value="utility">Utilidade</option>
                  <option value="authentication">Autenticação</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Idioma</label>
                <select v-model="form.language" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
                  <option value="pt_BR">Português (BR)</option>
                  <option value="en_US">English (US)</option>
                  <option value="es">Español</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Instância Meta</label>
                <select v-model="form.instanceId" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
                  <option value="">Selecione...</option>
                  <option v-for="inst in metaInstances" :key="inst.id || inst._id" :value="inst.id || inst._id">{{ inst.name }}</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">WABA ID</label>
              <input v-model="form.wabaId" type="text" placeholder="ID da conta WhatsApp Business" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>

            <!-- Header -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Header (opcional)</label>
              <select v-model="form.headerType" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 mb-2">
                <option value="none">Nenhum</option>
                <option value="text">Texto</option>
                <option value="image">Imagem</option>
                <option value="video">Vídeo</option>
                <option value="document">Documento</option>
              </select>
              <input v-if="form.headerType === 'text'" v-model="form.headerText" type="text" placeholder="Texto do header" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
            </div>

            <!-- Body -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Corpo da Mensagem *</label>
              <textarea v-model="form.bodyText" rows="4" placeholder="Olá {{1}}, sua compra {{2}} foi confirmada!" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"></textarea>
              <p class="text-xs text-gray-400 mt-1">Use <span v-pre>{{1}}</span>, <span v-pre>{{2}}</span> para variáveis</p>
            </div>

            <!-- Footer -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Footer (opcional)</label>
              <input v-model="form.footerText" type="text" maxlength="60" placeholder="Texto do rodapé (máx 60 chars)" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
            </div>

            <!-- Buttons -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Botões (opcional)</label>
              <select v-model="form.buttonsType" @change="form.buttons = []" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 mb-2">
                <option value="none">Nenhum</option>
                <option value="quick_reply">Resposta Rápida</option>
                <option value="call_to_action">Call to Action</option>
              </select>

              <div v-if="form.buttonsType !== 'none'" class="space-y-2">
                <div v-for="(btn, i) in form.buttons" :key="i" class="flex gap-2 items-center">
                  <input v-model="btn.text" type="text" placeholder="Texto do botão" class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg" />
                  <input v-if="btn.type === 'URL'" v-model="btn.url" type="text" placeholder="URL" class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg" />
                  <input v-if="btn.type === 'PHONE_NUMBER'" v-model="btn.phoneNumber" type="text" placeholder="Telefone" class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg" />
                  <button @click="removeButton(i)" class="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 class="w-4 h-4" /></button>
                </div>
                <button v-if="form.buttons.length < 3" @click="addButton" class="text-sm text-primary-600 hover:text-primary-700 font-medium">+ Adicionar botão</button>
              </div>
            </div>

            <!-- Preview -->
            <div class="bg-gray-50 rounded-xl p-4">
              <p class="text-xs font-semibold text-gray-500 uppercase mb-2">Preview</p>
              <div class="bg-white rounded-lg p-3 shadow-sm border border-gray-200 max-w-sm">
                <p class="text-sm whitespace-pre-wrap">{{ previewText || 'Preencha o corpo da mensagem...' }}</p>
                <div v-if="form.buttons.length > 0" class="mt-2 pt-2 border-t border-gray-100 space-y-1">
                  <div v-for="(btn, i) in form.buttons" :key="i" class="text-center text-sm text-blue-600 font-medium py-1">{{ btn.text || 'Botão' }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-3 p-6 border-t border-gray-200">
            <button @click="showModal = false" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button @click="saveTemplate" :disabled="saving" class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {{ saving ? 'Salvando...' : (editingTemplate ? 'Atualizar' : 'Criar') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Preview Modal -->
    <Teleport to="body">
      <div v-if="showPreview && previewTemplate" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="showPreview = false">
        <div class="bg-white rounded-2xl w-full max-w-md p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold">{{ previewTemplate.name }}</h3>
            <button @click="showPreview = false" class="p-2 rounded-lg hover:bg-gray-100"><X class="w-5 h-5 text-gray-400" /></button>
          </div>
          <div class="bg-[#e5ddd5] rounded-xl p-4">
            <div class="bg-white rounded-lg p-3 shadow-sm max-w-[280px]">
              <div v-for="comp in previewTemplate.components" :key="comp.type">
                <p v-if="comp.type === 'HEADER' && comp.text" class="font-bold text-sm mb-1">{{ comp.text }}</p>
                <p v-if="comp.type === 'BODY'" class="text-sm whitespace-pre-wrap">{{ comp.text }}</p>
                <p v-if="comp.type === 'FOOTER'" class="text-xs text-gray-400 mt-2">{{ comp.text }}</p>
              </div>
              <div v-if="previewTemplate.components?.find((c: any) => c.type === 'BUTTONS')" class="mt-2 pt-2 border-t border-gray-100">
                <div v-for="(btn, i) in previewTemplate.components.find((c: any) => c.type === 'BUTTONS')?.buttons || []" :key="i" class="text-center text-sm text-blue-600 font-medium py-1">{{ btn.text }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirm -->
    <ConfirmModal
      v-if="showDeleteModal"
      title="Remover Template"
      message="Tem certeza que deseja remover este template? Esta ação não pode ser desfeita."
      confirm-text="Remover"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false"
    />

    <!-- Submit Confirm -->
    <ConfirmModal
      v-if="showSubmitModal"
      title="Submeter ao Meta"
      message="Deseja enviar este template para aprovação do Meta/WhatsApp?"
      confirm-text="Submeter"
      @confirm="confirmSubmit"
      @cancel="showSubmitModal = false"
    />
  </div>
</template>
