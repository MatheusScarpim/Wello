<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'
import { NOTIFICATION_EVENT_LABELS } from '@/services/notifications'
import { whatsappApi } from '@/api'
import {
  Menu,
  Bell,
  User,
  Wifi,
  WifiOff,
  RefreshCw,
  LogOut,
  Key
} from 'lucide-vue-next'
import type { WhatsAppStatus } from '@/types'

const route = useRoute()
const router = useRouter()
const uiStore = useUiStore()
const authStore = useAuthStore()
const notificationStore = useNotificationStore()

const whatsappStatus = ref<WhatsAppStatus | null>(null)
const isLoadingStatus = ref(false)
const showUserMenu = ref(false)
const showNotificationsMenu = ref(false)
const showTokenModal = ref(false)

async function fetchWhatsAppStatus() {
  isLoadingStatus.value = true
  try {
    const response = await whatsappApi.getStatus()
    if (response.data) {
      whatsappStatus.value = response.data
    }
  } catch (error) {
    console.error('Erro ao buscar status do WhatsApp:', error)
  } finally {
    isLoadingStatus.value = false
  }
}

async function reconnectWhatsApp() {
  try {
    await whatsappApi.reconnect()
    await fetchWhatsAppStatus()
  } catch (error) {
    console.error('Erro ao reconectar WhatsApp:', error)
  }
}

// Fetch status on mount and every 30 seconds
let statusInterval: ReturnType<typeof setInterval>
onMounted(() => {
  fetchWhatsAppStatus()
  statusInterval = setInterval(fetchWhatsAppStatus, 30000)
})

onUnmounted(() => {
  clearInterval(statusInterval)
})

// Close menu on click outside
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.user-menu-container')) {
    showUserMenu.value = false
  }
  if (!target.closest('.notification-menu-container')) {
    showNotificationsMenu.value = false
  }
}

const openNotification = (conversationId: string, eventType?: string) => {
  showNotificationsMenu.value = false
  const path = eventType === 'queue' ? '/assumir' : `/conversations/${conversationId}`
  void router.push(path)
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <header class="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
    <!-- Left side -->
    <div class="flex items-center gap-4">
      <!-- Mobile menu button -->
      <button
        v-if="uiStore.isMobile"
        @click="uiStore.toggleSidebar"
        class="p-2 rounded-lg hover:bg-gray-100"
      >
        <Menu class="w-5 h-5 text-gray-600" />
      </button>

      <!-- Page title -->
      <h1 class="text-lg font-semibold text-gray-900">
        {{ route.meta.title || 'Dashboard' }}
      </h1>
    </div>

    <!-- Right side -->
    <div class="flex items-center gap-3">
      <!-- WhatsApp status -->
      <div
        class="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
        :class="[
          whatsappStatus?.connected
            ? 'bg-green-50 text-green-700'
            : 'bg-red-50 text-red-700'
        ]"
      >
        <component
          :is="whatsappStatus?.connected ? Wifi : WifiOff"
          class="w-4 h-4"
        />
        <span class="hidden sm:inline">
          {{ whatsappStatus?.connected ? 'Conectado' : 'Desconectado' }}
        </span>
        <button
          v-if="!whatsappStatus?.connected"
          @click="reconnectWhatsApp"
          class="p-1 hover:bg-red-100 rounded-full"
          title="Reconectar"
        >
          <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': isLoadingStatus }" />
        </button>
      </div>

      <!-- Notifications -->
      <div class="relative notification-menu-container">
        <button
          @click="showNotificationsMenu = !showNotificationsMenu; if (showNotificationsMenu) notificationStore.markAllRead()"
          class="p-2 rounded-lg hover:bg-gray-100 relative"
          aria-label="Notificações"
        >
          <Bell class="w-5 h-5 text-gray-600" />
          <span
            v-if="notificationStore.unreadCount > 0"
            class="absolute top-1 right-1 w-2 h-2 bg-primary-500 rounded-full"
          />
        </button>
        <div
          v-if="showNotificationsMenu"
          class="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden"
        >
          <div class="px-4 py-2 border-b border-gray-100 font-semibold text-sm text-gray-700">
            Notificações recentes
          </div>
          <div class="max-h-80 overflow-y-auto">
            <button
              v-if="notificationStore.notifications.length === 0"
              class="w-full text-left px-4 py-3 text-sm text-gray-500 bg-gray-50"
              type="button"
            >
              Sem notificações
            </button>
            <button
              v-for="note in notificationStore.notifications"
              :key="note.id"
              @click="openNotification(note.conversationId, note.eventType)"
              class="w-full text-left px-4 py-3 hover:bg-gray-100 transition-colors space-y-1"
              type="button"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  <span
                    v-if="note.eventType"
                    class="text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full bg-primary-100 text-primary-700"
                  >
                    {{ NOTIFICATION_EVENT_LABELS[note.eventType] }}
                  </span>
                  <div class="text-sm font-semibold text-gray-900 truncate">
                    {{ note.conversationName || note.identifier || 'Conversa' }}
                  </div>
                </div>
                <div class="text-xs text-gray-400 flex-shrink-0 ml-2">
                  {{ new Date(note.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }}
                </div>
              </div>
              <div class="text-xs text-gray-500">
                {{ note.identifier }}
              </div>
              <div class="text-sm text-gray-800">
                {{ note.snippet }}
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- User menu -->
      <div class="relative user-menu-container">
        <button
          @click="showUserMenu = !showUserMenu"
          class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100"
        >
          <div class="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
            <User class="w-4 h-4 text-primary-600" />
          </div>
        </button>

        <!-- Dropdown -->
        <div
          v-if="showUserMenu"
          class="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50"
        >
          <div class="px-4 py-2 border-b border-gray-100">
            <p class="text-sm font-medium text-gray-900">
              {{ authStore.user?.email || 'Usuário' }}
            </p>
            <p class="text-xs text-gray-500">
              {{ authStore.user?.role || 'Sem autenticação' }}
            </p>
          </div>

          <button
            @click="showTokenModal = true; showUserMenu = false"
            class="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Key class="w-4 h-4" />
            Configurar Token
          </button>

          <button
            v-if="authStore.isAuthenticated"
            @click="authStore.logout(); showUserMenu = false; router.push('/login')"
            class="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut class="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>
    </div>

    <!-- Token Modal -->
    <Teleport to="body">
      <TokenModal
        v-if="showTokenModal"
        @close="showTokenModal = false"
      />
    </Teleport>
  </header>
</template>

<script lang="ts">
import TokenModal from '@/components/modals/TokenModal.vue'
export default {
  components: { TokenModal }
}
</script>
