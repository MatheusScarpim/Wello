<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useWhitelabelStore } from '@/stores/whitelabel'
import { whitelabelApi, storageApi, iaApi } from '@/api'
import {
  Palette,
  Image,
  Type,
  Settings,
  Globe,
  ToggleLeft,
  RefreshCw,
  Upload,
  Trash2,
  Eye,
  Save,
  Mic,
  Loader2,
  Square,
  ChevronDown,
  Play
} from 'lucide-vue-next'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import { useToast } from 'vue-toastification'
import type { WhitelabelSettings, ThemeSettings } from '@/types'

const whitelabelStore = useWhitelabelStore()
const toast = useToast()

const isLoading = ref(true)
const isSaving = ref(false)
const showResetConfirm = ref(false)
const showPreview = ref(false)

// Voice Clone
const isCloning = ref(false)
const cloneVoiceName = ref('')
const cloneAudioFile = ref<File | null>(null)

// Audio Recording for Voice Clone
const isRecordingClone = ref(false)
const recordingCloneTime = ref(0)
let cloneMediaRecorder: MediaRecorder | null = null
let cloneAudioChunks: Blob[] = []
let cloneRecordingInterval: number | null = null
const cloneRecordedAudioUrl = ref('')

// ElevenLabs Voices
const elevenLabsVoices = ref<Array<{ voiceId: string; name: string; category: string; previewUrl?: string }>>([])
const isLoadingVoices = ref(false)
const showCloneSection = ref(false)
const previewingVoiceId = ref('')
let previewAudio: HTMLAudioElement | null = null

async function fetchElevenLabsVoices() {
  isLoadingVoices.value = true
  try {
    const response = await iaApi.listElevenLabsVoices()
    elevenLabsVoices.value = response.data?.voices || []
  } catch {
    // Silencioso - se falhar, o usuário ainda pode colar o ID manualmente
  } finally {
    isLoadingVoices.value = false
  }
}

function previewVoice(voice: { voiceId: string; previewUrl?: string }) {
  if (!voice.previewUrl) return

  if (previewAudio) {
    previewAudio.pause()
    previewAudio = null
  }

  if (previewingVoiceId.value === voice.voiceId) {
    previewingVoiceId.value = ''
    return
  }

  previewingVoiceId.value = voice.voiceId
  previewAudio = new Audio(voice.previewUrl)
  previewAudio.play()
  previewAudio.onended = () => {
    previewingVoiceId.value = ''
  }
}

function selectVoice(voiceId: string) {
  form.value.features!.elevenLabsVoiceId = voiceId
}

function handleCloneAudioChange(event: Event) {
  const target = event.target as HTMLInputElement
  cloneAudioFile.value = target.files?.[0] || null
  // Limpa gravação anterior se selecionou arquivo
  if (cloneAudioFile.value && cloneRecordedAudioUrl.value) {
    URL.revokeObjectURL(cloneRecordedAudioUrl.value)
    cloneRecordedAudioUrl.value = ''
  }
}

function getCloneSupportedMimeType(): { mimeType: string; extension: string } {
  const types = [
    { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
    { mimeType: 'audio/webm', extension: 'webm' },
    { mimeType: 'audio/mp4', extension: 'mp4' },
    { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
  ]
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type.mimeType)) return type
  }
  return { mimeType: '', extension: 'webm' }
}

async function startCloneRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const { mimeType } = getCloneSupportedMimeType()

    let recorder: MediaRecorder
    if (mimeType) {
      recorder = new MediaRecorder(stream, { mimeType })
    } else {
      recorder = new MediaRecorder(stream)
    }

    cloneMediaRecorder = recorder
    cloneAudioChunks = []

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) cloneAudioChunks.push(event.data)
    }

    recorder.onstop = () => {
      const actualMimeType = recorder.mimeType || 'audio/webm'
      const audioBlob = new Blob(cloneAudioChunks, { type: actualMimeType })

      if (audioBlob.size === 0) {
        toast.error('Nenhum áudio capturado. Verifique o microfone.')
        stream.getTracks().forEach(track => track.stop())
        return
      }

      const extMap: Record<string, string> = {
        'audio/mp4': 'mp4',
        'audio/webm': 'webm',
        'audio/ogg': 'ogg',
      }
      const baseType = actualMimeType.split(';')[0].trim()
      const ext = extMap[baseType] || 'webm'

      const file = new File([audioBlob], `voz_clone_${Date.now()}.${ext}`, { type: actualMimeType })
      cloneAudioFile.value = file

      // URL para preview
      if (cloneRecordedAudioUrl.value) URL.revokeObjectURL(cloneRecordedAudioUrl.value)
      cloneRecordedAudioUrl.value = URL.createObjectURL(audioBlob)

      toast.success('Áudio gravado com sucesso!')
      stream.getTracks().forEach(track => track.stop())
    }

    recorder.start(500)
    isRecordingClone.value = true
    recordingCloneTime.value = 0
    cloneRecordingInterval = window.setInterval(() => {
      recordingCloneTime.value++
    }, 1000)
  } catch {
    toast.error('Erro ao acessar microfone. Verifique as permissões.')
  }
}

function stopCloneRecording() {
  if (cloneMediaRecorder && isRecordingClone.value) {
    if (cloneMediaRecorder.state === 'recording') {
      cloneMediaRecorder.requestData()
      cloneMediaRecorder.stop()
    }
    if (cloneRecordingInterval) {
      clearInterval(cloneRecordingInterval)
      cloneRecordingInterval = null
    }
    isRecordingClone.value = false
  }
}

function discardCloneRecording() {
  if (cloneRecordedAudioUrl.value) {
    URL.revokeObjectURL(cloneRecordedAudioUrl.value)
    cloneRecordedAudioUrl.value = ''
  }
  cloneAudioFile.value = null
}

function formatRecordingTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

async function cloneVoice() {
  if (!cloneAudioFile.value) {
    toast.error('Grave ou selecione um arquivo de áudio')
    return
  }

  isCloning.value = true
  try {
    const name = cloneVoiceName.value.trim() || 'Minha Voz'
    const response = await iaApi.cloneVoice(cloneAudioFile.value, name)
    if (response.data?.voiceId) {
      form.value.features!.elevenLabsVoiceId = response.data.voiceId
      toast.success(`Voz "${name}" clonada com sucesso!`)
      cloneAudioFile.value = null
      cloneVoiceName.value = ''
      if (cloneRecordedAudioUrl.value) {
        URL.revokeObjectURL(cloneRecordedAudioUrl.value)
        cloneRecordedAudioUrl.value = ''
      }
    }
  } catch (error: any) {
    const msg = error?.response?.data?.error || 'Erro ao clonar voz'
    toast.error(msg)
  } finally {
    isCloning.value = false
  }
}

// Form
const form = ref<Partial<WhitelabelSettings>>({
  companyName: '',
  protocolIdentifier: '',
  theme: {
    primaryColor: '#cd2649',
    primaryColorDark: '#a31d3a',
    primaryColorLight: '#e85a7a',
    accentColor: '#2563eb',
    sidebarBg: '#1f2937',
    sidebarText: '#f9fafb',
    headerBg: '#ffffff',
    headerText: '#111827',
    fontFamily: 'Inter, system-ui, sans-serif',
    borderRadius: 'lg'
  },
  metadata: {
    address: '',
    phone: '',
    email: '',
    website: ''
  },
  features: {
    enableBots: true,
    enableWebhooks: true,
    enableExpenses: true,
    enableStorage: true,
    enableReports: true,
    enableCannedResponses: true,
    enableTags: true,
    enableNotes: true,
    maxDepartments: 10,
    maxOperators: 50,
    showOperatorNameInMessages: false,
    defaultTtsVoice: 'nova',
    ttsModel: 'tts-1',
    ttsProvider: 'openai',
    elevenLabsVoiceId: ''
  },
  customCss: ''
})

const previewTheme = computed(() => form.value.theme as ThemeSettings)

async function fetchSettings() {
  isLoading.value = true
  try {
    await whitelabelStore.fetchSettings()
    const settings = whitelabelStore.settings
    form.value = {
      companyName: settings.companyName,
      logo: settings.logo,
      logoSmall: settings.logoSmall,
      favicon: settings.favicon,
      loginBackground: settings.loginBackground,
      theme: { ...settings.theme },
      metadata: { ...settings.metadata },
      features: { ...settings.features },
      customCss: settings.customCss || '',
      protocolIdentifier: settings.protocolIdentifier || ''
    }
  } catch {
    toast.error('Erro ao carregar configurações')
  } finally {
    isLoading.value = false
  }
}

async function saveSettings() {
  isSaving.value = true
  try {
    await whitelabelStore.updateSettings(form.value)
    toast.success('Configurações salvas')
  } catch {
    toast.error('Erro ao salvar configurações')
  } finally {
    isSaving.value = false
  }
}

async function resetToDefault() {
  try {
    await whitelabelApi.resetToDefault()
    toast.success('Configurações restauradas')
    showResetConfirm.value = false
    fetchSettings()
  } catch {
    toast.error('Erro ao restaurar configurações')
  }
}

async function uploadLogo(event: Event, type: 'logo' | 'logoSmall' | 'favicon' | 'loginBackground') {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return

  try {
    const response = await whitelabelApi.uploadLogo(input.files[0], type)
    if (response.data) {
      form.value[type] = response.data.url
      toast.success('Imagem enviada')
    }
  } catch {
    toast.error('Erro ao enviar imagem')
  }
}

function removeLogo(type: 'logo' | 'logoSmall' | 'favicon' | 'loginBackground') {
  form.value[type] = undefined
}

// Auto-generate dark/light variants from primary color
// Carrega vozes ElevenLabs quando provedor muda para elevenlabs
watch(() => form.value.features?.ttsProvider, (provider) => {
  if (provider === 'elevenlabs' && elevenLabsVoices.value.length === 0) {
    fetchElevenLabsVoices()
  }
})

watch(() => form.value.theme?.primaryColor, (newColor) => {
  if (newColor && form.value.theme) {
    // Simple darkening/lightening (in production, use a proper color lib)
    form.value.theme.primaryColorDark = adjustBrightness(newColor, -20)
    form.value.theme.primaryColorLight = adjustBrightness(newColor, 40)
  }
})

function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const R = (num >> 16) + amt
  const G = (num >> 8 & 0x00FF) + amt
  const B = (num & 0x0000FF) + amt
  return '#' + (0x1000000 +
    (R < 255 ? (R < 0 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 0 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 0 ? 0 : B) : 255)
  ).toString(16).slice(1)
}

const fontOptions = [
  { value: 'Inter, system-ui, sans-serif', label: 'Inter' },
  { value: 'Roboto, system-ui, sans-serif', label: 'Roboto' },
  { value: 'Poppins, system-ui, sans-serif', label: 'Poppins' },
  { value: 'Open Sans, system-ui, sans-serif', label: 'Open Sans' },
  { value: 'system-ui, sans-serif', label: 'Sistema' }
]

const radiusOptions = [
  { value: 'none', label: 'Nenhum' },
  { value: 'sm', label: 'Pequeno' },
  { value: 'md', label: 'Médio' },
  { value: 'lg', label: 'Grande' },
  { value: 'full', label: 'Arredondado' }
]

onMounted(fetchSettings)
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Personalização</h1>
        <p class="text-gray-500">Configure a aparência e funcionalidades do sistema</p>
      </div>
      <div class="flex gap-2">
        <button @click="showResetConfirm = true" class="btn-outline">
          <RefreshCw class="w-4 h-4" />
          Restaurar
        </button>
        <button @click="saveSettings" :disabled="isSaving" class="btn-primary">
          <Save class="w-4 h-4" />
          {{ isSaving ? 'Salvando...' : 'Salvar' }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <LoadingSpinner size="lg" />
    </div>

    <template v-else>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Settings Column -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Brand -->
          <div class="card">
            <div class="p-4 border-b border-gray-200">
              <h3 class="font-semibold text-gray-900 flex items-center gap-2">
                <Image class="w-5 h-5" />
                Marca
              </h3>
            </div>
            <div class="p-4 space-y-4">
              <div>
                <label class="label">Nome da Empresa</label>
                <input v-model="form.companyName" type="text" class="input" />
              </div>
              
              <div>
                <label class="label">Identificador de Protocolo</label>
                <input
                  v-model="form.protocolIdentifier"
                  type="text"
                  class="input"
                  placeholder="Ex: PROT-2026"
                />
                <p class="text-xs text-gray-400 mt-1">
                  Texto opcional exibido como prefixo no número do protocolo.
                </p>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <!-- Logo -->
                <div>
                  <label class="label">Logo Principal</label>
                  <div class="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
                    <img
                      v-if="form.logo"
                      :src="form.logo"
                      class="h-16 mx-auto mb-2 object-contain"
                    />
                    <div class="flex gap-2 justify-center">
                      <label class="btn-outline btn-sm cursor-pointer">
                        <Upload class="w-4 h-4" />
                        <input
                          type="file"
                          accept="image/*"
                          class="hidden"
                          @change="uploadLogo($event, 'logo')"
                        />
                      </label>
                      <button
                        v-if="form.logo"
                        @click="removeLogo('logo')"
                        class="btn-ghost btn-sm text-red-600"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Logo Small -->
                <div>
                  <label class="label">Logo Pequeno</label>
                  <div class="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
                    <img
                      v-if="form.logoSmall"
                      :src="form.logoSmall"
                      class="h-12 mx-auto mb-2 object-contain"
                    />
                    <div class="flex gap-2 justify-center">
                      <label class="btn-outline btn-sm cursor-pointer">
                        <Upload class="w-4 h-4" />
                        <input
                          type="file"
                          accept="image/*"
                          class="hidden"
                          @change="uploadLogo($event, 'logoSmall')"
                        />
                      </label>
                      <button
                        v-if="form.logoSmall"
                        @click="removeLogo('logoSmall')"
                        class="btn-ghost btn-sm text-red-600"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Favicon -->
                <div>
                  <label class="label">Favicon</label>
                  <div class="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
                    <img
                      v-if="form.favicon"
                      :src="form.favicon"
                      class="h-8 mx-auto mb-2 object-contain"
                    />
                    <div class="flex gap-2 justify-center">
                      <label class="btn-outline btn-sm cursor-pointer">
                        <Upload class="w-4 h-4" />
                        <input
                          type="file"
                          accept="image/*,.ico"
                          class="hidden"
                          @change="uploadLogo($event, 'favicon')"
                        />
                      </label>
                      <button
                        v-if="form.favicon"
                        @click="removeLogo('favicon')"
                        class="btn-ghost btn-sm text-red-600"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Background do Login -->
              <div class="mt-4 pt-4 border-t border-gray-200">
                <label class="label">Background da Tela de Login</label>
                <div class="border-2 border-dashed border-gray-200 rounded-lg p-4">
                  <img
                    v-if="form.loginBackground"
                    :src="form.loginBackground"
                    class="h-32 w-full object-cover rounded-lg mb-3"
                  />
                  <div v-else class="h-32 bg-gray-100 rounded-lg mb-3 flex items-center justify-center text-gray-400 text-sm">
                    Nenhuma imagem selecionada
                  </div>
                  <div class="flex gap-2 justify-center">
                    <label class="btn-outline btn-sm cursor-pointer">
                      <Upload class="w-4 h-4" />
                      Enviar imagem
                      <input
                        type="file"
                        accept="image/*"
                        class="hidden"
                        @change="uploadLogo($event, 'loginBackground')"
                      />
                    </label>
                    <button
                      v-if="form.loginBackground"
                      @click="removeLogo('loginBackground')"
                      class="btn-ghost btn-sm text-red-600"
                    >
                      <Trash2 class="w-4 h-4" />
                      Remover
                    </button>
                  </div>
                  <p class="text-xs text-gray-400 mt-2 text-center">
                    Recomendado: imagem com pelo menos 1920x1080 pixels
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Colors -->
          <div class="card">
            <div class="p-4 border-b border-gray-200">
              <h3 class="font-semibold text-gray-900 flex items-center gap-2">
                <Palette class="w-5 h-5" />
                Cores
              </h3>
            </div>
            <div class="p-4">
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label class="label">Primária</label>
                  <div class="flex gap-2">
                    <input
                      v-model="form.theme!.primaryColor"
                      type="color"
                      class="w-12 h-10 rounded cursor-pointer"
                    />
                    <input
                      v-model="form.theme!.primaryColor"
                      type="text"
                      class="input flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label class="label">Destaque</label>
                  <div class="flex gap-2">
                    <input
                      v-model="form.theme!.accentColor"
                      type="color"
                      class="w-12 h-10 rounded cursor-pointer"
                    />
                    <input
                      v-model="form.theme!.accentColor"
                      type="text"
                      class="input flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label class="label">Sidebar BG</label>
                  <div class="flex gap-2">
                    <input
                      v-model="form.theme!.sidebarBg"
                      type="color"
                      class="w-12 h-10 rounded cursor-pointer"
                    />
                    <input
                      v-model="form.theme!.sidebarBg"
                      type="text"
                      class="input flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label class="label">Sidebar Texto</label>
                  <div class="flex gap-2">
                    <input
                      v-model="form.theme!.sidebarText"
                      type="color"
                      class="w-12 h-10 rounded cursor-pointer"
                    />
                    <input
                      v-model="form.theme!.sidebarText"
                      type="text"
                      class="input flex-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Typography -->
          <div class="card">
            <div class="p-4 border-b border-gray-200">
              <h3 class="font-semibold text-gray-900 flex items-center gap-2">
                <Type class="w-5 h-5" />
                Tipografia & Layout
              </h3>
            </div>
            <div class="p-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="label">Fonte</label>
                  <select v-model="form.theme!.fontFamily" class="select">
                    <option v-for="font in fontOptions" :key="font.value" :value="font.value">
                      {{ font.label }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="label">Bordas Arredondadas</label>
                  <select v-model="form.theme!.borderRadius" class="select">
                    <option v-for="radius in radiusOptions" :key="radius.value" :value="radius.value">
                      {{ radius.label }}
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- Company Info -->
          <div class="card">
            <div class="p-4 border-b border-gray-200">
              <h3 class="font-semibold text-gray-900 flex items-center gap-2">
                <Globe class="w-5 h-5" />
                Informações da Empresa
              </h3>
            </div>
            <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="label">Email</label>
                <input v-model="form.metadata!.email" type="email" class="input" />
              </div>
              <div>
                <label class="label">Telefone</label>
                <input v-model="form.metadata!.phone" type="text" class="input" />
              </div>
              <div>
                <label class="label">Website</label>
                <input v-model="form.metadata!.website" type="url" class="input" />
              </div>
              <div>
                <label class="label">Endereço</label>
                <input v-model="form.metadata!.address" type="text" class="input" />
              </div>
            </div>
          </div>

          <!-- Features -->
          <div class="card">
            <div class="p-4 border-b border-gray-200">
              <h3 class="font-semibold text-gray-900 flex items-center gap-2">
                <ToggleLeft class="w-5 h-5" />
                Funcionalidades
              </h3>
            </div>
            <div class="p-4">
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" v-model="form.features!.enableBots" class="w-4 h-4" />
                  <span class="text-sm">Bots</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" v-model="form.features!.enableWebhooks" class="w-4 h-4" />
                  <span class="text-sm">Webhooks</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" v-model="form.features!.enableExpenses" class="w-4 h-4" />
                  <span class="text-sm">Despesas</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" v-model="form.features!.enableStorage" class="w-4 h-4" />
                  <span class="text-sm">Storage</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" v-model="form.features!.enableReports" class="w-4 h-4" />
                  <span class="text-sm">Relatórios</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" v-model="form.features!.enableCannedResponses" class="w-4 h-4" />
                  <span class="text-sm">Respostas Rápidas</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" v-model="form.features!.enableTags" class="w-4 h-4" />
                  <span class="text-sm">Tags</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" v-model="form.features!.enableNotes" class="w-4 h-4" />
                  <span class="text-sm">Notas</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" v-model="form.features!.showOperatorNameInMessages" class="w-4 h-4" />
                  <span class="text-sm">Exibir nome do operador nas mensagens</span>
                </label>
              </div>

              <div class="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
                <div>
                  <label class="label">Máx. Departamentos</label>
                  <input v-model.number="form.features!.maxDepartments" type="number" min="1" class="input" />
                </div>
                <div>
                  <label class="label">Máx. Operadores</label>
                  <input v-model.number="form.features!.maxOperators" type="number" min="1" class="input" />
                </div>
              </div>

              <div class="mt-4 pt-4 border-t border-gray-200 space-y-4">
                <h4 class="text-sm font-semibold text-gray-700">Text-to-Speech (TTS)</h4>
                <div>
                  <label class="label">Provedor</label>
                  <select v-model="form.features!.ttsProvider" class="input">
                    <option value="openai">OpenAI - Boa qualidade, preço acessível</option>
                    <option value="elevenlabs">ElevenLabs - Vozes ultra-realistas, clonagem de voz</option>
                  </select>
                </div>

                <!-- OpenAI Options -->
                <template v-if="form.features!.ttsProvider === 'openai'">
                  <div>
                    <label class="label">Qualidade</label>
                    <select v-model="form.features!.ttsModel" class="input">
                      <option value="tts-1">Padrão - Mais rápido ($0.015/1k chars)</option>
                      <option value="tts-1-hd">HD - Qualidade superior ($0.030/1k chars)</option>
                    </select>
                  </div>
                  <div>
                    <label class="label">Voz Padrão</label>
                    <select v-model="form.features!.defaultTtsVoice" class="input">
                      <option value="nova">Nova - Feminina, natural</option>
                      <option value="alloy">Alloy - Neutra, versátil</option>
                      <option value="echo">Echo - Masculina, suave</option>
                      <option value="fable">Fable - Masculina, narrativa</option>
                      <option value="onyx">Onyx - Masculina, grave</option>
                      <option value="shimmer">Shimmer - Feminina, clara</option>
                    </select>
                  </div>
                </template>

                <!-- ElevenLabs Options -->
                <template v-if="form.features!.ttsProvider === 'elevenlabs'">
                  <!-- Selecionar voz -->
                  <div>
                    <label class="label">Voz</label>
                    <div class="flex gap-2">
                      <select
                        v-model="form.features!.elevenLabsVoiceId"
                        class="input flex-1"
                      >
                        <option value="">Selecione uma voz...</option>
                        <optgroup label="Vozes pré-prontas" v-if="elevenLabsVoices.filter(v => v.category === 'premade').length">
                          <option
                            v-for="voice in elevenLabsVoices.filter(v => v.category === 'premade')"
                            :key="voice.voiceId"
                            :value="voice.voiceId"
                          >
                            {{ voice.name }}
                          </option>
                        </optgroup>
                        <optgroup label="Suas vozes" v-if="elevenLabsVoices.filter(v => v.category !== 'premade').length">
                          <option
                            v-for="voice in elevenLabsVoices.filter(v => v.category !== 'premade')"
                            :key="voice.voiceId"
                            :value="voice.voiceId"
                          >
                            {{ voice.name }}
                          </option>
                        </optgroup>
                      </select>
                      <button
                        @click="fetchElevenLabsVoices"
                        :disabled="isLoadingVoices"
                        type="button"
                        class="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all"
                        title="Atualizar lista de vozes"
                      >
                        <Loader2 v-if="isLoadingVoices" class="w-4 h-4 animate-spin" />
                        <RefreshCw v-else class="w-4 h-4" />
                      </button>
                    </div>
                    <!-- Preview da voz selecionada -->
                    <div v-if="form.features!.elevenLabsVoiceId && elevenLabsVoices.length" class="mt-2">
                      <button
                        v-if="elevenLabsVoices.find(v => v.voiceId === form.features!.elevenLabsVoiceId)?.previewUrl"
                        @click="previewVoice(elevenLabsVoices.find(v => v.voiceId === form.features!.elevenLabsVoiceId)!)"
                        type="button"
                        class="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                      >
                        <Play class="w-3 h-3" />
                        {{ previewingVoiceId === form.features!.elevenLabsVoiceId ? 'Reproduzindo...' : 'Ouvir preview' }}
                      </button>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">
                      Clique em atualizar para carregar as vozes da sua conta ElevenLabs.
                      Você também pode colar um Voice ID manualmente.
                    </p>
                  </div>

                  <!-- Clonar voz (opcional, colapsável) -->
                  <div class="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      @click="showCloneSection = !showCloneSection"
                      type="button"
                      class="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-all"
                    >
                      <span class="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Mic class="w-4 h-4" />
                        Clonar minha voz (opcional)
                      </span>
                      <ChevronDown
                        class="w-4 h-4 text-gray-400 transition-transform"
                        :class="{ 'rotate-180': showCloneSection }"
                      />
                    </button>
                    <div v-if="showCloneSection" class="p-4 space-y-3 border-t border-gray-200">
                      <p class="text-xs text-gray-500">
                        Requer plano Starter ou superior na ElevenLabs.
                      </p>
                      <div>
                        <label class="label">Nome da voz</label>
                        <input
                          v-model="cloneVoiceName"
                          type="text"
                          class="input"
                          placeholder="Ex: Matheus, Atendente..."
                        />
                      </div>

                      <!-- Gravar áudio ou enviar arquivo -->
                      <div>
                        <label class="label">Áudio da sua voz (mín. 30s)</label>

                        <div v-if="!isRecordingClone && !cloneRecordedAudioUrl" class="flex flex-col gap-2">
                          <div class="flex gap-2">
                            <button
                              @click="startCloneRecording"
                              type="button"
                              class="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 transition-all"
                            >
                              <Mic class="w-4 h-4" />
                              Gravar áudio
                            </button>
                            <span class="text-xs text-gray-400 self-center">ou</span>
                            <label class="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 cursor-pointer transition-all">
                              <Upload class="w-4 h-4" />
                              Enviar arquivo
                              <input
                                type="file"
                                accept="audio/*"
                                @change="handleCloneAudioChange"
                                class="hidden"
                              />
                            </label>
                          </div>
                          <div v-if="cloneAudioFile && !cloneRecordedAudioUrl" class="flex items-center gap-2 text-sm text-gray-600">
                            <span>{{ cloneAudioFile.name }}</span>
                            <button @click="cloneAudioFile = null" class="text-red-500 hover:text-red-700 text-xs">&times;</button>
                          </div>
                        </div>

                        <div v-if="isRecordingClone" class="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                          <span class="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                          <span class="text-sm font-medium text-red-700">Gravando {{ formatRecordingTime(recordingCloneTime) }}</span>
                          <button
                            @click="stopCloneRecording"
                            type="button"
                            class="ml-auto flex items-center gap-1 px-3 py-1 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-all"
                          >
                            <Square class="w-3 h-3" />
                            Parar
                          </button>
                        </div>

                        <div v-if="cloneRecordedAudioUrl && !isRecordingClone" class="flex flex-col gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                          <div class="flex items-center gap-2">
                            <span class="text-sm font-medium text-green-700">Áudio gravado</span>
                            <button
                              @click="discardCloneRecording"
                              type="button"
                              class="ml-auto text-xs text-red-500 hover:text-red-700"
                            >
                              <Trash2 class="w-3 h-3 inline" /> Descartar
                            </button>
                          </div>
                          <audio :src="cloneRecordedAudioUrl" controls class="w-full h-8" />
                        </div>
                      </div>

                      <button
                        @click="cloneVoice"
                        :disabled="!cloneAudioFile || isCloning"
                        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <Loader2 v-if="isCloning" class="w-4 h-4 animate-spin" />
                        <Mic v-else class="w-4 h-4" />
                        {{ isCloning ? 'Clonando...' : 'Clonar Voz' }}
                      </button>
                    </div>
                  </div>

                  <div class="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p class="text-xs text-amber-700">
                      Configure a variável <strong>ELEVENLABS_API_KEY</strong> no .env do servidor para usar este provedor.
                    </p>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <!-- Custom CSS -->
          <div class="card">
            <div class="p-4 border-b border-gray-200">
              <h3 class="font-semibold text-gray-900 flex items-center gap-2">
                <Settings class="w-5 h-5" />
                CSS Personalizado
              </h3>
            </div>
            <div class="p-4">
              <textarea
                v-model="form.customCss"
                class="textarea font-mono text-sm"
                rows="6"
                placeholder="/* Adicione seu CSS personalizado aqui */"
              />
            </div>
          </div>
        </div>

        <!-- Preview Column -->
        <div class="lg:col-span-1">
          <div class="card sticky top-4">
            <div class="p-4 border-b border-gray-200">
              <h3 class="font-semibold text-gray-900 flex items-center gap-2">
                <Eye class="w-5 h-5" />
                Preview
              </h3>
            </div>
            <div class="p-4">
              <!-- Mini preview -->
              <div class="border border-gray-200 rounded-lg overflow-hidden">
                <!-- Sidebar preview -->
                <div class="flex">
                  <div
                    class="w-16 p-2"
                    :style="{ backgroundColor: previewTheme?.sidebarBg }"
                  >
                    <div class="space-y-2">
                      <div
                        class="w-full aspect-square rounded-lg flex items-center justify-center"
                        :style="{ backgroundColor: previewTheme?.primaryColor }"
                      >
                        <span class="text-white text-lg font-bold">
                          {{ form.companyName?.charAt(0) || 'S' }}
                        </span>
                      </div>
                      <div
                        v-for="i in 4"
                        :key="i"
                        class="w-full h-6 rounded opacity-50"
                        :style="{ backgroundColor: previewTheme?.sidebarText }"
                      />
                    </div>
                  </div>

                  <!-- Content preview -->
                  <div class="flex-1 bg-gray-50 p-2">
                    <div
                      class="h-8 rounded-lg mb-2 flex items-center px-2"
                      :style="{ backgroundColor: previewTheme?.headerBg }"
                    >
                      <span
                        class="text-xs font-medium"
                        :style="{ color: previewTheme?.headerText }"
                      >
                        {{ form.companyName }}
                      </span>
                    </div>
                    <div class="space-y-2">
                      <div
                        class="h-20 rounded-lg"
                        :style="{
                          backgroundColor: 'white',
                          borderRadius: {
                            none: '0',
                            sm: '0.25rem',
                            md: '0.5rem',
                            lg: '0.75rem',
                            full: '9999px'
                          }[previewTheme?.borderRadius || 'lg']
                        }"
                      />
                      <div class="flex gap-2">
                        <button
                          class="flex-1 py-1 text-xs text-white rounded"
                          :style="{ backgroundColor: previewTheme?.primaryColor }"
                        >
                          Primário
                        </button>
                        <button
                          class="flex-1 py-1 text-xs text-white rounded"
                          :style="{ backgroundColor: previewTheme?.accentColor }"
                        >
                          Destaque
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Color swatches -->
              <div class="mt-4 space-y-2">
                <p class="text-xs font-medium text-gray-500 uppercase">Paleta de Cores</p>
                <div class="flex gap-2">
                  <div
                    class="w-8 h-8 rounded-full"
                    :style="{ backgroundColor: previewTheme?.primaryColor }"
                    title="Primária"
                  />
                  <div
                    class="w-8 h-8 rounded-full"
                    :style="{ backgroundColor: previewTheme?.primaryColorDark }"
                    title="Primária Dark"
                  />
                  <div
                    class="w-8 h-8 rounded-full"
                    :style="{ backgroundColor: previewTheme?.primaryColorLight }"
                    title="Primária Light"
                  />
                  <div
                    class="w-8 h-8 rounded-full"
                    :style="{ backgroundColor: previewTheme?.accentColor }"
                    title="Destaque"
                  />
                  <div
                    class="w-8 h-8 rounded-full"
                    :style="{ backgroundColor: previewTheme?.sidebarBg }"
                    title="Sidebar"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Reset Confirm -->
    <Teleport to="body">
      <ConfirmModal
        v-if="showResetConfirm"
        title="Restaurar configurações"
        message="Tem certeza que deseja restaurar todas as configurações para o padrão?"
        variant="warning"
        @confirm="resetToDefault"
        @cancel="showResetConfirm = false"
      />
    </Teleport>
  </div>
</template>
