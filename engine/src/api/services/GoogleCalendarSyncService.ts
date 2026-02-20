import { calendar_v3 } from 'googleapis'

import GoogleCalendarManager from '@/core/providers/GoogleCalendarManager'
import appointmentRepository from '@/api/repositories/AppointmentRepository'
import type { AppointmentDocument } from '@/api/repositories/AppointmentRepository'

export class GoogleCalendarSyncService {
  private isSyncing = false

  /**
   * Sincroniza um agendamento local para o Google Calendar.
   * Chamado apos create/update/delete no AppointmentService.
   */
  async syncToGoogle(appointmentId: string, action: 'create' | 'update' | 'delete'): Promise<void> {
    try {
      const status = await GoogleCalendarManager.getConnectionStatus()
      if (!status.connected) return

      const appointment = await appointmentRepository.findById(appointmentId)
      if (!appointment) return

      // Previne loop: ignora se foi sincronizado do Google ha menos de 5s
      if (appointment.syncSource === 'google' && appointment.lastSyncedAt) {
        const timeSinceSync = Date.now() - new Date(appointment.lastSyncedAt).getTime()
        if (timeSinceSync < 5000) return
      }

      const event = this.appointmentToGoogleEvent(appointment)

      if (action === 'create' || (action === 'update' && !appointment.googleCalendarEventId)) {
        const eventId = await GoogleCalendarManager.createEvent(event)
        await appointmentRepository.updateOne(
          { _id: appointment._id } as any,
          { $set: { googleCalendarEventId: eventId, syncSource: 'local', lastSyncedAt: new Date() } },
        )
      } else if (action === 'update' && appointment.googleCalendarEventId) {
        await GoogleCalendarManager.updateEvent(appointment.googleCalendarEventId, event)
        await appointmentRepository.updateOne(
          { _id: appointment._id } as any,
          { $set: { syncSource: 'local', lastSyncedAt: new Date() } },
        )
      } else if (action === 'delete' && appointment.googleCalendarEventId) {
        await GoogleCalendarManager.deleteEvent(appointment.googleCalendarEventId)
      }
    } catch (error) {
      console.error(`Erro ao sincronizar agendamento ${appointmentId} para Google:`, error)
    }
  }

  /**
   * Sincroniza eventos do Google Calendar para agendamentos locais.
   * Chamado via webhook, polling ou sync manual.
   */
  async syncFromGoogle(): Promise<{ created: number; updated: number; deleted: number }> {
    if (this.isSyncing) return { created: 0, updated: 0, deleted: 0 }
    this.isSyncing = true

    const stats = { created: 0, updated: 0, deleted: 0 }

    try {
      const events = await GoogleCalendarManager.incrementalSync()

      for (const event of events) {
        if (!event.id) continue

        // Evento cancelado/deletado
        if (event.status === 'cancelled') {
          const existing = await appointmentRepository.findByGoogleEventId(event.id)
          if (existing) {
            await appointmentRepository.updateOne(
              { _id: existing._id } as any,
              { $set: { status: 'cancelled', syncSource: 'google', lastSyncedAt: new Date(), updatedAt: new Date() } },
            )
            stats.deleted++
          }
          continue
        }

        const existing = await appointmentRepository.findByGoogleEventId(event.id)

        if (existing) {
          // Previne loop: ignora se foi sincronizado localmente ha menos de 10s
          if (existing.syncSource === 'local' && existing.lastSyncedAt) {
            const timeSinceSync = Date.now() - new Date(existing.lastSyncedAt).getTime()
            if (timeSinceSync < 10000) continue
          }

          const updates = this.googleEventToAppointmentUpdate(event)
          await appointmentRepository.updateOne(
            { _id: existing._id } as any,
            { $set: { ...updates, syncSource: 'google', lastSyncedAt: new Date(), updatedAt: new Date() } },
          )
          stats.updated++
        } else {
          // Ignora eventos criados pelo ScarlatChat (para evitar duplicatas)
          const scarlatId = event.extendedProperties?.private?.scarlatChatId
          if (scarlatId) continue

          const newAppointment = this.googleEventToNewAppointment(event)
          await appointmentRepository.create(newAppointment as any)
          stats.created++
        }
      }
    } catch (error) {
      console.error('Erro ao sincronizar do Google Calendar:', error)
    } finally {
      this.isSyncing = false
    }

    return stats
  }

  // --- Mapping: Appointment -> Google Event ---

  private appointmentToGoogleEvent(appointment: AppointmentDocument) {
    const start = new Date(appointment.date)
    const end = new Date(start.getTime() + appointment.duration * 60000)

    const descParts: string[] = []
    if (appointment.contactName) descParts.push(`Cliente: ${appointment.contactName}`)
    if (appointment.contactIdentifier) descParts.push(`Telefone: ${appointment.contactIdentifier}`)
    if (appointment.professionalName) descParts.push(`Profissional: ${appointment.professionalName}`)
    if (appointment.serviceName) descParts.push(`Servico: ${appointment.serviceName}`)
    if (appointment.description) descParts.push(`\n${appointment.description}`)
    descParts.push(`\nStatus: ${appointment.status}`)

    return {
      summary: appointment.title,
      description: descParts.join('\n'),
      start,
      end,
      extendedProperties: {
        private: {
          scarlatChatId: appointment._id.toString(),
          scarlatChatStatus: appointment.status,
        },
      },
    }
  }

  // --- Mapping: Google Event -> Appointment ---

  private googleEventToAppointmentUpdate(event: calendar_v3.Schema$Event): Partial<AppointmentDocument> {
    const update: any = {}

    if (event.summary) update.title = event.summary

    if (event.start?.dateTime) {
      update.date = new Date(event.start.dateTime)
    }

    if (event.start?.dateTime && event.end?.dateTime) {
      const start = new Date(event.start.dateTime)
      const end = new Date(event.end.dateTime)
      update.duration = Math.round((end.getTime() - start.getTime()) / 60000)
    }

    return update
  }

  private googleEventToNewAppointment(event: calendar_v3.Schema$Event): Partial<AppointmentDocument> {
    const start = event.start?.dateTime ? new Date(event.start.dateTime) : new Date()
    const end = event.end?.dateTime ? new Date(event.end.dateTime) : new Date(start.getTime() + 30 * 60000)
    const duration = Math.round((end.getTime() - start.getTime()) / 60000)
    const now = new Date()

    return {
      title: event.summary || 'Evento do Google Calendar',
      description: event.description || undefined,
      date: start,
      duration: duration || 30,
      status: 'scheduled',
      reminderSent: false,
      googleCalendarEventId: event.id!,
      syncSource: 'google',
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    }
  }
}

export default new GoogleCalendarSyncService()
