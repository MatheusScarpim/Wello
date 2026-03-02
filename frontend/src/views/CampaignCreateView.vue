<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import { ArrowLeft, ArrowRight, Check, Smartphone, Globe, Users, Settings, Search, Upload, X, Download, FileSpreadsheet, Trash2 } from 'lucide-vue-next'
import * as XLSX from 'xlsx'
import { campaignsApi, hsmTemplatesApi, whatsappInstancesApi, contactsApi, tagsApi, storageApi } from '@/api'

const router = useRouter()
const route = useRoute()
const toast = useToast()

const isEditing = computed(() => !!route.params.id)
const campaignId = computed(() => route.params.id as string)
const loading = ref(false)
const saving = ref(false)
const currentStep = ref(1)
const totalSteps = 4

// Form data
const form = ref({
  name: '',
  description: '',
  type: 'unofficial' as 'official' | 'unofficial',
  instanceId: '',
  instanceName: '',
  templateId: '',
  message: '',
  mediaUrl: '',
  mediaType: '',
  contactListType: 'manual' as 'all' | 'tags' | 'manual' | 'import',
  contactIds: [] as string[],
  tags: [] as string[],
  delayMs: 3000,
  scheduledAt: '',
  scheduleEnabled: false,
})

// Data
const instances = ref<any[]>([])
const allTags = ref<any[]>([])
const contacts = ref<any[]>([])
const hsmTemplates = ref<any[]>([])
const selectedTemplate = ref<any>(null)
const contactSearch = ref('')
const selectedContacts = ref<Set<string>>(new Set())
const manualNumbers = ref('')
const importMode = ref<'paste' | 'spreadsheet'>('spreadsheet')
const importedContacts = ref<{ phone: string; name: string }[]>([])
const importFileName = ref('')
const importFileInput = ref<HTMLInputElement | null>(null)
const mediaSource = ref<'url' | 'upload'>('upload')
const uploading = ref(false)
const uploadedFileName = ref('')

// Variable insertion
const messageTextareaRef = ref<HTMLTextAreaElement | null>(null)
const availableVariables = [
  { key: '{{nome}}', label: 'nome', description: 'Nome do contato' },
  { key: '{{telefone}}', label: 'telefone', description: 'Telefone do contato' },
  { key: '{{email}}', label: 'email', description: 'Email do contato' },
  { key: '{{empresa}}', label: 'empresa', description: 'Empresa do contato' },
]

function insertVariable(variable: string) {
  const textarea = messageTextareaRef.value
  if (!textarea) return

  const start = textarea.selectionStart ?? form.value.message.length
  const end = textarea.selectionEnd ?? start
  const before = form.value.message.substring(0, start)
  const after = form.value.message.substring(end)

  form.value.message = before + variable + after

  // Restore cursor position after the inserted variable
  const newCursorPos = start + variable.length
  nextTick(() => {
    textarea.focus()
    textarea.setSelectionRange(newCursorPos, newCursorPos)
  })
}

// Computed for message preview with highlighted variables
const messagePreviewHtml = computed(() => {
  if (!form.value.message) return ''
  // Escape HTML entities first
  const escaped = form.value.message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
  // Highlight variables with a colored span
  return escaped.replace(
    /\{\{(nome|telefone|email|empresa)\}\}/g,
    '<span class="bg-primary-100 text-primary-700 px-0.5 rounded font-medium">{{$1}}</span>'
  )
})

// Computed
const filteredInstances = computed(() => {
  if (form.value.type === 'official') {
    return instances.value.filter((i: any) => i.connectionType === 'meta_official')
  }
  return instances.value.filter((i: any) => i.connectionType !== 'meta_official')
})

const filteredContacts = computed(() => {
  if (!contactSearch.value) return contacts.value
  const q = contactSearch.value.toLowerCase()
  return contacts.value.filter((c: any) =>
    c.name?.toLowerCase().includes(q) || c.identifier?.includes(q)
  )
})

const selectedContactCount = computed(() => {
  switch (form.value.contactListType) {
    case 'all': return contacts.value.length
    case 'tags': return contacts.value.filter((c: any) => c.tags?.some((t: string) => form.value.tags.includes(t))).length
    case 'manual': return selectedContacts.value.size
    case 'import': return importMode.value === 'spreadsheet'
      ? importedContacts.value.length
      : manualNumbers.value.split('\n').filter(Boolean).length
    default: return 0
  }
})

// Step validation
const canProceed = computed(() => {
  switch (currentStep.value) {
    case 1: return form.value.name && form.value.type && form.value.instanceId
    case 2:
      if (form.value.type === 'official') return !!form.value.templateId
      return !!form.value.message
    case 3: return selectedContactCount.value > 0
    case 4: return true
    default: return false
  }
})

// Methods
async function fetchData() {
  try {
    const [instRes, tagsRes, contactsRes] = await Promise.all([
      whatsappInstancesApi.list(),
      tagsApi.list(),
      contactsApi.list({ limit: 500 }),
    ])
    if ((instRes as any).data) instances.value = (instRes as any).data
    if ((tagsRes as any).data) allTags.value = (tagsRes as any).data
    if ((contactsRes as any).data) {
      const d = (contactsRes as any).data
      contacts.value = d.items || d.data || d || []
    }
  } catch {
    toast.error('Erro ao carregar dados')
  }
}

async function fetchHsmTemplates() {
  if (form.value.type !== 'official' || !form.value.instanceId) return
  try {
    const res = await hsmTemplatesApi.list({ instanceId: form.value.instanceId, status: 'approved', limit: 100 })
    const data = (res as any).data || {}
    hsmTemplates.value = data.data || []
  } catch { /* ignore */ }
}

async function loadCampaign() {
  if (!isEditing.value) return
  loading.value = true
  try {
    const res = await campaignsApi.getById(campaignId.value)
    const campaign = (res as any).data
    if (campaign) {
      form.value = {
        name: campaign.name || '',
        description: campaign.description || '',
        type: campaign.type || 'unofficial',
        instanceId: campaign.instanceId || '',
        instanceName: campaign.instanceName || '',
        templateId: campaign.templateId || '',
        message: campaign.message || '',
        mediaUrl: campaign.mediaUrl || '',
        mediaType: campaign.mediaType || '',
        contactListType: campaign.contactListType || 'manual',
        contactIds: campaign.contactIds || [],
        tags: campaign.tags || [],
        delayMs: campaign.delayMs || 3000,
        scheduledAt: campaign.scheduledAt ? new Date(campaign.scheduledAt).toISOString().slice(0, 16) : '',
        scheduleEnabled: !!campaign.scheduledAt,
      }
      // Restore selected contacts
      if (campaign.contactIds?.length) {
        campaign.contactIds.forEach((id: string) => selectedContacts.value.add(id))
      }
    }
  } catch {
    toast.error('Erro ao carregar campanha')
  } finally {
    loading.value = false
  }
}

function selectInstance(inst: any) {
  form.value.instanceId = inst.id || inst._id
  form.value.instanceName = inst.name
}

function toggleContact(contactId: string) {
  if (selectedContacts.value.has(contactId)) {
    selectedContacts.value.delete(contactId)
  } else {
    selectedContacts.value.add(contactId)
  }
}

function selectAllContacts() {
  filteredContacts.value.forEach((c: any) => selectedContacts.value.add(c._id))
}

function deselectAllContacts() {
  selectedContacts.value.clear()
}

function toggleTag(tag: string) {
  const idx = form.value.tags.indexOf(tag)
  if (idx >= 0) form.value.tags.splice(idx, 1)
  else form.value.tags.push(tag)
}

function resolveContactIds(): string[] {
  switch (form.value.contactListType) {
    case 'all':
      return contacts.value.map((c: any) => c._id)
    case 'tags':
      return contacts.value
        .filter((c: any) => c.tags?.some((t: string) => form.value.tags.includes(t)))
        .map((c: any) => c._id)
    case 'manual':
      return Array.from(selectedContacts.value)
    case 'import':
      if (importMode.value === 'spreadsheet' && importedContacts.value.length > 0) {
        return importedContacts.value.map(c => c.phone)
      }
      return manualNumbers.value.split('\n').map((n: string) => n.trim()).filter(Boolean)
    default:
      return []
  }
}

function resolveImportedContacts(): { phone: string; name: string; variables: Record<string, string> }[] | undefined {
  if (form.value.contactListType !== 'import') return undefined
  if (importMode.value === 'spreadsheet' && importedContacts.value.length > 0) {
    return importedContacts.value.map(c => ({
      phone: c.phone,
      name: c.name,
      variables: { nome: c.name || '', telefone: c.phone || '' },
    }))
  }
  return undefined
}

function downloadTemplate() {
  const data = [
    { telefone: '5511999999999', nome: 'Joao' },
    { telefone: '5521988888888', nome: 'Maria' },
  ]
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Contatos')
  XLSX.writeFile(wb, 'modelo-contatos-campanha.xlsx')
}

function parseCSV(text: string): { phone: string; name: string }[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  const headerLine = lines[0]
  const delimiter = headerLine.includes(';') ? ';' : ','

  const parseLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"'
          i++
        } else if (ch === '"') {
          inQuotes = false
        } else {
          current += ch
        }
      } else {
        if (ch === '"') {
          inQuotes = true
        } else if (ch === delimiter) {
          result.push(current.trim())
          current = ''
        } else {
          current += ch
        }
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(headerLine).map(h => h.toLowerCase().replace(/["\s]/g, ''))
  const phoneIdx = headers.findIndex(h => ['numero', 'telefone', 'phone', 'celular', 'whatsapp'].includes(h))
  const nameIdx = headers.findIndex(h => ['nome', 'name', 'contato'].includes(h))

  if (phoneIdx === -1) return []

  const result: { phone: string; name: string }[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i])
    const phone = (cols[phoneIdx] || '').replace(/\D/g, '')
    const name = nameIdx >= 0 ? (cols[nameIdx] || '') : ''
    if (phone) {
      result.push({ phone, name })
    }
  }
  return result
}

function handleSpreadsheetUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  const ext = file.name.split('.').pop()?.toLowerCase()
  importFileName.value = file.name

  if (ext === 'csv') {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      if (parsed.length === 0) {
        toast.error('Nenhum contato encontrado. Verifique se a coluna A possui os telefones.')
        importFileName.value = ''
        return
      }
      importedContacts.value = parsed
      toast.success(`${parsed.length} contatos importados!`)
    }
    reader.readAsText(file)
  } else if (ext === 'xlsx' || ext === 'xls') {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' })

        if (jsonData.length === 0) {
          toast.error('Planilha vazia ou sem dados.')
          importFileName.value = ''
          return
        }

        const firstRow = jsonData[0]
        const keys = Object.keys(firstRow)
        const phoneKey = keys.find(k => ['numero', 'telefone', 'phone', 'celular', 'whatsapp'].includes(k.toLowerCase().trim()))
        const nameKey = keys.find(k => ['nome', 'name', 'contato'].includes(k.toLowerCase().trim()))

        if (!phoneKey) {
          toast.error('Coluna "telefone" nao encontrada na planilha. Use o modelo para referencia.')
          importFileName.value = ''
          return
        }

        const parsed: { phone: string; name: string }[] = []
        for (const row of jsonData) {
          const phone = String(row[phoneKey] || '').replace(/\D/g, '')
          const name = nameKey ? String(row[nameKey] || '') : ''
          if (phone) {
            parsed.push({ phone, name })
          }
        }

        if (parsed.length === 0) {
          toast.error('Nenhum contato valido encontrado na planilha.')
          importFileName.value = ''
          return
        }

        importedContacts.value = parsed
        toast.success(`${parsed.length} contatos importados!`)
      } catch {
        toast.error('Erro ao ler a planilha. Verifique se o formato e valido.')
        importFileName.value = ''
      }
    }
    reader.readAsArrayBuffer(file)
  } else {
    toast.error('Formato nao suportado. Use .csv, .xlsx ou .xls')
    importFileName.value = ''
  }

  if (importFileInput.value) {
    importFileInput.value.value = ''
  }
}

function clearImportedContacts() {
  importedContacts.value = []
  importFileName.value = ''
  if (importFileInput.value) {
    importFileInput.value.value = ''
  }
}

async function handleFileUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  uploading.value = true
  try {
    const res = await storageApi.uploadFile(file)
    const result = (res as any).data?.result || (res as any).data
    if (result?.url) {
      form.value.mediaUrl = result.url
      uploadedFileName.value = file.name
      toast.success('Arquivo enviado!')
    }
  } catch {
    toast.error('Erro ao enviar arquivo')
  } finally {
    uploading.value = false
  }
}

function removeUploadedFile() {
  form.value.mediaUrl = ''
  uploadedFileName.value = ''
}

async function saveCampaign(action: 'draft' | 'schedule' | 'start') {
  saving.value = true
  try {
    const payload: Record<string, any> = {
      name: form.value.name,
      description: form.value.description,
      type: form.value.type,
      instanceId: form.value.instanceId,
      instanceName: form.value.instanceName,
      templateId: form.value.templateId || undefined,
      message: form.value.message || undefined,
      mediaUrl: form.value.mediaUrl || undefined,
      mediaType: form.value.mediaType || undefined,
      contactListType: form.value.contactListType,
      contactIds: resolveContactIds(),
      tags: form.value.tags,
      delayMs: form.value.delayMs,
    }

    // Include imported contacts with names/variables for spreadsheet import
    const imported = resolveImportedContacts()
    if (imported) {
      payload.importedContacts = imported
    }

    let id = campaignId.value

    if (isEditing.value) {
      await campaignsApi.update(id, payload)
    } else {
      const res = await campaignsApi.create(payload)
      const created = (res as any).data
      id = created._id || created.id
    }

    if (action === 'schedule' && form.value.scheduledAt) {
      await campaignsApi.schedule(id, form.value.scheduledAt)
      toast.success('Campanha agendada!')
    } else if (action === 'start') {
      await campaignsApi.start(id)
      toast.success('Campanha iniciada!')
    } else {
      toast.success('Campanha salva como rascunho')
    }

    router.push(`/campaigns/${id}`)
  } catch (e: any) {
    toast.error(e?.response?.data?.error || 'Erro ao salvar campanha')
  } finally {
    saving.value = false
  }
}

watch(() => form.value.type, () => {
  form.value.templateId = ''
  form.value.instanceId = ''
  form.value.instanceName = ''
  selectedTemplate.value = null
})

watch(() => form.value.instanceId, () => {
  if (form.value.type === 'official') fetchHsmTemplates()
})

watch(() => form.value.templateId, () => {
  selectedTemplate.value = hsmTemplates.value.find((t: any) => t._id === form.value.templateId) || null
})

onMounted(async () => {
  await fetchData()
  if (isEditing.value) await loadCampaign()
})
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <button @click="router.push('/campaigns')" class="p-2 rounded-lg hover:bg-gray-100">
        <ArrowLeft class="w-5 h-5 text-gray-600" />
      </button>
      <div>
        <h1 class="text-2xl font-bold text-gray-900">{{ isEditing ? 'Editar Campanha' : 'Nova Campanha' }}</h1>
        <p class="text-sm text-gray-500">Passo {{ currentStep }} de {{ totalSteps }}</p>
      </div>
    </div>

    <!-- Stepper -->
    <div class="flex items-center mb-8">
      <div v-for="step in totalSteps" :key="step" class="flex items-center" :class="{ 'flex-1': step < totalSteps }">
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors"
          :class="step <= currentStep ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'"
        >
          <Check v-if="step < currentStep" class="w-4 h-4" />
          <span v-else>{{ step }}</span>
        </div>
        <div v-if="step < totalSteps" class="flex-1 h-1 mx-2 rounded" :class="step < currentStep ? 'bg-primary-600' : 'bg-gray-200'"></div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <div v-else class="bg-white rounded-xl border border-gray-200 p-6">
      <!-- Step 1: Informações Básicas -->
      <div v-if="currentStep === 1" class="space-y-5">
        <h2 class="text-lg font-semibold text-gray-900">Informações Básicas</h2>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Nome da campanha *</label>
          <input v-model="form.name" type="text" placeholder="Ex: Black Friday 2026" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
          <textarea v-model="form.description" rows="2" placeholder="Descrição opcional..." class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Tipo de campanha *</label>
          <div class="grid grid-cols-2 gap-3">
            <button
              @click="form.type = 'official'"
              class="p-4 rounded-xl border-2 text-left transition-colors"
              :class="form.type === 'official' ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-gray-300'"
            >
              <Globe class="w-6 h-6 mb-2" :class="form.type === 'official' ? 'text-primary-600' : 'text-gray-400'" />
              <p class="font-medium text-gray-900">Oficial (Meta API)</p>
              <p class="text-xs text-gray-500 mt-1">Usa templates HSM aprovados</p>
            </button>
            <button
              @click="form.type = 'unofficial'"
              class="p-4 rounded-xl border-2 text-left transition-colors"
              :class="form.type === 'unofficial' ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-gray-300'"
            >
              <Smartphone class="w-6 h-6 mb-2" :class="form.type === 'unofficial' ? 'text-primary-600' : 'text-gray-400'" />
              <p class="font-medium text-gray-900">Não-oficial (WPPConnect)</p>
              <p class="text-xs text-gray-500 mt-1">Mensagem livre de texto/mídia</p>
            </button>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Instância *</label>
          <div v-if="filteredInstances.length === 0" class="text-sm text-gray-400 py-4 text-center">
            Nenhuma instância {{ form.type === 'official' ? 'Meta Official' : 'WPPConnect' }} encontrada
          </div>
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              v-for="inst in filteredInstances"
              :key="inst.id || inst._id"
              @click="selectInstance(inst)"
              class="p-3 rounded-lg border-2 text-left transition-colors"
              :class="form.instanceId === (inst.id || inst._id) ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-gray-300'"
            >
              <p class="font-medium text-sm text-gray-900">{{ inst.name }}</p>
              <p class="text-xs text-gray-400">{{ inst.connectionType === 'meta_official' ? 'Meta Official' : 'WPPConnect' }}</p>
            </button>
          </div>
        </div>
      </div>

      <!-- Step 2: Mensagem -->
      <div v-if="currentStep === 2" class="space-y-5">
        <h2 class="text-lg font-semibold text-gray-900">Mensagem</h2>

        <!-- Official: Template selector -->
        <template v-if="form.type === 'official'">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Template HSM aprovado *</label>
            <select v-model="form.templateId" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
              <option value="">Selecione um template...</option>
              <option v-for="t in hsmTemplates" :key="t._id" :value="t._id">{{ t.name }} ({{ t.category }})</option>
            </select>
          </div>

          <div v-if="selectedTemplate" class="bg-[#e5ddd5] rounded-xl p-4">
            <p class="text-xs font-semibold text-gray-500 uppercase mb-2">Preview do template</p>
            <div class="bg-white rounded-lg p-3 shadow-sm max-w-[300px]">
              <div v-for="comp in selectedTemplate.components" :key="comp.type">
                <p v-if="comp.type === 'HEADER' && comp.text" class="font-bold text-sm mb-1">{{ comp.text }}</p>
                <p v-if="comp.type === 'BODY'" class="text-sm whitespace-pre-wrap">{{ comp.text }}</p>
                <p v-if="comp.type === 'FOOTER'" class="text-xs text-gray-400 mt-2">{{ comp.text }}</p>
              </div>
            </div>
          </div>
        </template>

        <!-- Unofficial: Free message -->
        <template v-else>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Mensagem *</label>
            <textarea
              ref="messageTextareaRef"
              v-model="form.message"
              rows="5"
              placeholder="Olá {{nome}}! Confira nossas ofertas..."
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            ></textarea>
            <!-- Variable insertion toolbar -->
            <div class="flex items-center gap-2 mt-2 flex-wrap">
              <span class="text-xs font-medium text-gray-500">Inserir variável:</span>
              <button
                v-for="v in availableVariables"
                :key="v.key"
                type="button"
                :title="v.description"
                @click="insertVariable(v.key)"
                class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 hover:border-primary-300 transition-colors cursor-pointer"
              >
                <span class="text-primary-400 text-[10px] leading-none">+</span>
                <span v-text="v.key"></span>
              </button>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Tipo de mídia (opcional)</label>
            <select v-model="form.mediaType" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
              <option value="">Sem mídia</option>
              <option value="image">Imagem</option>
              <option value="video">Vídeo</option>
              <option value="document">Documento</option>
              <option value="audio">Áudio</option>
            </select>
          </div>

          <div v-if="form.mediaType" class="space-y-3">
            <div class="flex gap-2">
              <button
                @click="mediaSource = 'upload'"
                class="px-3 py-1.5 text-sm rounded-lg border transition-colors"
                :class="mediaSource === 'upload' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'"
              >
                <Upload class="w-3.5 h-3.5 inline mr-1" />
                Enviar arquivo
              </button>
              <button
                @click="mediaSource = 'url'"
                class="px-3 py-1.5 text-sm rounded-lg border transition-colors"
                :class="mediaSource === 'url' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'"
              >
                <Globe class="w-3.5 h-3.5 inline mr-1" />
                Colar URL
              </button>
            </div>

            <!-- Upload -->
            <div v-if="mediaSource === 'upload'">
              <div v-if="!uploadedFileName" class="relative">
                <label class="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-colors">
                  <Upload class="w-6 h-6 text-gray-400 mb-1" />
                  <span class="text-sm text-gray-500">Clique para selecionar</span>
                  <span class="text-xs text-gray-400 mt-0.5">{{ form.mediaType === 'image' ? 'PNG, JPG, WebP' : form.mediaType === 'video' ? 'MP4, 3GP' : form.mediaType === 'audio' ? 'MP3, OGG, AAC' : 'PDF, DOC, XLS, etc.' }}</span>
                  <input
                    type="file"
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    :accept="form.mediaType === 'image' ? 'image/*' : form.mediaType === 'video' ? 'video/*' : form.mediaType === 'audio' ? 'audio/*' : '*'"
                    @change="handleFileUpload"
                    :disabled="uploading"
                  />
                </label>
                <div v-if="uploading" class="absolute inset-0 bg-white/80 rounded-lg flex items-center justify-center">
                  <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                </div>
              </div>
              <div v-else class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900 truncate">{{ uploadedFileName }}</p>
                  <p class="text-xs text-green-600">Arquivo enviado</p>
                </div>
                <button @click="removeUploadedFile" class="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-red-500">
                  <X class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- URL -->
            <div v-if="mediaSource === 'url'">
              <input v-model="form.mediaUrl" type="text" placeholder="https://..." class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          <!-- Preview -->
          <div v-if="form.message" class="bg-[#e5ddd5] rounded-xl p-4">
            <p class="text-xs font-semibold text-gray-500 uppercase mb-2">Preview</p>
            <div class="bg-white rounded-lg p-3 shadow-sm max-w-[300px]">
              <p class="text-sm whitespace-pre-wrap" v-html="messagePreviewHtml"></p>
            </div>
            <p class="text-xs text-gray-500 mt-2">As variáveis destacadas serão substituídas pelos dados de cada contato.</p>
          </div>
        </template>
      </div>

      <!-- Step 3: Contatos -->
      <div v-if="currentStep === 3" class="space-y-5">
        <h2 class="text-lg font-semibold text-gray-900">Contatos</h2>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            v-for="opt in [
              { value: 'all', label: 'Todos', desc: `${contacts.length} contatos` },
              { value: 'tags', label: 'Por Tags', desc: 'Filtrar por tags' },
              { value: 'manual', label: 'Seleção Manual', desc: 'Escolher contatos' },
              { value: 'import', label: 'Importar', desc: 'Planilha ou colar' },
            ]"
            :key="opt.value"
            @click="form.contactListType = opt.value as any"
            class="p-3 rounded-lg border-2 text-left transition-colors"
            :class="form.contactListType === opt.value ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-gray-300'"
          >
            <p class="font-medium text-sm text-gray-900">{{ opt.label }}</p>
            <p class="text-xs text-gray-500">{{ opt.desc }}</p>
          </button>
        </div>

        <!-- Tags selector -->
        <div v-if="form.contactListType === 'tags'">
          <label class="block text-sm font-medium text-gray-700 mb-2">Selecione as tags</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="tag in allTags"
              :key="tag._id"
              @click="toggleTag(tag.name || tag._id)"
              class="px-3 py-1.5 text-sm rounded-full border transition-colors"
              :class="form.tags.includes(tag.name || tag._id) ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'"
            >
              {{ tag.name }}
            </button>
          </div>
        </div>

        <!-- Manual selection -->
        <div v-if="form.contactListType === 'manual'">
          <div class="flex items-center gap-2 mb-3">
            <div class="relative flex-1">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input v-model="contactSearch" type="text" placeholder="Buscar contato..." class="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
            </div>
            <button @click="selectAllContacts" class="text-xs text-primary-600 hover:text-primary-700 font-medium whitespace-nowrap">Selecionar todos</button>
            <button @click="deselectAllContacts" class="text-xs text-gray-500 hover:text-gray-700 font-medium whitespace-nowrap">Limpar</button>
          </div>
          <div class="max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            <label
              v-for="contact in filteredContacts"
              :key="contact._id"
              class="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
            >
              <input type="checkbox" :checked="selectedContacts.has(contact._id)" @change="toggleContact(contact._id)" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <div>
                <p class="text-sm font-medium text-gray-900">{{ contact.name || 'Sem nome' }}</p>
                <p class="text-xs text-gray-400">{{ contact.identifier }}</p>
              </div>
            </label>
          </div>
        </div>

        <!-- Import contacts -->
        <div v-if="form.contactListType === 'import'" class="space-y-4">
          <!-- Toggle between spreadsheet and paste -->
          <div class="flex gap-2">
            <button
              @click="importMode = 'spreadsheet'"
              class="px-3 py-1.5 text-sm rounded-lg border transition-colors"
              :class="importMode === 'spreadsheet' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'"
            >
              <FileSpreadsheet class="w-3.5 h-3.5 inline mr-1" />
              Importar Planilha
            </button>
            <button
              @click="importMode = 'paste'"
              class="px-3 py-1.5 text-sm rounded-lg border transition-colors"
              :class="importMode === 'paste' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'"
            >
              <Upload class="w-3.5 h-3.5 inline mr-1" />
              Colar Numeros
            </button>
          </div>

          <!-- Spreadsheet import mode -->
          <div v-if="importMode === 'spreadsheet'" class="space-y-4">
            <!-- Download template -->
            <div class="flex items-center gap-3">
              <button
                @click="downloadTemplate"
                class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors"
              >
                <Download class="w-4 h-4" />
                Baixar modelo de planilha
              </button>
              <span class="text-xs text-gray-400">Coluna A: telefone, Coluna B: nome</span>
            </div>

            <!-- File upload area -->
            <div v-if="importedContacts.length === 0">
              <label class="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-colors">
                <FileSpreadsheet class="w-8 h-8 text-gray-400 mb-2" />
                <span class="text-sm font-medium text-gray-600">Clique para enviar planilha</span>
                <span class="text-xs text-gray-400 mt-1">Formatos aceitos: .csv, .xlsx, .xls</span>
                <input
                  ref="importFileInput"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  class="hidden"
                  @change="handleSpreadsheetUpload"
                />
              </label>
            </div>

            <!-- Imported contacts preview -->
            <div v-else class="space-y-3">
              <!-- File info and actions -->
              <div class="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div class="flex items-center gap-2">
                  <FileSpreadsheet class="w-5 h-5 text-green-600" />
                  <div>
                    <p class="text-sm font-medium text-green-800">{{ importFileName }}</p>
                    <p class="text-xs text-green-600">{{ importedContacts.length }} contatos importados</p>
                  </div>
                </div>
                <button
                  @click="clearImportedContacts"
                  class="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                  Remover
                </button>
              </div>

              <!-- Preview table -->
              <div class="border border-gray-200 rounded-lg overflow-hidden">
                <table class="w-full text-sm">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                      <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Telefone</th>
                      <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                    <tr v-for="(contact, idx) in importedContacts.slice(0, 10)" :key="idx" class="hover:bg-gray-50">
                      <td class="px-4 py-2 text-gray-400 text-xs">{{ idx + 1 }}</td>
                      <td class="px-4 py-2 font-mono text-gray-900">{{ contact.phone }}</td>
                      <td class="px-4 py-2 text-gray-700">{{ contact.name || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
                <div v-if="importedContacts.length > 10" class="px-4 py-2 bg-gray-50 text-xs text-gray-500 text-center border-t border-gray-200">
                  ... e mais {{ importedContacts.length - 10 }} contatos
                </div>
              </div>
            </div>
          </div>

          <!-- Paste numbers mode -->
          <div v-if="importMode === 'paste'">
            <label class="block text-sm font-medium text-gray-700 mb-1">Cole os numeros (um por linha)</label>
            <textarea v-model="manualNumbers" rows="6" placeholder="5511999999999&#10;5521988888888&#10;5531977777777" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono"></textarea>
          </div>
        </div>

        <div class="bg-gray-50 rounded-lg p-3">
          <p class="text-sm font-medium text-gray-700">
            <Users class="w-4 h-4 inline mr-1" />
            {{ selectedContactCount }} contatos selecionados
          </p>
        </div>
      </div>

      <!-- Step 4: Configurações e Revisão -->
      <div v-if="currentStep === 4" class="space-y-5">
        <h2 class="text-lg font-semibold text-gray-900">Configurações e Revisão</h2>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Delay entre mensagens: {{ (form.delayMs / 1000).toFixed(0) }}s</label>
          <input v-model.number="form.delayMs" type="range" min="1000" max="30000" step="1000" class="w-full" />
          <div class="flex justify-between text-xs text-gray-400">
            <span>1s</span>
            <span>30s</span>
          </div>
        </div>

        <div>
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="form.scheduleEnabled" type="checkbox" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <span class="text-sm font-medium text-gray-700">Agendar para depois</span>
          </label>
          <input
            v-if="form.scheduleEnabled"
            v-model="form.scheduledAt"
            type="datetime-local"
            class="mt-2 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <!-- Summary -->
        <div class="bg-gray-50 rounded-xl p-4 space-y-3">
          <h3 class="font-semibold text-gray-900">Resumo da Campanha</h3>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div><span class="text-gray-500">Nome:</span> <span class="font-medium">{{ form.name }}</span></div>
            <div><span class="text-gray-500">Tipo:</span> <span class="font-medium">{{ form.type === 'official' ? 'Oficial (Meta)' : 'Não-oficial (WPP)' }}</span></div>
            <div><span class="text-gray-500">Instância:</span> <span class="font-medium">{{ form.instanceName || form.instanceId }}</span></div>
            <div><span class="text-gray-500">Contatos:</span> <span class="font-medium">{{ selectedContactCount }}</span></div>
            <div><span class="text-gray-500">Delay:</span> <span class="font-medium">{{ (form.delayMs / 1000).toFixed(0) }}s</span></div>
            <div v-if="form.scheduleEnabled"><span class="text-gray-500">Agendamento:</span> <span class="font-medium">{{ form.scheduledAt ? new Date(form.scheduledAt).toLocaleString('pt-BR') : '-' }}</span></div>
          </div>
          <div v-if="form.type === 'official' && selectedTemplate" class="pt-2 border-t border-gray-200">
            <span class="text-gray-500 text-sm">Template:</span> <span class="font-medium text-sm">{{ selectedTemplate.name }}</span>
          </div>
          <div v-if="form.type === 'unofficial' && form.message" class="pt-2 border-t border-gray-200">
            <span class="text-gray-500 text-sm block mb-1">Mensagem:</span>
            <p class="text-sm bg-white p-2 rounded border border-gray-200 whitespace-pre-wrap">{{ form.message }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <div class="flex items-center justify-between mt-6">
      <button
        v-if="currentStep > 1"
        @click="currentStep--"
        class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
      >
        <ArrowLeft class="w-4 h-4" />
        Voltar
      </button>
      <div v-else></div>

      <div class="flex gap-2">
        <template v-if="currentStep < totalSteps">
          <button
            @click="currentStep++"
            :disabled="!canProceed"
            class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            Próximo
            <ArrowRight class="w-4 h-4" />
          </button>
        </template>
        <template v-else>
          <button
            @click="saveCampaign('draft')"
            :disabled="saving"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Salvar Rascunho
          </button>
          <button
            v-if="form.scheduleEnabled && form.scheduledAt"
            @click="saveCampaign('schedule')"
            :disabled="saving"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {{ saving ? 'Salvando...' : 'Agendar' }}
          </button>
          <button
            v-else
            @click="saveCampaign('start')"
            :disabled="saving"
            class="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {{ saving ? 'Salvando...' : 'Iniciar Agora' }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
