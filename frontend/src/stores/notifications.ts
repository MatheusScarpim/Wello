import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { NotificationEventType } from '@/services/notifications'

type NotificationItem = {
  id: string
  conversationId: string
  snippet: string
  conversationName?: string
  identifier?: string
  eventType: NotificationEventType
  createdAt: number
  read: boolean
}

const MAX_NOTIFICATIONS = 30

const generateId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const useNotificationStore = defineStore('notifications', () => {
  const notifications = ref<NotificationItem[]>([])

  const unreadCount = computed(
    () => notifications.value.filter((item) => !item.read).length,
  )

  const addNotification = (payload: {
    conversationId: string
    snippet?: string
    conversationName?: string
    identifier?: string
    eventType?: NotificationEventType
    messageId?: string
  }) => {
    if (!payload.conversationId) return

    const eventType = payload.eventType ?? 'message'

    const snippet = payload.snippet?.trim() || 'Nova mensagem recebida'
    const id = payload.messageId || generateId()

    const existsIndex = notifications.value.findIndex((item) => item.id === id)
    if (existsIndex !== -1) {
      notifications.value[existsIndex] = {
        ...notifications.value[existsIndex],
        snippet,
        conversationName: payload.conversationName,
        identifier: payload.identifier,
        eventType,
        createdAt: Date.now(),
        read: false,
      }
      return
    }

    notifications.value.unshift({
      id,
      conversationId: payload.conversationId,
      snippet,
      conversationName: payload.conversationName,
      identifier: payload.identifier,
      eventType,
      createdAt: Date.now(),
      read: false,
    })

    if (notifications.value.length > MAX_NOTIFICATIONS) {
      notifications.value.splice(MAX_NOTIFICATIONS)
    }
  }

  const markAllRead = () => {
    notifications.value = notifications.value.map((item) => ({
      ...item,
      read: true,
    }))
  }

  const clear = () => {
    notifications.value = []
  }

  return {
    notifications,
    unreadCount,
    addNotification,
    markAllRead,
    clear,
  }
})
