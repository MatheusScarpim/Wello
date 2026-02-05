<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useWhitelabelStore } from '@/stores/whitelabel'
import { whitelabelApi, storageApi } from '@/api'
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
  Save
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
    showOperatorNameInMessages: false
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
