import type { Router } from 'vue-router'
import { conversationsApi } from '@/api'

export const SYSTEM_NOTIFICATION_EVENT = 'app:message-notification'

export type NotificationEventType =
  | 'message'
  | 'queue'
  | 'assigned'
  | 'finalized'
  | 'conversation'

export const NOTIFICATION_EVENT_LABELS: Record<NotificationEventType, string> = {
  message: 'Nova mensagem',
  queue: 'Nova conversa',
  assigned: 'Conversa atribuída',
  finalized: 'Conversa finalizada',
  conversation: 'Atualização',
}

type SocketMessageDetail = {
  conversationId: string
  messageId?: string
  content?: string
  direction?: 'incoming' | 'outgoing'
}

type ConversationMeta = {
  name?: string
  identifier?: string
  operatorId?: string | null
  archived?: boolean
  updatedAt: number
}

type NotificationPayload = SocketMessageDetail & {
  conversationName?: string
  identifier?: string
  snippet?: string
  operatorId?: string | null
  archived?: boolean
  eventType: NotificationEventType
}

const PREFERRED_FREQUENCY = 520
const NOTIFICATION_TAG_PREFIX = 'conversation-notification-'
const CONVERSATION_CACHE_TTL = 5 * 60 * 1000

let audioContext: AudioContext | null = null
let listenerRegistered = false
let permissionRequested = false

const conversationCache = new Map<string, ConversationMeta>()

const ensureAudioContext = (): AudioContext | null => {
  if (audioContext) {
    if (audioContext.state === 'suspended') {
      void audioContext.resume()
    }
    return audioContext
  }

  const ContextClass =
    window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!ContextClass) return null

  audioContext = new ContextClass()

  const unlock = () => {
    if (audioContext && audioContext.state === 'suspended') {
      void audioContext.resume()
    }
    document.removeEventListener('click', unlock)
    document.removeEventListener('keydown', unlock)
  }

  document.addEventListener('click', unlock, { once: true })
  document.addEventListener('keydown', unlock, { once: true })

  return audioContext
}

const playNotificationTone = () => {
  try {
    const context = ensureAudioContext()
    if (!context) return

    const oscillator = context.createOscillator()
    const gainNode = context.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(PREFERRED_FREQUENCY, context.currentTime)
    gainNode.gain.setValueAtTime(0.17, context.currentTime)

    oscillator.connect(gainNode)
    gainNode.connect(context.destination)

    oscillator.start()
    oscillator.stop(context.currentTime + 0.17)
  } catch {
    /* AudioContext may be blocked until user interaction, ignore failures. */
  }
}

const triggerVibration = () => {
  if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
    navigator.vibrate(220)
  }
}

const isConversationVisible = (router: Router, conversationId: string) => {
  const currentRoute = router.currentRoute.value
  return (
    currentRoute.name === 'conversation-detail' &&
    String(currentRoute.params.id) === conversationId
  )
}

const maybeRequestNotificationPermission = () => {
  if (permissionRequested) return
  if (!('Notification' in window)) return
  if (Notification.permission !== 'default') return

  permissionRequested = true
  void Notification.requestPermission()
}

const buildSnippet = (detail: SocketMessageDetail) =>
  detail.content?.trim().slice(0, 120) || 'Nova mensagem recebida'

const determineEventType = (info: {
  messageId?: string
  operatorId?: string | null
  archived?: boolean
}): NotificationEventType => {
  if (info.messageId) {
    if (!info.operatorId && !info.archived) {
      return 'queue'
    }
    return 'message'
  }

  if (info.archived) {
    return 'finalized'
  }

  if (info.operatorId) {
    return 'assigned'
  }

  return 'conversation'
}

const getConversationMeta = async (conversationId: string) => {
  const cached = conversationCache.get(conversationId)
  if (cached && Date.now() - cached.updatedAt < CONVERSATION_CACHE_TTL) {
    return cached
  }

  try {
    const response = await conversationsApi.getById(conversationId)
    if (response.data) {
      const meta: ConversationMeta = {
        name: response.data.name,
        identifier: response.data.identifier,
        operatorId: response.data.operatorId ?? null,
        archived: response.data.archived ?? false,
        updatedAt: Date.now(),
      }
      conversationCache.set(conversationId, meta)
      return meta
    }
  } catch {
    /* Ignore failures, still return cached data if available. */
  }

  const fallback: ConversationMeta = cached || { updatedAt: Date.now() }
  conversationCache.set(conversationId, fallback)
  return fallback
}

const showBrowserNotification = (detail: NotificationPayload, router: Router) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  const eventLabel = NOTIFICATION_EVENT_LABELS[detail.eventType]
  const title = detail.conversationName || detail.identifier || eventLabel
  const body = detail.snippet || buildSnippet(detail)

  try {
    const notification = new Notification(`${eventLabel} · ${title}`, {
      body,
      icon: '/favicon.svg',
      tag: `${NOTIFICATION_TAG_PREFIX}${detail.conversationId}`,
    })

    notification.addEventListener('click', (event) => {
      event.preventDefault()
      window.focus()
      const path = detail.eventType === 'queue' ? '/assumir' : `/conversations/${detail.conversationId}`
      void router.push(path).catch(() => {})
      notification.close()
    })
  } catch {
    /* Ignore notification creation errors. */
  }
}

const dispatchSystemNotificationEvent = (detail: NotificationPayload) => {
  if (!detail.conversationId) return

  window.dispatchEvent(
    new CustomEvent(SYSTEM_NOTIFICATION_EVENT, {
      detail: {
        conversationId: detail.conversationId,
        snippet: detail.snippet,
        conversationName: detail.conversationName,
        identifier: detail.identifier,
        eventType: detail.eventType,
      },
    }),
  )
}

const handleIncomingMessage = async (detail: SocketMessageDetail, router: Router) => {
  if (!detail.conversationId) return
  if (detail.direction && detail.direction !== 'incoming') return

  if (isConversationVisible(router, detail.conversationId)) return

  playNotificationTone()
  triggerVibration()

  const meta = await getConversationMeta(detail.conversationId)
  const snippet = buildSnippet(detail)

  const basePayload = {
    ...detail,
    conversationName: meta.name,
    identifier: meta.identifier,
    operatorId: meta.operatorId,
    archived: meta.archived,
    snippet,
  }

  const eventType = determineEventType({
    messageId: detail.messageId,
    operatorId: meta.operatorId,
    archived: meta.archived,
  })

  const enriched: NotificationPayload = {
    ...basePayload,
    eventType,
  }

  showBrowserNotification(enriched, router)
  dispatchSystemNotificationEvent(enriched)
}

const handleSocketEvent = (event: Event, router: Router) => {
  const detail = (event as CustomEvent<SocketMessageDetail>).detail
  if (!detail?.messageId) return

  void handleIncomingMessage(detail, router)
}

export const initMessageNotifications = (router: Router) => {
  if (listenerRegistered) return
  listenerRegistered = true

  const listener = (event: Event) => handleSocketEvent(event, router)

  window.addEventListener('ws:message', listener)
  window.addEventListener('ws:conversation', listener)

  maybeRequestNotificationPermission()
}
