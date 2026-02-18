import appointmentRepository from '@/api/repositories/AppointmentRepository'
import conversationRepository from '@/api/repositories/ConversationRepository'
import MessagingService from '../messaging/MessagingService'

class AppointmentReminderService {
  private interval: NodeJS.Timeout | null = null
  private lastRunDate: string | null = null

  start() {
    if (this.interval) return
    console.log('🔔 AppointmentReminderService iniciado')
    this.interval = setInterval(() => this.tick(), 60 * 1000) // a cada 60s
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  private async tick() {
    try {
      const now = new Date()
      const today = now.toISOString().split('T')[0]

      // Só envia lembretes a partir das 8h e uma vez por dia
      if (now.getHours() < 8 || this.lastRunDate === today) return

      this.lastRunDate = today
      await this.sendReminders()
    } catch (error) {
      console.error('❌ Erro no tick do AppointmentReminderService:', error)
    }
  }

  private async sendReminders() {
    const appointments = await appointmentRepository.findTodayPendingReminders()

    if (appointments.length === 0) {
      console.log('🔔 Nenhum lembrete para enviar hoje')
      return
    }

    console.log(`🔔 Enviando ${appointments.length} lembrete(s) de agendamento...`)

    for (const appointment of appointments) {
      try {
        if (!appointment.contactIdentifier) {
          console.warn(`⚠️ Agendamento ${appointment._id} sem contactIdentifier, pulando`)
          continue
        }

        // Busca a conversa pelo identifier para obter provider e sessionName
        const phoneNumber = appointment.contactIdentifier.replace(/@.*$/, '')
        const conversation = await conversationRepository.findOne({
          identifier: { $regex: phoneNumber, $options: 'i' },
        } as any)

        if (!conversation) {
          console.warn(`⚠️ Conversa não encontrada para ${phoneNumber}, pulando lembrete`)
          continue
        }

        // Monta a mensagem de lembrete
        const date = new Date(appointment.date)
        const hours = date.getHours().toString().padStart(2, '0')
        const minutes = date.getMinutes().toString().padStart(2, '0')
        const horario = `${hours}:${minutes}`

        const lines: string[] = [
          `Olá ${appointment.contactName || 'cliente'}!`,
          '',
          'Você tem um agendamento hoje:',
          `📋 ${appointment.title}`,
          `🕐 ${horario}`,
        ]

        if (appointment.serviceName) {
          lines.push(`💼 ${appointment.serviceName}`)
        }
        if (appointment.professionalName) {
          lines.push(`👤 ${appointment.professionalName}`)
        }

        lines.push('')
        lines.push('Responda:')
        lines.push('1 - Confirmar')
        lines.push('2 - Cancelar')

        const message = lines.join('\n')

        await MessagingService.sendMessage({
          to: conversation.identifier,
          provider: conversation.provider as any,
          message,
          type: 'text',
          sessionName: conversation.sessionName,
        })

        // Marca reminderSent como true
        await appointmentRepository.updateOne(
          { _id: appointment._id } as any,
          { $set: { reminderSent: true } },
        )

        console.log(`✅ Lembrete enviado para ${phoneNumber} (${appointment.title})`)
      } catch (error) {
        console.error(`❌ Erro ao enviar lembrete para agendamento ${appointment._id}:`, error)
      }
    }
  }

  /**
   * Verifica se a mensagem recebida é uma resposta de confirmação de agendamento.
   * Retorna a mensagem de resposta ou null se não for confirmação.
   */
  async handleConfirmationReply(
    identifier: string,
    messageText: string,
  ): Promise<string | null> {
    const text = (messageText || '').trim()

    // Só intercepta respostas curtas "1", "2", "confirmar", "cancelar"
    const isConfirm = text === '1' || text.toLowerCase() === 'confirmar'
    const isCancel = text === '2' || text.toLowerCase() === 'cancelar'

    if (!isConfirm && !isCancel) return null

    // Busca agendamentos de hoje aguardando confirmação
    const pendingAppointments = await appointmentRepository.findTodayAwaitingConfirmation(identifier)

    if (pendingAppointments.length === 0) return null

    // Atualiza todos os agendamentos pendentes deste contato
    for (const appointment of pendingAppointments) {
      const newStatus = isConfirm ? 'confirmed' : 'cancelled'
      await appointmentRepository.updateOne(
        { _id: appointment._id } as any,
        { $set: { status: newStatus, updatedAt: new Date() } },
      )
    }

    if (isConfirm) {
      return 'Agendamento confirmado! ✅ Até mais tarde.'
    } else {
      return 'Agendamento cancelado. Se precisar reagendar, entre em contato.'
    }
  }
}

export default new AppointmentReminderService()
