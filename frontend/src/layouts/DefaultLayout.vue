<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import TheSidebar from '@/components/layout/TheSidebar.vue'
import TheHeader from '@/components/layout/TheHeader.vue'
import { useUiStore } from '@/stores/ui'
import {
  SYSTEM_NOTIFICATION_EVENT,
  NOTIFICATION_EVENT_LABELS,
  type NotificationEventType,
} from '@/services/notifications'
import { useNotificationStore } from '@/stores/notifications'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const uiStore = useUiStore()
const notificationStore = useNotificationStore()

const handleSystemNotification = (event: Event) => {
  const detail = (event as CustomEvent<{
    conversationId: string
    snippet?: string
    conversationName?: string
    identifier?: string
    eventType?: NotificationEventType
  }>).detail
  if (!detail?.conversationId) return

  const eventType = detail.eventType || 'message'
  const eventLabel = NOTIFICATION_EVENT_LABELS[eventType]
  const title = detail.conversationName || detail.identifier || eventLabel
  const message = detail.snippet || 'Nova mensagem recebida'

  notificationStore.addNotification({
    conversationId: detail.conversationId,
    snippet: message,
    conversationName: detail.conversationName,
    identifier: detail.identifier,
    eventType,
  })

  toast.info(`${eventLabel} · ${title}`, {
    timeout: 5000,
    closeOnClick: true,
    pauseOnFocusLoss: true,
    toastClassName: 'cursor-pointer',
    onClick: () => void router.push(
      eventType === 'queue' ? '/assumir' : `/conversations/${detail.conversationId}`
    ),
  })
}

// Hide header on mobile for conversation detail (has its own header)
const showHeader = computed(() => {
  if (uiStore.isMobile && route.name === 'conversation-detail') {
    return false
  }
  return true
})

onMounted(() => {
  window.addEventListener(SYSTEM_NOTIFICATION_EVENT, handleSystemNotification)
})

onUnmounted(() => {
  window.removeEventListener(SYSTEM_NOTIFICATION_EVENT, handleSystemNotification)
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Mobile sidebar overlay -->
    <div
      v-if="uiStore.isMobile && uiStore.sidebarOpen"
      class="fixed inset-0 bg-black/50 z-40 lg:hidden"
      @click="uiStore.closeSidebar"
    />

    <!-- Sidebar -->
    <TheSidebar />

    <!-- Main content -->
    <div
      class="transition-all duration-300 h-screen flex flex-col"
      :class="{
        'lg:pl-64': !uiStore.sidebarCollapsed,
        'lg:pl-20': uiStore.sidebarCollapsed
      }"
    >
      <TheHeader v-if="showHeader" />
      <main class="flex-1 overflow-y-auto" :class="!showHeader || route.name === 'conversation-detail' ? '' : 'p-4 lg:p-6'">
        <RouterView />
      </main>
    </div>
  </div>
</template>
