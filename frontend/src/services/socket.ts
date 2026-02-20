import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

const getBaseUrl = () => {
  return window.__ENV__?.VITE_API_URL || import.meta.env.VITE_API_URL || ''
}

export const connectSocket = (token: string | null) => {
  if (!token) return

  // Se já existe um socket, verifica se está conectado
  if (socket) {
    if (socket.connected) return
    // Se existe mas não está conectado, desconecta e limpa antes de criar novo
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }

  socket = io(getBaseUrl(), {
    auth: { token },
    transports: ['websocket'],
  })

  socket.on('connect_error', () => {
    // ignore
  })

  socket.on('message.created', (payload) => {
    window.dispatchEvent(new CustomEvent('ws:message', { detail: payload }))
  })

  socket.on('conversation.updated', (payload) => {
    window.dispatchEvent(new CustomEvent('ws:conversation', { detail: payload }))
  })

  socket.on('pipeline.updated', (payload) => {
    window.dispatchEvent(new CustomEvent('ws:pipeline', { detail: payload }))
  })

  socket.on('whatsapp.instances.updated', (payload) => {
    window.dispatchEvent(new CustomEvent('ws:whatsapp-instances', { detail: payload }))
  })

  // WhatsApp Features events
  socket.on('message.reaction', (payload) => {
    window.dispatchEvent(new CustomEvent('ws:message-reaction', { detail: payload }))
  })

  socket.on('message.edited', (payload) => {
    window.dispatchEvent(new CustomEvent('ws:message-edited', { detail: payload }))
  })

  socket.on('message.deleted', (payload) => {
    window.dispatchEvent(new CustomEvent('ws:message-deleted', { detail: payload }))
  })

  socket.on('message.ack', (payload) => {
    window.dispatchEvent(new CustomEvent('ws:message-ack', { detail: payload }))
  })

  socket.on('typing.indicator', (payload) => {
    window.dispatchEvent(new CustomEvent('ws:typing-indicator', { detail: payload }))
  })

  socket.on('poll.response', (payload) => {
    window.dispatchEvent(new CustomEvent('ws:poll-response', { detail: payload }))
  })

  socket.on('call.incoming', (payload) => {
    window.dispatchEvent(new CustomEvent('ws:call-incoming', { detail: payload }))
  })

  socket.on('presence.changed', (payload) => {
    window.dispatchEvent(new CustomEvent('ws:presence-changed', { detail: payload }))
  })
}

export const updateSocketToken = (token: string | null) => {
  if (!token) {
    if (socket) {
      socket.disconnect()
      socket = null
    }
    return
  }

  if (!socket) {
    connectSocket(token)
    return
  }

  socket.auth = { token }
  if (!socket.connected) {
    socket.connect()
  }
}

export const getSocket = () => socket
