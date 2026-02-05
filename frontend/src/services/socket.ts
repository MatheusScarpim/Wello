import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

const getBaseUrl = () => {
  return import.meta.env.VITE_API_URL || ''
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
