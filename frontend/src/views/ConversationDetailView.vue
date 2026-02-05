<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { conversationsApi, messagesApi, botsApi, finalizationsApi, queueApi, iaApi, tagsApi } from '@/api'
import { useWhitelabelStore } from '@/stores/whitelabel'
import { useAuthStore } from '@/stores/auth'
import {
  ArrowLeft,
  Send,
  Paperclip,
  Image,
  FileText,
  Mic,
  Video,
  MapPin,
  User,
  Bot,
  MoreVertical,
  Archive,
  UserPlus,
  RefreshCw,
  List,
  LayoutGrid,
  Download,
  Play,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  X,
  Sparkles,
  Loader2,
  Pencil,
  Check,
  Reply,
  Tag,
  Plus,
  ArrowRightLeft,
  Sticker,
  Pause
} from 'lucide-vue-next'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import AuraResponseCard from '@/components/aura/AuraResponseCard.vue'
import TransferModal from '@/components/modals/TransferModal.vue'
import { useToast } from 'vue-toastification'
import { format } from 'date-fns'
import type { Conversation, Message, MessageType, BotSession, Finalization, Tag as TagType } from '@/types'
import type { AuraWebhookResponse } from '@/types/aura'
import { getSocket } from '@/services/socket'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const authStore = useAuthStore()
const whitelabelStore = useWhitelabelStore()
const showOperatorNameInMessages = computed(
  () => whitelabelStore.features?.showOperatorNameInMessages ?? false
)
const operatorDisplayName = computed(() => {
  if (conversation.value?.operatorName) {
    return conversation.value.operatorName
  }
  const email = authStore.user?.email || ''
  if (!email) return ''
  return email.split('@')[0]
})

const conversation = ref<Conversation | null>(null)
const messages = ref<Message[]>([])
const botSession = ref<BotSession | null>(null)
const isLoading = ref(true)
const isSending = ref(false)
const showActionsMenu = ref(false)
const showTransferModal = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)
const previewMedia = ref<{ url: string; type: 'image' | 'video' } | null>(null)
const swipeState = ref({
  messageId: null as string | null,
  startX: 0,
  offset: 0
})
const SWIPE_REPLY_THRESHOLD = 70
const MAX_SWIPE_OFFSET = 140

// Finalization
const showFinalizationModal = ref(false)
const finalizations = ref<Finalization[]>([])
const selectedFinalizations = ref<string[]>([])
const selectedFinalizationType = ref<'gain' | 'loss' | null>(null)
const finalizationNotes = ref('')
const isFinishing = ref(false)
const isWaitingStatusUpdating = ref(false)
const isWaitingForCustomer = computed(
  () => conversation.value?.status === 'waiting',
)

// AI Suggestion
const isRequestingSuggestion = ref(false)
const aiSuggestion = ref('')
const showSuggestionPanel = ref(false)

// Edit contact name
const isEditingName = ref(false)
const editedName = ref('')
const isSavingName = ref(false)

// Improve message
const isImprovingMessage = ref(false)

// Reply (responder mensagem)
const replyingTo = ref<Message | null>(null)

// Tags
const availableTags = ref<TagType[]>([])
const conversationTags = ref<string[]>([])
const showTagsDropdown = ref(false)

// Message form
const messageType = ref<MessageType>('text')
const messageText = ref('')
const mediaUrl = ref('')
const mediaBase64 = ref('')
const mediaFilename = ref('')

// Audio recording
const isRecording = ref(false)
const recordingTime = ref(0)
const mediaRecorder = ref<MediaRecorder | null>(null)
const audioChunks = ref<Blob[]>([])
let recordingInterval: number | null = null
let recordingCancelled = false

const conversationId = computed(() => route.params.id as string)

async function fetchConversation() {
  try {
    const response = await conversationsApi.getById(conversationId.value)
    if (response.data) {
      conversation.value = response.data
      // Carregar tags se vier na conversa
      if (response.data.tags) {
        conversationTags.value = response.data.tags
      }
    }
    // Tentar buscar tags via queue se não veio na conversa
    if (conversationTags.value.length === 0) {
      try {
        const queueResponse = await queueApi.getById(conversationId.value)
        if (queueResponse.data?.tags) {
          conversationTags.value = queueResponse.data.tags
        }
      } catch {
        // Conversa pode não estar na fila, ignorar
      }
    }
  } catch {
    toast.error('Erro ao carregar conversa')
    router.push('/conversations')
  }
}

function startEditingName() {
  editedName.value = conversation.value?.name || ''
  isEditingName.value = true
}

function cancelEditingName() {
  isEditingName.value = false
  editedName.value = ''
}

async function saveContactName() {
  if (!editedName.value.trim() || !conversation.value) return

  isSavingName.value = true
  try {
    await conversationsApi.update(conversationId.value, { name: editedName.value.trim() })
    conversation.value.name = editedName.value.trim()
    isEditingName.value = false
    toast.success('Nome atualizado')
  } catch {
    toast.error('Erro ao atualizar nome')
  } finally {
    isSavingName.value = false
  }
}

async function fetchMessages() {
  try {
    const response = await messagesApi.list({
      conversationId: conversationId.value,
      limit: 100
    })
    if (response.data) {
      messages.value = response.data.items.reverse()
      // Popula processedMessageIds com todos os IDs carregados para evitar duplicação via socket
      response.data.items.forEach(msg => {
        if (msg._id) {
          processedMessageIds.add(String(msg._id))
        }
      })
      await nextTick()
      scrollToBottom()
    }
  } catch {
    toast.error('Erro ao carregar mensagens')
  }
}

async function fetchBotSession() {
  try {
    const response = await botsApi.getSession(conversationId.value)
    if (response.data) {
      botSession.value = response.data
    }
  } catch {
    // Sem bot ativo
    botSession.value = null
  }
}

async function loadAll() {
  isLoading.value = true
  await Promise.all([
    fetchConversation(),
    fetchMessages(),
    fetchBotSession(),
    fetchTags()
  ])
  isLoading.value = false
}

async function fetchTags() {
  try {
    const response = await tagsApi.list()
    if (response.data) {
      availableTags.value = response.data
    }
  } catch {
    // Silently fail
  }
}

async function toggleTag(tagName: string) {
  const currentSet = new Set(conversationTags.value)

  if (currentSet.has(tagName)) {
    currentSet.delete(tagName)
  } else {
    currentSet.add(tagName)
  }

  const nextTags = Array.from(currentSet)
  try {
    await queueApi.addTags(conversationId.value, nextTags)
    conversationTags.value = nextTags
    if (conversation.value) {
      conversation.value.tags = nextTags
    }
  } catch {
    toast.error('Erro ao atualizar tags')
  }
}

function isTagSelected(tagName: string) {
  return conversationTags.value.includes(tagName)
}

function getTagColor(tagName: string) {
  const tag = availableTags.value.find(t => t.name === tagName)
  return tag?.color || '#6B7280'
}

async function improveMessage() {
  if (!messageText.value.trim() || !conversation.value) return

  isImprovingMessage.value = true
  try {
    const response = await iaApi.improveMessage(conversationId.value, messageText.value)
    if (response.data?.improved) {
      messageText.value = response.data.improved
    }
  } catch {
    toast.error('Erro ao melhorar mensagem')
  } finally {
    isImprovingMessage.value = false
  }
}

// Reply functions
function startReply(message: Message) {
  replyingTo.value = message
}

function cancelReply() {
  replyingTo.value = null
}

function getQuotedMessage(message: Message): Message | null {
  if (!message.quotedMessageId) return null
  return messages.value.find(m => m._id === message.quotedMessageId) || null
}

function resetSwipeState() {
  swipeState.value = {
    messageId: null,
    startX: 0,
    offset: 0
  }
}

function handleMessageTouchStart(message: Message, event: TouchEvent) {
  if (message.direction !== 'incoming' || !message._id) return

  const touch = event.touches[0]
  swipeState.value = {
    messageId: message._id,
    startX: touch.clientX,
    offset: 0
  }
}

function handleMessageTouchMove(event: TouchEvent) {
  if (!swipeState.value.messageId) return

  const touch = event.touches[0]
  const delta = touch.clientX - swipeState.value.startX

  swipeState.value.offset = delta > 0 ? Math.min(delta, MAX_SWIPE_OFFSET) : 0
}

function handleMessageTouchEnd(message: Message) {
  if (swipeState.value.messageId !== message._id) {
    resetSwipeState()
    return
  }

  if (swipeState.value.offset >= SWIPE_REPLY_THRESHOLD) {
    startReply(message)
  }

  resetSwipeState()
}

function getMessageSwipeStyle(message: Message) {
  if (message.direction !== 'incoming') return
  if (swipeState.value.messageId !== message._id) return

  return {
    transform: `translateX(${swipeState.value.offset}px)`
  }
}

async function sendMessage() {
  if (!conversation.value) return
  if (messageType.value === 'text' && !messageText.value.trim()) return
  if (messageType.value !== 'text' && !mediaUrl.value && !mediaBase64.value) {
    toast.error('Informe uma URL ou selecione um arquivo')
    return
  }

  const operatorNameForWhatsApp =
    showOperatorNameInMessages.value && operatorDisplayName.value
      ? operatorDisplayName.value
      : undefined

  isSending.value = true
  try {
    await messagesApi.send({
      to: conversation.value.identifier,
      provider: conversation.value.provider,
      type: messageType.value,
      message: messageType.value === 'text' ? messageText.value : undefined,
      mediaUrl: ['image', 'document', 'audio', 'video'].includes(messageType.value) && mediaUrl.value ? mediaUrl.value : undefined,
      mediaBase64: ['image', 'document', 'audio', 'video'].includes(messageType.value) && mediaBase64.value ? mediaBase64.value : undefined,
      filename: ['image', 'document', 'audio', 'video'].includes(messageType.value) && mediaFilename.value ? mediaFilename.value : undefined,
      caption: messageType.value !== 'text' ? messageText.value : undefined,
      operatorName: operatorNameForWhatsApp,
      quotedMessageId: replyingTo.value?._id
    })

    messageText.value = ''
    mediaUrl.value = ''
    mediaBase64.value = ''
    mediaFilename.value = ''
    messageType.value = 'text'
    replyingTo.value = null

    // Não chamar fetchMessages() aqui - o WebSocket já adiciona a mensagem automaticamente
    // Isso evita duplicação causada por race condition entre fetch e socket
  } catch {
    toast.error('Erro ao enviar mensagem')
  } finally {
    isSending.value = false
  }
}

function selectMessageType(type: MessageType) {
  messageType.value = type
  mediaUrl.value = ''
  mediaBase64.value = ''
  mediaFilename.value = ''
}

function handleMediaFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    mediaBase64.value = String(reader.result || '')
    mediaFilename.value = file.name
  }
  reader.onerror = () => {
    toast.error('Erro ao ler arquivo')
  }
  reader.readAsDataURL(file)
}

// Audio recording functions
function getSupportedMimeType(): { mimeType: string; extension: string } {
  // Lista de formatos para testar - webm é mais confiável nos browsers
  const types = [
    { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
    { mimeType: 'audio/webm', extension: 'webm' },
    { mimeType: 'audio/mp4', extension: 'mp4' },
    { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
  ]

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type.mimeType)) {
      console.log(`🎵 Formato suportado encontrado: ${type.mimeType}`)
      return type
    }
  }

  // Fallback: deixa o browser decidir (não especifica mimeType)
  console.log(`⚠️ Nenhum formato preferido suportado, deixando browser decidir`)
  return { mimeType: '', extension: 'webm' }
}

async function startRecording() {
  try {
    recordingCancelled = false

    console.log('🎵 Solicitando acesso ao microfone...')
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    // Verifica se o stream tem tracks de áudio ativos
    const audioTracks = stream.getAudioTracks()
    console.log(`🎵 Audio tracks obtidos: ${audioTracks.length}`)
    audioTracks.forEach((track, i) => {
      console.log(`🎵 Track ${i}: ${track.label}, enabled: ${track.enabled}, muted: ${track.muted}, state: ${track.readyState}`)
    })

    const { mimeType, extension } = getSupportedMimeType()

    // Tenta criar MediaRecorder com o mimeType preferido, ou sem especificar
    let recorder: MediaRecorder
    try {
      if (mimeType) {
        recorder = new MediaRecorder(stream, { mimeType })
        console.log(`🎵 MediaRecorder criado com mimeType: ${mimeType}`)
      } else {
        recorder = new MediaRecorder(stream)
        console.log(`🎵 MediaRecorder criado com mimeType padrão`)
      }
    } catch (e) {
      console.warn(`🎵 Falha ao criar MediaRecorder com ${mimeType}, tentando sem especificar...`, e)
      recorder = new MediaRecorder(stream)
    }

    console.log(`🎵 MediaRecorder mimeType final: ${recorder.mimeType}`)
    console.log(`🎵 MediaRecorder state: ${recorder.state}`)

    mediaRecorder.value = recorder
    audioChunks.value = []

    recorder.ondataavailable = (event) => {
      console.log(`🎵 ondataavailable: ${event.data.size} bytes, type: ${event.data.type}`)
      if (event.data.size > 0) {
        audioChunks.value.push(event.data)
      }
    }

    recorder.onerror = (event: Event) => {
      console.error('🎵 MediaRecorder error:', event)
      toast.error('Erro na gravação de áudio')
    }

    recorder.onstart = () => {
      console.log(`🎵 MediaRecorder started! state: ${recorder.state}`)
    }

    recorder.onstop = () => {
      console.log(`🎵 MediaRecorder stopped!`)

      // Se foi cancelado, não processa
      if (recordingCancelled) {
        console.log(`🎵 Gravação cancelada, ignorando dados`)
        stream.getTracks().forEach(track => track.stop())
        return
      }

      // Usa o mimeType REAL que o MediaRecorder usou
      const actualMimeType = recorder.mimeType || 'audio/webm'
      console.log(`🎵 MediaRecorder mimeType real: ${actualMimeType}`)
      console.log(`🎵 Chunks coletados: ${audioChunks.value.length}`)

      // Log cada chunk
      audioChunks.value.forEach((chunk, i) => {
        console.log(`🎵 Chunk ${i}: ${chunk.size} bytes, type: ${chunk.type}`)
      })

      const totalSize = audioChunks.value.reduce((acc, chunk) => acc + chunk.size, 0)
      console.log(`🎵 Tamanho total dos chunks: ${totalSize} bytes`)

      if (audioChunks.value.length === 0 || totalSize === 0) {
        console.error('🎵 Nenhum dado de áudio capturado!')
        toast.error('Erro: nenhum áudio capturado. Verifique as permissões do microfone.')
        stream.getTracks().forEach(track => track.stop())
        return
      }

      const audioBlob = new Blob(audioChunks.value, { type: actualMimeType })
      console.log(`🎵 Blob criado: ${audioBlob.size} bytes, type: ${audioBlob.type}`)

      // Determina a extensão correta baseada no mimeType real
      const extMap: Record<string, string> = {
        'audio/mp4': 'mp4',
        'audio/aac': 'aac',
        'audio/webm': 'webm',
        'audio/ogg': 'ogg',
        'audio/mpeg': 'mp3',
      }
      const baseType = actualMimeType.split(';')[0].trim()
      const realExtension = extMap[baseType] || extension

      const reader = new FileReader()
      reader.onload = () => {
        const result = String(reader.result || '')
        console.log(`🎵 FileReader result length: ${result.length}`)
        console.log(`🎵 Base64 preview (first 150 chars): ${result.substring(0, 150)}`)

        if (result.length < 100) {
          console.error('🎵 Base64 muito curto, algo deu errado!')
          toast.error('Erro ao processar áudio')
          return
        }

        mediaBase64.value = result
        mediaFilename.value = `audio_${Date.now()}.${realExtension}`
        console.log(`🎵 ✅ Base64 gerado com sucesso!`)
        console.log(`🎵 Filename: ${mediaFilename.value}`)
        console.log(`🎵 Tamanho do base64: ${result.length} caracteres`)
        toast.success('Áudio gravado com sucesso!')
      }
      reader.onerror = (e) => {
        console.error('🎵 FileReader error:', e)
        toast.error('Erro ao ler áudio')
      }
      reader.readAsDataURL(audioBlob)

      // Stop all tracks
      stream.getTracks().forEach(track => track.stop())
    }

    // Inicia gravação - timeslice de 500ms para coletar dados mais frequentemente
    recorder.start(500)
    console.log(`🎵 MediaRecorder.start(500) chamado`)

    isRecording.value = true
    recordingTime.value = 0

    recordingInterval = window.setInterval(() => {
      recordingTime.value++
      // Log periódico do estado
      if (recordingTime.value % 2 === 0) {
        console.log(`🎵 Gravando... ${recordingTime.value}s, chunks: ${audioChunks.value.length}, state: ${recorder.state}`)
      }
    }, 1000)
  } catch (error) {
    console.error('🎵 Erro ao iniciar gravação:', error)
    toast.error('Erro ao acessar microfone. Verifique as permissões.')
  }
}

function stopRecording() {
  if (mediaRecorder.value && isRecording.value) {
    const recorder = mediaRecorder.value
    console.log(`🎵 Parando gravação...`)
    console.log(`🎵 Estado atual: ${recorder.state}`)
    console.log(`🎵 Chunks até agora: ${audioChunks.value.length}`)
    console.log(`🎵 Bytes até agora: ${audioChunks.value.reduce((a, c) => a + c.size, 0)}`)

    // Garante que não está cancelado
    recordingCancelled = false

    // requestData força o disparo de ondataavailable com dados pendentes
    if (recorder.state === 'recording') {
      console.log(`🎵 Chamando requestData() para obter dados pendentes...`)
      recorder.requestData()
    }

    console.log(`🎵 Chamando stop()...`)
    recorder.stop()
    isRecording.value = false

    if (recordingInterval) {
      clearInterval(recordingInterval)
      recordingInterval = null
    }
  }
}

function cancelRecording() {
  recordingCancelled = true
  if (mediaRecorder.value) {
    // Stop all tracks first
    mediaRecorder.value.stream.getTracks().forEach(track => track.stop())
    mediaRecorder.value.stop()
  }
  isRecording.value = false
  audioChunks.value = []
  recordingTime.value = 0

  if (recordingInterval) {
    clearInterval(recordingInterval)
    recordingInterval = null
  }
}

function formatRecordingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function openMediaPreview(url: string, type: 'image' | 'video') {
  previewMedia.value = { url, type }
}

function closeMediaPreview() {
  previewMedia.value = null
}

function handleEscapeKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && previewMedia.value) {
    closeMediaPreview()
  }
}

async function archiveConversation() {
  if (!conversation.value) return
  try {
    await conversationsApi.archive(conversation.value._id)
    toast.success('Conversa arquivada')
    router.push('/conversations')
  } catch {
    toast.error('Erro ao arquivar conversa')
  }
}

async function resetBot() {
  try {
    await botsApi.reset(conversationId.value)
    toast.success('Bot resetado')
    await fetchBotSession()
  } catch {
    toast.error('Erro ao resetar bot')
  }
}

async function deactivateBot() {
  try {
    await botsApi.deactivate(conversationId.value)
    toast.success('Bot desativado')
    botSession.value = null
  } catch {
    toast.error('Erro ao desativar bot')
  }
}

async function fetchFinalizations() {
  try {
    const response = await finalizationsApi.list()
    if (response.data) {
      finalizations.value = response.data
    }
  } catch {
    // Silently fail
  }
}

function toggleFinalizationSelection(id: string, type: 'gain' | 'loss') {
  if (selectedFinalizationType.value && selectedFinalizationType.value !== type) {
    selectedFinalizations.value = [id]
    selectedFinalizationType.value = type
    return
  }

  const index = selectedFinalizations.value.indexOf(id)
  if (index >= 0) {
    selectedFinalizations.value.splice(index, 1)
    if (selectedFinalizations.value.length === 0) {
      selectedFinalizationType.value = null
    }
  } else {
    selectedFinalizations.value.push(id)
    selectedFinalizationType.value = type
  }
}

function isFinalizationSelected(id: string) {
  return selectedFinalizations.value.includes(id)
}

function openFinalizationModal() {
  showActionsMenu.value = false
  selectedFinalizations.value = []
  selectedFinalizationType.value = null
  finalizationNotes.value = ''
  fetchFinalizations()
  showFinalizationModal.value = true
}

function closeFinalizationModal() {
  showFinalizationModal.value = false
  selectedFinalizations.value = []
  selectedFinalizationType.value = null
  finalizationNotes.value = ''
}

async function finishConversation() {
  if (selectedFinalizations.value.length === 0) {
    toast.error('Selecione uma finalização')
    return
  }

  isFinishing.value = true
  try {
    await queueApi.resolve(conversationId.value, {
      finalizationIds: selectedFinalizations.value,
      notes: finalizationNotes.value || undefined
    })
    toast.success('Atendimento finalizado com sucesso')
    closeFinalizationModal()
    router.push('/conversations')
  } catch {
    toast.error('Erro ao finalizar atendimento')
  } finally {
    isFinishing.value = false
  }
}

async function toggleWaitingStatus() {
  if (!conversation.value) return

  const archived =
    conversation.value.archived === true ||
    conversation.value.archived === 'true'
  if (archived) {
    toast.error('Não é possível alterar o status de uma conversa arquivada')
    return
  }

  const targetStatus =
    conversation.value.status === 'waiting' ? 'active' : 'waiting'

  isWaitingStatusUpdating.value = true
  try {
    await conversationsApi.update(conversationId.value, { status: targetStatus })
    await fetchConversation()
    toast.success(
      targetStatus === 'waiting'
        ? 'Conversa marcada como aguardando cliente'
        : 'Atendimento retomado',
    )
  } catch {
    toast.error('Erro ao atualizar status da conversa')
  } finally {
    isWaitingStatusUpdating.value = false
  }
}

const gainFinalizations = computed(() => finalizations.value.filter(f => f.type === 'gain'))
const lossFinalizations = computed(() => finalizations.value.filter(f => f.type === 'loss'))

// AI Suggestion functions
async function requestAiSuggestion() {
  if (isRequestingSuggestion.value) return

  isRequestingSuggestion.value = true
  showSuggestionPanel.value = true
  aiSuggestion.value = ''

  // Dispatch thinking event to IA view
  window.dispatchEvent(new CustomEvent('ia:suggestion', {
    detail: { thinking: true }
  }))

  try {
    const response = await iaApi.getSuggestion(conversationId.value, 20)
    aiSuggestion.value = response.data?.suggestion || ''

    // Dispatch suggestion to IA view
    window.dispatchEvent(new CustomEvent('ia:suggestion', {
      detail: { suggestion: aiSuggestion.value }
    }))
  } catch (error) {
    console.error('Error getting AI suggestion:', error)
    toast.error('Erro ao obter sugestao da IA')
    showSuggestionPanel.value = false
  } finally {
    isRequestingSuggestion.value = false
  }
}

function useSuggestion() {
  if (aiSuggestion.value) {
    messageText.value = aiSuggestion.value
    showSuggestionPanel.value = false
    aiSuggestion.value = ''
  }
}

function closeSuggestionPanel() {
  showSuggestionPanel.value = false
  aiSuggestion.value = ''
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function formatTime(date?: string) {
  if (!date) return ''
  return format(new Date(date), 'HH:mm')
}

function getMessageTypeIcon(type: MessageType) {
  switch (type) {
    case 'image': return Image
    case 'document': return FileText
    case 'audio': return Mic
    case 'video': return Video
    case 'location': return MapPin
    case 'list': return List
    case 'buttons': return LayoutGrid
    case 'sticker': return Sticker
    default: return null
  }
}

function getAuraPayload(message: Message): AuraWebhookResponse | null {
  if (!message.metadata || typeof message.metadata !== 'object') return null
  const metadata = message.metadata as Record<string, unknown>
  const candidate = (metadata.aura ?? metadata) as AuraWebhookResponse
  const hasChart = Boolean(candidate?.chart)
  const hasRows = Array.isArray(candidate?.rows) && candidate.rows.length > 0
  const hasColumns = Array.isArray(candidate?.columns) && candidate.columns.length > 0
  if (!hasChart && !hasRows && !hasColumns) return null
  return candidate
}

const socket = getSocket()
let currentJoinedConversationId: string | null = null
const processedMessageIds = new Set<string>()

const handleSocketMessage = async (event: Event) => {
  const detail = (event as CustomEvent).detail
  if (!detail || detail.conversationId !== conversationId.value) return

  if (detail.messageId) {
    const msgId = String(detail.messageId)

    // Verifica se já processamos este messageId (evita duplicatas de múltiplos eventos)
    if (processedMessageIds.has(msgId)) {
      return
    }
    processedMessageIds.add(msgId)

    // Limpa IDs antigos para não crescer infinitamente (mantém últimos 100)
    if (processedMessageIds.size > 100) {
      const idsArray = Array.from(processedMessageIds)
      idsArray.slice(0, 50).forEach(id => processedMessageIds.delete(id))
    }

    // Verifica também no array de mensagens (comparação por string para evitar problemas de tipo)
    const exists = messages.value.some((m) => String(m._id) === msgId)
    if (!exists) {
      const fallbackMessage: Message = {
        _id: detail.messageId,
        conversationId: detail.conversationId,
        message: detail.content || '',
        type: (detail.type || 'text') as MessageType,
        direction: detail.direction || 'incoming',
        status: detail.status || 'sent',
        createdAt: detail.createdAt,
        mediaUrl: detail.mediaUrl,
      }

      let messageToAdd = fallbackMessage
      try {
        const response = await messagesApi.getById(detail.messageId)
        if (response.data) {
          messageToAdd = response.data
        }
      } catch (error) {
        console.error('Erro ao carregar mensagem recebida via socket:', error)
      }

      messages.value.push(messageToAdd)
      await nextTick()
      scrollToBottom()
    }
  } else if (detail.updates) {
    conversation.value = conversation.value
      ? { ...conversation.value, ...detail.updates }
      : conversation.value
  }
}

function joinConversationRoom(convId: string) {
  // Sai da room anterior se existir
  if (currentJoinedConversationId && currentJoinedConversationId !== convId) {
    socket?.emit('leave:conversation', currentJoinedConversationId)
  }
  // Entra na nova room
  socket?.emit('join:conversation', convId)
  currentJoinedConversationId = convId
}

function leaveConversationRoom() {
  if (currentJoinedConversationId) {
    socket?.emit('leave:conversation', currentJoinedConversationId)
    currentJoinedConversationId = null
  }
  // Limpa IDs de mensagens processadas ao sair
  processedMessageIds.clear()
}

// Watch para mudanças de conversa (quando navega entre conversas sem desmontar o componente)
watch(conversationId, (newId, oldId) => {
  if (newId && newId !== oldId) {
    // Limpa mensagens da conversa anterior
    messages.value = []
    conversation.value = null
    // Limpa IDs de mensagens processadas
    processedMessageIds.clear()
    // Sai da room antiga e entra na nova
    joinConversationRoom(newId)
    // Recarrega os dados
    loadAll()
  }
})

onMounted(() => {
  loadAll()
  joinConversationRoom(conversationId.value)
  window.addEventListener('ws:message', handleSocketMessage)
  window.addEventListener('ws:conversation', handleSocketMessage)
  window.addEventListener('keydown', handleEscapeKeydown)
})

onUnmounted(() => {
  leaveConversationRoom()
  window.removeEventListener('ws:message', handleSocketMessage)
  window.removeEventListener('ws:conversation', handleSocketMessage)
  window.removeEventListener('keydown', handleEscapeKeydown)
})
</script>

<template>
  <div class="chat-container flex flex-col">
    <!-- Header -->
    <div class="chat-header bg-white border-b border-gray-200 px-2 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3">
      <button @click="router.push('/conversations')" class="p-2 hover:bg-gray-100 rounded-xl flex-shrink-0 transition-colors active:scale-95">
        <ArrowLeft class="w-5 h-5 text-gray-500" />
      </button>

      <div v-if="conversation" class="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
          <img
            v-if="conversation.photo"
            :src="conversation.photo"
            :alt="conversation.name || conversation.identifier"
            class="w-full h-full object-cover"
          />
          <User v-else class="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
        <div class="min-w-0 flex-1">
          <!-- Edit mode -->
          <div v-if="isEditingName" class="flex items-center gap-2">
            <input
              v-model="editedName"
              type="text"
              class="flex-1 min-w-0 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Nome do contato"
              @keyup.enter="saveContactName"
              @keyup.escape="cancelEditingName"
              autofocus
            />
            <button
              @click="saveContactName"
              :disabled="isSavingName"
              class="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors active:scale-95"
              title="Salvar"
            >
              <Check class="w-4 h-4" />
            </button>
            <button
              @click="cancelEditingName"
              class="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors active:scale-95"
              title="Cancelar"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
          <!-- View mode -->
          <div v-else @click="startEditingName" class="cursor-pointer active:opacity-70">
            <h2 class="font-semibold text-gray-900 text-sm sm:text-base truncate leading-tight">
              {{ conversation.name || conversation.identifier }}
            </h2>
            <p class="text-[11px] sm:text-xs text-gray-500 truncate leading-tight mt-0.5">
              {{ conversation.identifier }}
              <span v-if="conversation.protocolNumber" class="text-gray-400"> · #{{ conversation.protocolNumber }}</span>
            </p>
            <!-- Tags inline -->
      <div v-if="conversationTags.length > 0" class="flex items-center gap-1 mt-1 flex-wrap">
        <span
          v-for="tagName in conversationTags"
          :key="tagName"
          class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium text-white"
          :style="{ backgroundColor: getTagColor(tagName) }"
        >
          <Tag class="w-2.5 h-2.5" />
          {{ tagName }}
        </span>
      </div>
      <div
        v-if="conversation?.finalizations?.length"
        class="flex items-center gap-2 mt-1 flex-wrap text-[10px] font-medium"
      >
        <span class="text-gray-500">Finalizações:</span>
        <span
          v-for="entry in conversation.finalizations"
          :key="entry._id || entry.finalizationId"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full uppercase tracking-wider text-[10px]"
          :class="entry.finalizationType === 'gain'
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-red-100 text-red-600'"
        >
          {{ entry.finalizationName || entry.finalizationId || 'Sem nome' }}
        </span>
      </div>
            <div
              v-if="isWaitingForCustomer"
              class="flex items-center gap-1 mt-1 text-[11px] font-medium text-yellow-700"
            >
              <Pause class="w-3 h-3 text-yellow-600" />
              Aguardando cliente
            </div>
          </div>
        </div>
      </div>

      <!-- Tags button (mobile) -->
      <button
        v-if="availableTags.length > 0"
        @click.stop="showTagsDropdown = !showTagsDropdown"
        class="p-2 hover:bg-gray-100 rounded-xl flex-shrink-0 transition-colors relative active:scale-95"
      >
        <Tag class="w-5 h-5 text-gray-500" />
        <span v-if="conversationTags.length > 0" class="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {{ conversationTags.length }}
        </span>
      </button>

      <!-- Tags dropdown -->
      <div
        v-if="showTagsDropdown"
        class="absolute top-full right-2 sm:left-auto mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50"
      >
        <div class="px-3 py-1.5 text-[10px] font-medium text-gray-400 uppercase border-b border-gray-100 mb-1">Tags</div>
        <button
          v-for="tag in availableTags"
          :key="tag._id"
          @click="toggleTag(tag.name); showTagsDropdown = false"
          class="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 active:bg-gray-100 text-left transition-colors"
        >
          <div
            class="w-3 h-3 rounded-full flex-shrink-0"
            :style="{ backgroundColor: tag.color }"
          />
          <span class="text-sm text-gray-700 flex-1">{{ tag.name }}</span>
          <Check v-if="isTagSelected(tag.name)" class="w-4 h-4 text-primary-500" />
        </button>
        <div v-if="availableTags.length === 0" class="px-3 py-3 text-xs text-gray-400 text-center">
          Nenhuma tag disponível
        </div>
      </div>
      <!-- Backdrop -->
      <div
        v-if="showTagsDropdown"
        class="fixed inset-0 z-40"
        @click="showTagsDropdown = false"
      />

      <!-- Action buttons -->
      <div class="flex items-center gap-1 flex-shrink-0">
        <!-- AI Suggestion Button -->
        <button
          @click="requestAiSuggestion"
          :disabled="isRequestingSuggestion"
          class="ai-btn flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 text-white transition-all active:scale-95 disabled:opacity-70"
          title="Pedir sugestão da IA"
        >
          <Loader2 v-if="isRequestingSuggestion" class="w-4 h-4 animate-spin" />
          <Sparkles v-else class="w-4 h-4" />
        </button>

        <!-- Bot status -->
        <div
          v-if="botSession"
          class="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-purple-100 flex items-center justify-center"
          title="Bot ativo"
        >
          <Bot class="w-4 h-4 text-purple-600" />
        </div>

        <!-- Actions menu -->
        <div class="relative">
          <button
            @click="showActionsMenu = !showActionsMenu"
            class="p-2 hover:bg-gray-100 rounded-xl transition-colors active:scale-95"
          >
            <MoreVertical class="w-5 h-5 text-gray-500" />
          </button>

          <div
            v-if="showActionsMenu"
            class="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50"
          >
            <button
              @click="openFinalizationModal"
              class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 font-medium"
            >
              <CheckCircle2 class="w-4 h-4" />
              Finalizar
            </button>
            <button
              v-if="conversation && !conversation.archived"
              @click="toggleWaitingStatus(); showActionsMenu = false"
              :disabled="isWaitingStatusUpdating"
              :class="['w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all', isWaitingForCustomer
                ? 'text-blue-600 hover:bg-blue-50 active:bg-blue-100'
                : 'text-yellow-600 hover:bg-yellow-50 active:bg-yellow-100']"
            >
              <Loader2
                v-if="isWaitingStatusUpdating"
                class="w-4 h-4 animate-spin text-current"
              />
              <Pause v-else-if="!isWaitingForCustomer" class="w-4 h-4" />
              <Play v-else class="w-4 h-4" />
              <span>
                {{ isWaitingForCustomer ? 'Retomar atendimento' : 'Aguardar cliente' }}
              </span>
            </button>
            <button
              @click="showTransferModal = true; showActionsMenu = false"
              class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100"
            >
              <ArrowRightLeft class="w-4 h-4" />
              Transferir
            </button>
            <hr class="my-1 border-gray-100" />
            <button
              @click="archiveConversation(); showActionsMenu = false"
              class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100"
            >
              <Archive class="w-4 h-4" />
              Arquivar
            </button>
            <template v-if="botSession">
              <button
                @click="resetBot(); showActionsMenu = false"
                class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100"
              >
                <RefreshCw class="w-4 h-4" />
                Resetar Bot
              </button>
              <button
                @click="deactivateBot(); showActionsMenu = false"
                class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 active:bg-red-100"
              >
                <Bot class="w-4 h-4" />
                Desativar Bot
              </button>
            </template>
          </div>
          <!-- Menu backdrop -->
          <div
            v-if="showActionsMenu"
            class="fixed inset-0 z-40"
            @click="showActionsMenu = false"
          />
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>

    <template v-else>
      <!-- Messages -->
      <div
        ref="messagesContainer"
        class="messages-area flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2 bg-gray-50"
      >
        <div
          v-for="message in messages"
          :key="message._id"
          class="flex group"
          :class="message.direction === 'outgoing' ? 'justify-end' : 'justify-start'"
        >
          <!-- Reply button (incoming) -->
          <button
            v-if="message.direction === 'incoming'"
            @click="startReply(message)"
            class="self-center mr-1 p-1.5 rounded-full bg-gray-100 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200"
            title="Responder"
          >
            <Reply class="w-3.5 h-3.5" />
          </button>

          <div
            class="message-bubble"
            :class="message.direction === 'outgoing' ? 'message-outgoing' : 'message-incoming'"
            :style="getMessageSwipeStyle(message)"
            @touchstart="handleMessageTouchStart(message, $event)"
            @touchmove="handleMessageTouchMove($event)"
            @touchend="handleMessageTouchEnd(message)"
            @touchcancel="resetSwipeState"
          >
            <!-- Quoted message preview -->
            <div
              v-if="getQuotedMessage(message)"
              class="quoted-message mb-2 p-2 rounded-lg text-xs border-l-2"
              :class="message.direction === 'outgoing' ? 'bg-white/10 border-white/50' : 'bg-gray-100 border-gray-400'"
            >
              <p class="font-medium opacity-70 mb-0.5">
                {{ getQuotedMessage(message)?.direction === 'incoming' ? (conversation?.name || 'Cliente') : 'Você' }}
              </p>
              <p class="line-clamp-2 opacity-80">{{ getQuotedMessage(message)?.message || '[Mídia]' }}</p>
            </div>
            <!-- Image Preview -->
            <div v-if="message.type === 'image' && message.mediaUrl" class="mb-1.5">
              <button
                type="button"
                class="block p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded-lg"
                @click="openMediaPreview(message.mediaUrl, 'image')"
                @keydown.enter.prevent="openMediaPreview(message.mediaUrl, 'image')"
                @keydown.space.prevent="openMediaPreview(message.mediaUrl, 'image')"
              >
                <img
                  :src="message.mediaUrl"
                  class="max-w-[220px] max-h-[200px] rounded-lg object-cover cursor-pointer"
                  loading="lazy"
                  alt="Imagem enviada"
                />
              </button>
            </div>

            <!-- Sticker Preview -->
            <div v-else-if="message.type === 'sticker' && message.mediaUrl" class="mb-1.5">
              <a :href="message.mediaUrl" target="_blank" class="block">
                <img
                  :src="message.mediaUrl"
                  class="max-w-[140px] max-h-[140px] object-contain drop-shadow-md hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                />
              </a>
            </div>

            <!-- Video Preview -->
            <div v-else-if="message.type === 'video' && message.mediaUrl" class="mb-1.5">
              <button
                type="button"
                class="relative block w-[220px] h-[160px] rounded-lg overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                @click="openMediaPreview(message.mediaUrl, 'video')"
                @keydown.enter.prevent="openMediaPreview(message.mediaUrl, 'video')"
                @keydown.space.prevent="openMediaPreview(message.mediaUrl, 'video')"
              >
                <video
                  :src="message.mediaUrl"
                  muted
                  preload="metadata"
                  class="absolute inset-0 h-full w-full object-cover"
                  playsinline
                  aria-hidden="true"
                />
                <span class="absolute inset-0 bg-black/30 flex items-center justify-center text-white">
                  <Play class="w-8 h-8" />
                </span>
              </button>
            </div>

            <!-- Audio Preview -->
            <div v-else-if="(message.type === 'audio' || message.type === 'ptt') && message.mediaUrl" class="mb-1.5">
              <div class="flex items-center gap-2 p-2 bg-black/5 rounded-lg min-w-[180px]">
                <div class="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
                  <Mic class="w-4 h-4 text-white" />
                </div>
                <audio :src="message.mediaUrl" controls class="flex-1 h-8 min-w-0 audio-player" />
              </div>
            </div>

            <!-- Document Preview -->
            <div v-else-if="message.type === 'document' && message.mediaUrl" class="mb-1.5">
              <a
                :href="message.mediaUrl"
                target="_blank"
                download
                class="flex items-center gap-2 p-2 bg-black/5 rounded-lg hover:bg-black/10 transition-colors min-w-[160px]"
              >
                <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                  <FileText class="w-4 h-4 text-white" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-medium truncate">
                    {{ message.filename || 'Documento' }}
                  </p>
                </div>
                <Download class="w-4 h-4 opacity-50 flex-shrink-0" />
              </a>
            </div>

            <!-- Location Preview -->
            <div v-else-if="message.type === 'location'" class="mb-1.5">
              <div class="flex items-center gap-2 p-2 bg-black/5 rounded-lg">
                <div class="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                  <MapPin class="w-4 h-4 text-white" />
                </div>
                <span class="text-xs">Localizacao</span>
              </div>
            </div>

            <!-- Other media type indicator -->
            <div
              v-else-if="message.type !== 'text' && message.type !== 'chat' && !message.mediaUrl"
              class="flex items-center gap-2 p-2 bg-black/5 rounded-lg mb-1.5"
            >
              <component :is="getMessageTypeIcon(message.type)" class="w-4 h-4 opacity-60" />
              <span class="text-xs capitalize opacity-75">{{ message.type }}</span>
            </div>

            <!-- Message sender name -->
            <p
              v-if="message.direction === 'outgoing' && operatorDisplayName"
              class="text-[10px] uppercase tracking-wide text-white/80 mb-1"
            >
              <strong class="font-bold">{{ operatorDisplayName }}</strong>
            </p>
            <p
              v-else-if="message.direction === 'incoming'"
              class="text-[10px] uppercase tracking-wide text-primary-600 mb-1"
            >
              <strong class="font-bold">{{ conversation?.name || conversation?.identifier || 'Cliente' }}</strong>
            </p>
            <p v-if="message.message" class="text-sm whitespace-pre-wrap break-words leading-relaxed">{{ message.message }}</p>

            <div v-if="getAuraPayload(message)" class="mt-1.5">
              <AuraResponseCard :response="getAuraPayload(message)!" />
            </div>

            <!-- Time -->
            <p class="text-[10px] mt-1 opacity-50 text-right">
              {{ formatTime(message.createdAt) }}
            </p>
          </div>

          <!-- Reply button (outgoing) -->
          <button
            v-if="message.direction === 'outgoing'"
            @click="startReply(message)"
            class="self-center ml-1 p-1.5 rounded-full bg-gray-100 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200"
            title="Responder"
          >
            <Reply class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- AI Suggestion Panel -->
      <div
        v-if="showSuggestionPanel"
        class="ai-suggestion-panel border-t border-purple-200/50"
      >
        <!-- Header compacto -->
        <div class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-violet-500 to-purple-600">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
              <Sparkles class="w-3.5 h-3.5 text-white" :class="{ 'animate-pulse': isRequestingSuggestion }" />
            </div>
            <span class="text-sm font-medium text-white">Sugestão IA</span>
            <span v-if="isRequestingSuggestion" class="text-xs text-white/70 animate-pulse">pensando...</span>
          </div>
          <button
            @click="closeSuggestionPanel"
            class="p-1.5 hover:bg-white/20 rounded-lg text-white/70 hover:text-white transition-colors"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Conteudo -->
        <div class="p-3 bg-gradient-to-b from-purple-50 to-white">
          <!-- Loading state -->
          <div v-if="isRequestingSuggestion" class="py-4">
            <div class="flex items-center justify-center gap-2 mb-3">
              <div class="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
              <div class="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
              <div class="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
            </div>
            <p class="text-xs text-center text-purple-600/70">Analisando conversa...</p>
          </div>

          <!-- Suggestion content -->
          <div v-else-if="aiSuggestion">
            <div class="bg-white rounded-xl p-3 shadow-sm border border-purple-100 mb-3 overflow-hidden">
              <p class="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed break-words">{{ aiSuggestion }}</p>
            </div>
            <div class="flex gap-2">
              <button
                @click="useSuggestion"
                class="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-medium shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
              >
                <CheckCircle2 class="w-4 h-4" />
                <span>Usar</span>
              </button>
              <button
                @click="requestAiSuggestion"
                class="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl border border-purple-200 text-purple-600 text-sm font-medium hover:bg-purple-50 active:scale-[0.98] transition-all"
                title="Gerar nova sugestao"
              >
                <RefreshCw class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Reply Preview -->
      <div
        v-if="replyingTo"
        class="reply-preview bg-gray-50 border-t border-gray-200 px-3 py-2 flex items-center gap-2"
      >
        <div class="flex-1 min-w-0 p-2 bg-white rounded-lg border-l-4 border-primary-500">
          <p class="text-xs font-medium text-primary-600 mb-0.5">
            Respondendo a {{ replyingTo.direction === 'incoming' ? (conversation?.name || 'Cliente') : 'você' }}
          </p>
          <p class="text-sm text-gray-700 truncate">
            {{ replyingTo.message || '[Mídia]' }}
          </p>
        </div>
        <button
          @click="cancelReply"
          class="p-2 hover:bg-gray-200 rounded-lg text-gray-500 flex-shrink-0"
          title="Cancelar resposta"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Message Input -->
      <div class="message-input-area bg-white border-t border-gray-200 p-2 safe-area-bottom" :class="{ 'border-t-0': replyingTo }">
        <!-- Message type selector (compact) -->
        <div class="flex gap-1 mb-2 overflow-x-auto hide-scrollbar">
          <button
            @click="selectMessageType('text')"
            class="type-btn"
            :class="messageType === 'text' ? 'type-btn-active' : 'type-btn-inactive'"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </button>
          <button
            @click="selectMessageType('image')"
            class="type-btn"
            :class="messageType === 'image' ? 'type-btn-active' : 'type-btn-inactive'"
          >
            <Image class="w-4 h-4" />
          </button>
          <button
            @click="selectMessageType('document')"
            class="type-btn"
            :class="messageType === 'document' ? 'type-btn-active' : 'type-btn-inactive'"
          >
            <FileText class="w-4 h-4" />
          </button>
          <button
            @click="selectMessageType('audio')"
            class="type-btn"
            :class="messageType === 'audio' ? 'type-btn-active' : 'type-btn-inactive'"
          >
            <Mic class="w-4 h-4" />
          </button>
          <button
            @click="selectMessageType('video')"
            class="type-btn"
            :class="messageType === 'video' ? 'type-btn-active' : 'type-btn-inactive'"
          >
            <Video class="w-4 h-4" />
          </button>
        </div>

        <!-- Media upload (compact) -->
        <div v-if="messageType !== 'text'" class="mb-2">
          <div class="p-2 bg-gray-50 rounded-xl border border-gray-200">
            <!-- Preview -->
            <div v-if="mediaBase64 || mediaUrl" class="flex items-center gap-2 p-2 bg-white rounded-lg">
              <img
                v-if="messageType === 'image' && (mediaBase64 || mediaUrl)"
                :src="mediaBase64 || mediaUrl"
                class="w-12 h-12 object-cover rounded-lg"
              />
              <video
                v-else-if="messageType === 'video' && (mediaBase64 || mediaUrl)"
                :src="mediaBase64 || mediaUrl"
                class="w-12 h-12 object-cover rounded-lg"
              />
              <div v-else class="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center">
                <component :is="getMessageTypeIcon(messageType)" class="w-6 h-6 text-primary-600" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 truncate">{{ mediaFilename || 'Midia' }}</p>
              </div>
              <button
                @click="mediaUrl = ''; mediaBase64 = ''; mediaFilename = ''"
                class="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"
              >
                <X class="w-4 h-4" />
              </button>
            </div>

            <!-- Audio Recording UI -->
            <div v-else-if="messageType === 'audio'" class="flex flex-col gap-2">
              <!-- Recording in progress -->
              <div v-if="isRecording" class="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                <div class="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span class="text-sm font-medium text-red-600 flex-1">Gravando... {{ formatRecordingTime(recordingTime) }}</span>
                <button
                  @click="cancelRecording"
                  class="p-2 hover:bg-red-100 rounded-lg text-red-500 transition-colors"
                  title="Cancelar"
                >
                  <X class="w-5 h-5" />
                </button>
                <button
                  @click="stopRecording"
                  class="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  title="Parar gravação"
                >
                  <CheckCircle2 class="w-5 h-5" />
                </button>
              </div>

              <!-- Start recording button -->
              <div v-else class="flex gap-2">
                <button
                  @click="startRecording"
                  class="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  <Mic class="w-5 h-5" />
                  <span class="text-sm font-medium">Gravar áudio</span>
                </button>
                <label class="flex items-center justify-center w-12 h-12 bg-gray-200 text-gray-600 rounded-lg cursor-pointer hover:bg-gray-300 transition-colors">
                  <Paperclip class="w-5 h-5" />
                  <input
                    type="file"
                    accept="audio/*"
                    @change="handleMediaFileChange"
                    class="hidden"
                  />
                </label>
              </div>
            </div>

            <!-- Image/Video capture -->
            <div v-else-if="messageType === 'image' || messageType === 'video'" class="flex gap-2">
              <label class="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-500 text-white rounded-lg cursor-pointer hover:bg-primary-600 transition-colors">
                <Image v-if="messageType === 'image'" class="w-5 h-5" />
                <Video v-else class="w-5 h-5" />
                <span class="text-sm font-medium">{{ messageType === 'image' ? 'Tirar foto' : 'Gravar vídeo' }}</span>
                <input
                  type="file"
                  :accept="messageType === 'image' ? 'image/*' : 'video/*'"
                  capture="environment"
                  @change="handleMediaFileChange"
                  class="hidden"
                />
              </label>
              <label class="flex items-center justify-center w-12 h-12 bg-gray-200 text-gray-600 rounded-lg cursor-pointer hover:bg-gray-300 transition-colors">
                <Paperclip class="w-5 h-5" />
                <input
                  type="file"
                  :accept="messageType === 'image' ? 'image/*' : 'video/*'"
                  @change="handleMediaFileChange"
                  class="hidden"
                />
              </label>
            </div>

            <!-- Document upload -->
            <div v-else class="flex gap-2">
              <label class="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-500 text-white rounded-lg cursor-pointer hover:bg-primary-600 transition-colors">
                <Paperclip class="w-5 h-5" />
                <span class="text-sm font-medium">Selecionar arquivo</span>
                <input
                  type="file"
                  accept="*/*"
                  @change="handleMediaFileChange"
                  class="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        <!-- Message input -->
        <div class="flex gap-2 items-end">
          <div class="flex-1 relative">
            <input
              v-model="messageText"
              @keyup.enter="sendMessage"
              type="text"
              :placeholder="messageType === 'text' ? 'Mensagem...' : 'Legenda...'"
              class="input w-full py-3 text-base sm:text-sm pr-12 rounded-xl"
              :disabled="isSending || isImprovingMessage"
            />
            <!-- Improve message button -->
            <button
              v-if="messageText.trim().length > 0"
              @click="improveMessage"
              :disabled="isImprovingMessage || isSending"
              class="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-purple-500 hover:bg-purple-50 active:bg-purple-100 disabled:opacity-50 transition-all"
              title="Melhorar mensagem com IA"
            >
              <Loader2 v-if="isImprovingMessage" class="w-4 h-4 animate-spin" />
              <Sparkles v-else class="w-4 h-4" />
            </button>
          </div>
          <button
            @click="sendMessage"
            :disabled="isSending || (messageType === 'text' && !messageText.trim())"
            class="w-12 h-12 flex items-center justify-center rounded-xl bg-primary-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-600 active:scale-95 transition-all shadow-sm"
          >
            <Send v-if="!isSending" class="w-5 h-5" />
            <LoadingSpinner v-else size="sm" />
          </button>
        </div>
      </div>
    </template>

    <!-- Finalization Modal -->
    <Teleport to="body">
      <div
        v-if="showFinalizationModal"
        class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
        @click.self="closeFinalizationModal"
      >
        <div class="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[85vh] flex flex-col animate-slide-up sm:animate-none sm:m-4">
          <!-- Header -->
          <div class="flex items-center justify-between p-3 border-b border-gray-100">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 class="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h2 class="font-semibold text-gray-900 text-sm">Finalizar Atendimento</h2>
              </div>
            </div>
            <button @click="closeFinalizationModal" class="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-3 space-y-3">
            <!-- Ganhos -->
            <div v-if="gainFinalizations.length > 0">
              <div class="flex items-center gap-1.5 mb-2">
                <TrendingUp class="w-3.5 h-3.5 text-emerald-600" />
                <span class="text-xs font-medium text-gray-600">Ganhos</span>
              </div>
              <div class="grid gap-1.5">
                <button
                  v-for="fin in gainFinalizations"
                  :key="fin._id"
                  @click="toggleFinalizationSelection(fin._id, fin.type)"
                  class="flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all text-left"
                  :class="isFinalizationSelected(fin._id)
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 active:bg-emerald-50/50'"
                >
                  <div
                    class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    :class="isFinalizationSelected(fin._id)
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-gray-300'"
                  >
                    <CheckCircle2 v-if="isFinalizationSelected(fin._id)" class="w-3 h-3 text-white" />
                  </div>
                  <span class="text-sm font-medium text-gray-900">{{ fin.name }}</span>
                </button>
              </div>
            </div>

            <!-- Perdas -->
            <div v-if="lossFinalizations.length > 0">
              <div class="flex items-center gap-1.5 mb-2">
                <TrendingDown class="w-3.5 h-3.5 text-red-600" />
                <span class="text-xs font-medium text-gray-600">Perdas</span>
              </div>
              <div class="grid gap-1.5">
                <button
                  v-for="fin in lossFinalizations"
                  :key="fin._id"
                  @click="toggleFinalizationSelection(fin._id, fin.type)"
                  class="flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all text-left"
                  :class="isFinalizationSelected(fin._id)
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 active:bg-red-50/50'"
                >
                  <div
                    class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    :class="isFinalizationSelected(fin._id)
                      ? 'border-red-500 bg-red-500'
                      : 'border-gray-300'"
                  >
                    <CheckCircle2 v-if="isFinalizationSelected(fin._id)" class="w-3 h-3 text-white" />
                  </div>
                  <span class="text-sm font-medium text-gray-900">{{ fin.name }}</span>
                </button>
              </div>
            </div>

            <!-- Empty state -->
            <div v-if="finalizations.length === 0" class="text-center py-6">
              <p class="text-gray-500 text-sm">Nenhuma finalizacao cadastrada</p>
            </div>

            <!-- Notes -->
            <div v-if="finalizations.length > 0">
              <label class="text-xs font-medium text-gray-600 mb-1 block">Observacoes</label>
              <textarea
                v-model="finalizationNotes"
                class="input min-h-[60px] resize-none text-sm"
                placeholder="Observacao opcional..."
              />
            </div>
          </div>

          <!-- Footer -->
          <div class="p-3 border-t border-gray-100 flex gap-2 safe-area-bottom">
            <button @click="closeFinalizationModal" class="btn-secondary flex-1 py-2.5 text-sm">
              Cancelar
            </button>
            <button
              @click="finishConversation"
              :disabled="selectedFinalizations.length === 0 || isFinishing"
              class="btn-primary flex-1 justify-center py-2.5 text-sm"
            >
              <LoadingSpinner v-if="isFinishing" size="sm" />
              <CheckCircle2 v-else class="w-4 h-4" />
              <span>Finalizar</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="previewMedia"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6"
        @click.self="closeMediaPreview"
      >
        <button
          type="button"
          class="absolute top-4 right-4 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          @click="closeMediaPreview"
        >
          <X class="w-4 h-4" />
        </button>
        <div class="relative max-h-full max-w-full" @click.stop>
          <img
            v-if="previewMedia?.type === 'image'"
            :src="previewMedia.url"
            class="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
            loading="eager"
            alt="Visualização da imagem"
          />
          <video
            v-else
            :src="previewMedia?.url"
            controls
            autoplay
            playsinline
            class="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
          />
        </div>
      </div>
    </Teleport>

    <!-- Transfer Modal -->
    <TransferModal
      v-model="showTransferModal"
      :conversation-id="conversationId"
      :current-operator-id="conversation?.operatorId"
      @transferred="router.push('/queue')"
    />
  </div>
</template>

<style scoped>
/* Container principal - usa altura do pai */
.chat-container {
  height: 100%;
  position: relative;
}

/* Header */
.chat-header {
  flex-shrink: 0;
  position: relative;
}

/* Area de mensagens */
.messages-area {
  -webkit-overflow-scrolling: touch;
}

/* Message bubbles - otimizados para mobile */
.message-bubble {
  @apply max-w-[85%] px-3 py-2 rounded-2xl shadow-sm text-sm;
  transition: transform 0.15s ease;
}

@media (min-width: 640px) {
  .message-bubble {
    @apply max-w-[70%] px-4 py-2.5;
  }
}

.message-outgoing {
  @apply bg-primary-500 text-white;
  border-bottom-right-radius: 6px;
}

.message-incoming {
  @apply bg-white text-gray-900 border border-gray-100;
  border-bottom-left-radius: 6px;
}

/* Audio player compacto */
.audio-player {
  max-width: 140px;
}

.audio-player::-webkit-media-controls-panel {
  @apply bg-transparent;
}

/* Type buttons - touch friendly */
.type-btn {
  @apply flex items-center justify-center w-10 h-10 rounded-xl transition-all flex-shrink-0;
}

@media (min-width: 640px) {
  .type-btn {
    @apply w-9 h-9 rounded-lg;
  }
}

.type-btn-active {
  @apply bg-primary-500 text-white shadow-sm;
}

.type-btn-inactive {
  @apply bg-gray-100 text-gray-500 active:bg-gray-200;
}

@media (min-width: 640px) {
  .type-btn-inactive {
    @apply hover:bg-gray-200;
  }
}

/* Hide scrollbar but keep functionality */
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
}

/* Safe area para iPhone */
.safe-area-bottom {
  padding-bottom: max(8px, env(safe-area-inset-bottom));
}

/* Message input area */
.message-input-area {
  flex-shrink: 0;
  z-index: 10;
  box-shadow: 0 -4px 20px rgba(15, 23, 42, 0.08);
}

/* Better scrollbar for messages (desktop only) */
@media (min-width: 640px) {
  .messages-area::-webkit-scrollbar {
    width: 6px;
  }

  .messages-area::-webkit-scrollbar-track {
    @apply bg-transparent;
  }

  .messages-area::-webkit-scrollbar-thumb {
    @apply bg-gray-300 rounded-full;
  }

  .messages-area::-webkit-scrollbar-thumb:hover {
    @apply bg-gray-400;
  }
}

/* AI Suggestion Panel Animation */
.ai-suggestion-panel {
  animation: slideUp 0.25s ease-out;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  flex-shrink: 0;
}

.ai-suggestion-panel p {
  word-wrap: break-word;
  overflow-wrap: break-word;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Bounce animation for loading dots */
@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

.animate-bounce {
  animation: bounce 0.5s infinite;
}

/* AI Button glow effect */
.ai-btn {
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.25);
}

/* Input focus state */
.input:focus {
  @apply ring-2 border-primary-500;
  --tw-ring-color: rgba(var(--color-primary-light-rgb), 0.2);
}

/* Modal slide up animation for mobile */
@keyframes slideUpModal {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.animate-slide-up {
  animation: slideUpModal 0.25s ease-out;
}

/* Reply Preview */
.reply-preview {
  animation: slideUp 0.15s ease-out;
}

/* Quoted message in bubble */
.quoted-message {
  max-width: 100%;
}

.quoted-message p {
  word-break: break-word;
}

/* Line clamp for quoted messages */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
