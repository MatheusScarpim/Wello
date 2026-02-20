import { Server as HttpServer } from 'http'
import jwt from 'jsonwebtoken'
import { Server as IOServer, Socket } from 'socket.io'

type JwtPayload = {
  userId?: string
  email?: string
  role?: string
}

class SocketServer {
  private io: IOServer | null = null

  init(server: HttpServer) {
    if (this.io) return

    this.io = new IOServer(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      },
    })

    const secret = process.env.JWT_SECRET || 'default-secret-change-me'

    this.io.use((socket, next) => {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers.authorization || '').replace('Bearer ', '')

      if (!token) {
        return next(new Error('unauthorized'))
      }

      try {
        const decoded = jwt.verify(token, secret) as JwtPayload
        socket.data.user = decoded
        return next()
      } catch {
        return next(new Error('unauthorized'))
      }
    })

    this.io.on('connection', (socket: Socket) => {
      const user = socket.data.user as JwtPayload | undefined

      socket.join('all')

      if (user?.role === 'admin' || user?.role === 'supervisor') {
        socket.join('admins')
      }

      if (user?.userId) {
        socket.join(`operator:${user.userId}`)
      }

      socket.on('join:conversation', (conversationId?: string) => {
        if (conversationId) {
          socket.join(`conversation:${conversationId}`)
        }
      })

      socket.on('leave:conversation', (conversationId?: string) => {
        if (conversationId) {
          socket.leave(`conversation:${conversationId}`)
        }
      })
    })
  }

  emitMessage(
    payload: any,
    conversationId: string,
    operatorId?: string | null,
  ) {
    if (!this.io) return

    // Coleta todos os socket IDs únicos para evitar duplicação
    const socketIds = new Set<string>()

    // Sockets na room da conversa
    const conversationRoom = this.io.sockets.adapter.rooms.get(
      `conversation:${conversationId}`,
    )
    if (conversationRoom) {
      conversationRoom.forEach((id) => socketIds.add(id))
    }

    // Sockets na room de admins
    const adminsRoom = this.io.sockets.adapter.rooms.get('admins')
    if (adminsRoom) {
      adminsRoom.forEach((id) => socketIds.add(id))
    }

    // Socket do operador específico
    if (operatorId) {
      const operatorRoom = this.io.sockets.adapter.rooms.get(
        `operator:${operatorId}`,
      )
      if (operatorRoom) {
        operatorRoom.forEach((id) => socketIds.add(id))
      }
    }

    // Emite para cada socket apenas uma vez
    socketIds.forEach((socketId) => {
      this.io?.to(socketId).emit('message.created', payload)
    })
  }

  emitPipelineUpdate(payload: any) {
    if (!this.io) return
    this.io.to('admins').emit('pipeline.updated', payload)
  }

  emitWhatsAppInstanceUpdate(payload: any) {
    if (!this.io) return
    this.io.to('admins').emit('whatsapp.instances.updated', payload)
  }

  /**
   * Emite indicador de digitação para uma conversa
   */
  emitTypingIndicator(payload: any, conversationId: string) {
    if (!this.io) return
    this.io.to(`conversation:${conversationId}`).emit('typing.indicator', payload)
  }

  /**
   * Emite reação a uma mensagem
   */
  emitReaction(payload: any, conversationId: string) {
    if (!this.io) return

    const socketIds = new Set<string>()
    const conversationRoom = this.io.sockets.adapter.rooms.get(`conversation:${conversationId}`)
    if (conversationRoom) conversationRoom.forEach((id) => socketIds.add(id))
    const adminsRoom = this.io.sockets.adapter.rooms.get('admins')
    if (adminsRoom) adminsRoom.forEach((id) => socketIds.add(id))

    socketIds.forEach((socketId) => {
      this.io?.to(socketId).emit('message.reaction', payload)
    })
  }

  /**
   * Emite atualização de mensagem (edição, exclusão)
   */
  emitMessageUpdate(payload: any, conversationId: string) {
    if (!this.io) return

    const socketIds = new Set<string>()
    const conversationRoom = this.io.sockets.adapter.rooms.get(`conversation:${conversationId}`)
    if (conversationRoom) conversationRoom.forEach((id) => socketIds.add(id))
    const adminsRoom = this.io.sockets.adapter.rooms.get('admins')
    if (adminsRoom) adminsRoom.forEach((id) => socketIds.add(id))

    socketIds.forEach((socketId) => {
      this.io?.to(socketId).emit('message.updated', payload)
    })
  }

  /**
   * Emite atualização de enquete
   */
  emitPollUpdate(payload: any, conversationId: string) {
    if (!this.io) return
    this.io.to(`conversation:${conversationId}`).emit('poll.response', payload)
  }

  /**
   * Emite ACK de mensagem (entrega/leitura)
   */
  emitMessageAck(payload: any, conversationId: string) {
    if (!this.io) return
    this.io.to(`conversation:${conversationId}`).emit('message.ack', payload)
  }

  /**
   * Emite notificação de chamada recebida
   */
  emitIncomingCall(payload: any) {
    if (!this.io) return
    this.io.to('admins').emit('call.incoming', payload)
  }

  /**
   * Emite mudança de presença (online/offline/digitando)
   */
  emitPresenceChange(payload: any) {
    if (!this.io) return
    this.io.to('all').emit('presence.changed', payload)
  }

  emitConversationUpdate(
    payload: any,
    conversationId: string,
    operatorId?: string | null,
  ) {
    if (!this.io) return

    // Coleta todos os socket IDs únicos para evitar duplicação
    const socketIds = new Set<string>()

    // Sockets na room da conversa
    const conversationRoom = this.io.sockets.adapter.rooms.get(
      `conversation:${conversationId}`,
    )
    if (conversationRoom) {
      conversationRoom.forEach((id) => socketIds.add(id))
    }

    // Sockets na room de admins
    const adminsRoom = this.io.sockets.adapter.rooms.get('admins')
    if (adminsRoom) {
      adminsRoom.forEach((id) => socketIds.add(id))
    }

    // Socket do operador específico
    if (operatorId) {
      const operatorRoom = this.io.sockets.adapter.rooms.get(
        `operator:${operatorId}`,
      )
      if (operatorRoom) {
        operatorRoom.forEach((id) => socketIds.add(id))
      }
    }

    // Emite para cada socket apenas uma vez
    socketIds.forEach((socketId) => {
      this.io?.to(socketId).emit('conversation.updated', payload)
    })
  }
}

export default new SocketServer()
