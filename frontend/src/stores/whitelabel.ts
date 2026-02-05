import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { whitelabelApi } from '@/api'
import type { WhitelabelSettings, ThemeSettings } from '@/types'

const defaultTheme: ThemeSettings = {
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
}

const defaultSettings: WhitelabelSettings = {
  _id: '',
  companyName: 'welloChat',
  protocolIdentifier: '',
  theme: defaultTheme,
  metadata: {},
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
  automaticMessages: {
    welcome: {
      enabled: false,
      message: 'Olá! Seja bem-vindo. Em breve um atendente irá atendê-lo.'
    },
    assign: {
      enabled: false,
      message: 'Olá! Meu nome é {operatorName} e vou atendê-lo.'
    },
    finalization: {
      enabled: false,
      message: 'Atendimento finalizado. Obrigado pelo contato!'
    }
  }
}

export const useWhitelabelStore = defineStore('whitelabel', () => {
  const settings = ref<WhitelabelSettings>(defaultSettings)
  const isLoading = ref(false)
  const isLoaded = ref(false)

  const companyName = computed(() => settings.value.companyName)
  const theme = computed(() => settings.value.theme)
  const features = computed(() => settings.value.features)
  const logo = computed(() => settings.value.logo)
  const logoSmall = computed(() => settings.value.logoSmall)
  const favicon = computed(() => settings.value.favicon)
  const loginBackground = computed(() => settings.value.loginBackground)

  async function fetchSettings(force = false) {
    if (isLoaded.value && !force) return settings.value

    isLoading.value = true
    try {
      const response = await whitelabelApi.get()
      if (response.data) {
        settings.value = { ...defaultSettings, ...response.data }
        applyTheme(settings.value.theme)
      }
      isLoaded.value = true
      return settings.value
    } catch {
      // Use default settings on error
      applyTheme(defaultTheme)
      return settings.value
    } finally {
      isLoading.value = false
    }
  }

  async function updateSettings(payload: Partial<WhitelabelSettings>) {
    try {
      const response = await whitelabelApi.update(payload)
      if (response.data) {
        settings.value = { ...settings.value, ...response.data }
        if (payload.theme) {
          applyTheme(settings.value.theme)
        }
        // Aplica favicon se foi atualizado
        if (payload.favicon) {
          applyFavicon(payload.favicon)
        }
      }
      return response.data
    } catch (error) {
      throw error
    }
  }

  function applyTheme(theme: ThemeSettings) {
    const root = document.documentElement

    // Primary colors
    root.style.setProperty('--color-primary', theme.primaryColor)
    root.style.setProperty('--color-primary-dark', theme.primaryColorDark)
    root.style.setProperty('--color-primary-light', theme.primaryColorLight)
    root.style.setProperty('--color-accent', theme.accentColor)

    // Sidebar
    root.style.setProperty('--color-sidebar-bg', theme.sidebarBg)
    root.style.setProperty('--color-sidebar-text', theme.sidebarText)

    // Header
    root.style.setProperty('--color-header-bg', theme.headerBg)
    root.style.setProperty('--color-header-text', theme.headerText)

    // Font
    root.style.setProperty('--font-family', theme.fontFamily)

    // Border radius
    const radiusMap = {
      none: '0',
      sm: '0.25rem',
      md: '0.5rem',
      lg: '0.75rem',
      full: '9999px'
    }
    root.style.setProperty('--border-radius', radiusMap[theme.borderRadius])

    // Apply custom CSS if present
    if (settings.value.customCss) {
      let styleEl = document.getElementById('whitelabel-custom-css')
      if (!styleEl) {
        styleEl = document.createElement('style')
        styleEl.id = 'whitelabel-custom-css'
        document.head.appendChild(styleEl)
      }
      styleEl.textContent = settings.value.customCss
    }

    // Apply favicon if present
    applyFavicon(settings.value.favicon)
  }

  function applyFavicon(faviconUrl?: string) {
    if (!faviconUrl) return

    let linkEl = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!linkEl) {
      linkEl = document.createElement('link')
      linkEl.rel = 'icon'
      document.head.appendChild(linkEl)
    }
    linkEl.href = faviconUrl
  }

  function isFeatureEnabled(feature: keyof WhitelabelSettings['features']): boolean {
    return features.value[feature] as boolean
  }

  return {
    settings,
    isLoading,
    isLoaded,
    companyName,
    theme,
    features,
    logo,
    logoSmall,
    favicon,
    loginBackground,
    fetchSettings,
    updateSettings,
    applyTheme,
    applyFavicon,
    isFeatureEnabled
  }
})

