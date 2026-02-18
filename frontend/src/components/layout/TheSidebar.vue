<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import { useWhitelabelStore } from '@/stores/whitelabel'
import { useAuthStore } from '@/stores/auth'
import {
  LayoutDashboard,
  MessageSquare,
  Inbox,
  UserCheck,
  Building2,
  Users,
  Bot,
  Webhook,
  HardDrive,
  Receipt,
  Settings,
  Palette,
  ChevronLeft,
  X,
  Smartphone,
  ClipboardList,
  BarChart3,
  Sparkles,
  Tags,
  ListFilter,
  Archive,
  Zap,
  KanbanSquare,
  Calendar,
  Clock,
  Briefcase,
  UserCircle
} from 'lucide-vue-next'

const route = useRoute()
const uiStore = useUiStore()
const whitelabelStore = useWhitelabelStore()
const authStore = useAuthStore()

const decodeRoleFromToken = (token: string | null | undefined): string | null => {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(decodeURIComponent(escape(atob(base64))))
    return typeof payload?.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

interface NavItem {
  name: string
  path: string
  icon: any
  badge?: number
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups = computed<NavGroup[]>(() => {
  const role = authStore.user?.role || decodeRoleFromToken(authStore.token)

  if (role === 'operator') {
    return [
      {
        title: 'Atendimento',
        items: [
          { name: 'Assumir', path: '/assumir', icon: UserCheck },
          { name: 'Conversas', path: '/conversations', icon: MessageSquare },
        ]
      },
      {
        title: 'Comercial',
        items: [
          { name: 'Agenda', path: '/appointments', icon: Calendar },
        ]
      }
    ]
  }

  return [
        {
          title: 'Atendimento',
          items: [
            { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
            { name: 'Métricas', path: '/metricas', icon: BarChart3 },
            { name: 'Assumir', path: '/assumir', icon: UserCheck },
            { name: 'Conversas', path: '/conversations', icon: MessageSquare },
            { name: 'Todas Conversas', path: '/all-conversations', icon: ListFilter },
            { name: 'Arquivadas', path: '/all-conversations?archived=true', icon: Archive },
            { name: 'Contatos', path: '/contacts', icon: Users },
          ]
        },
    {
      title: 'Comercial',
      items: [
        { name: 'Quadro', path: '/pipeline', icon: KanbanSquare },
        { name: 'Agenda', path: '/appointments', icon: Calendar },
        { name: 'Serviços', path: '/services', icon: Briefcase },
        { name: 'Profissionais', path: '/professionals', icon: UserCircle },
        { name: 'Disponibilidade', path: '/availability', icon: Clock },
      ]
    },
    {
      title: 'Equipe',
      items: [
        { name: 'Departamentos', path: '/departments', icon: Building2 },
        { name: 'Operadores', path: '/operators', icon: Users },
      ]
    },
    {
      title: 'Automação',
      items: [
        { name: 'Bot Builder', path: '/bot-builder', icon: Bot },
        ...(whitelabelStore.isFeatureEnabled('enableWebhooks') ? [{ name: 'Webhooks', path: '/webhooks', icon: Webhook }] : []),
      ]
    },
    {
      title: 'IA',
      items: [
        { name: 'Assistente IA', path: '/ia', icon: Sparkles },
      ]
    },
        {
          title: 'Sistema',
          items: [
            { name: 'Instâncias', path: '/whatsapp', icon: Smartphone },
            ...(whitelabelStore.isFeatureEnabled('enableStorage') ? [{ name: 'Storage', path: '/storage', icon: HardDrive }] : []),
            // ...(whitelabelStore.isFeatureEnabled('enableExpenses') ? [{ name: 'Despesas', path: '/expenses', icon: Receipt }] : []),
            { name: 'Finalizações', path: '/finalizations', icon: ClipboardList },
            { name: 'Tags', path: '/tags', icon: Tags },
            ...(whitelabelStore.isFeatureEnabled('enableCannedResponses') ? [{ name: 'Respostas Rápidas', path: '/canned-responses', icon: Zap }] : []),
            { name: 'Personalização', path: '/whitelabel', icon: Palette },
          ]
        }
  ]
})
const isActive = (path: string) => {
  if (path === '/conversations') {
    return route.path.startsWith('/conversations')
  }
  // Handle paths with query params
  if (path.includes('?')) {
    const [basePath, queryString] = path.split('?')
    if (route.path !== basePath) return false
    const params = new URLSearchParams(queryString)
    for (const [key, value] of params.entries()) {
      if (route.query[key] !== value) return false
    }
    return true
  }
  // For /all-conversations without query, only match if no archived param
  if (path === '/all-conversations') {
    return route.path === path && !route.query.archived
  }
  return route.path === path
}

const sidebarClasses = computed(() => {
  const base = 'fixed top-0 left-0 z-50 h-full bg-white border-r border-gray-200 transition-all duration-300'

  if (uiStore.isMobile) {
    return `${base} w-64 ${uiStore.sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
  }

  return `${base} ${uiStore.sidebarCollapsed ? 'w-20' : 'w-64'}`
})
</script>

<template>
  <aside :class="sidebarClasses">
    <!-- Logo -->
    <div class="h-16 flex items-center justify-between px-4 border-b border-gray-200">
      <RouterLink
        to="/dashboard"
        class="flex items-center gap-3"
        @click="uiStore.closeSidebar"
      >
        <img
          v-if="whitelabelStore.logoSmall && (uiStore.sidebarCollapsed && !uiStore.isMobile)"
          :src="whitelabelStore.logoSmall"
          class="w-10 h-10 object-contain"
          :alt="whitelabelStore.companyName"
        />
        <img
          v-else-if="whitelabelStore.logo"
          :src="whitelabelStore.logo"
          class="h-10 object-contain"
          :alt="whitelabelStore.companyName"
        />
        <template v-else>
          <div class="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center">
            <MessageSquare class="w-5 h-5 text-white" />
          </div>
          <span
            v-if="!uiStore.sidebarCollapsed || uiStore.isMobile"
            class="font-bold text-xl text-gray-900"
          >
            {{ whitelabelStore.companyName }}
          </span>
        </template>
      </RouterLink>

      <!-- Mobile close button -->
      <button
        v-if="uiStore.isMobile"
        @click="uiStore.closeSidebar"
        class="p-2 rounded-lg hover:bg-gray-100"
      >
        <X class="w-5 h-5 text-gray-500" />
      </button>

      <!-- Desktop collapse button -->
      <button
        v-else
        @click="uiStore.toggleSidebar"
        class="p-2 rounded-lg hover:bg-gray-100 transition-transform"
        :class="{ 'rotate-180': uiStore.sidebarCollapsed }"
      >
        <ChevronLeft class="w-5 h-5 text-gray-500" />
      </button>
    </div>

    <!-- Navigation -->
    <nav class="p-4 space-y-6 overflow-y-auto" style="max-height: calc(100vh - 8rem)">
      <div v-for="group in navGroups" :key="group.title">
        <template v-if="group.items.length > 0">
          <p
            v-if="!uiStore.sidebarCollapsed || uiStore.isMobile"
            class="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider"
          >
            {{ group.title }}
          </p>
          <div v-else class="h-px bg-gray-200 my-2 mx-3" />

          <div class="space-y-1">
            <RouterLink
              v-for="item in group.items"
              :key="item.path"
              :to="item.path"
              @click="uiStore.closeSidebar"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
              :class="[
                isActive(item.path)
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              ]"
            >
              <component
                :is="item.icon"
                class="w-5 h-5 flex-shrink-0"
                :class="[
                  isActive(item.path) ? 'text-primary-600' : 'text-gray-400'
                ]"
              />
              <span
                v-if="!uiStore.sidebarCollapsed || uiStore.isMobile"
                class="font-medium flex-1"
              >
                {{ item.name }}
              </span>
              <span
                v-if="item.badge && (!uiStore.sidebarCollapsed || uiStore.isMobile)"
                class="px-2 py-0.5 text-xs font-medium rounded-full bg-primary-100 text-primary-700"
              >
                {{ item.badge }}
              </span>
            </RouterLink>
          </div>
        </template>
      </div>
    </nav>

    <!-- Footer -->
    <div
      v-if="!uiStore.sidebarCollapsed || uiStore.isMobile"
      class="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200"
    >
      <p class="text-xs text-gray-400 text-center">
        ScarlatChat v1.0.0
      </p>
    </div>
  </aside>
</template>


