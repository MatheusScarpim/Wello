import { ObjectId } from 'mongodb'

import appointmentRepository from '../repositories/AppointmentRepository'
import availabilityRepository from '../repositories/AvailabilityRepository'

export interface AppointmentPayload {
  contactId?: string
  contactName?: string
  contactIdentifier?: string
  operatorId?: string
  operatorName?: string
  professionalId?: string
  professionalName?: string
  serviceId?: string
  serviceName?: string
  title: string
  description?: string
  date: string
  duration?: number
}

export class AppointmentService {
  async list(filters: {
    date?: string
    operatorId?: string
    contactIdentifier?: string
    status?: string
    page?: number
    limit?: number
  }) {
    const query: any = {}

    if (filters.date) {
      const start = new Date(filters.date + 'T00:00:00.000Z')
      const end = new Date(filters.date + 'T23:59:59.999Z')
      query.date = { $gte: start, $lte: end }
    }
    if (filters.operatorId) query.operatorId = filters.operatorId
    if (filters.contactIdentifier) {
      // Extrai a parte numérica (antes do @) para match flexível
      // Ex: "5511999999999@s.whatsapp.net" → busca por "5511999999999"
      const phoneNumber = filters.contactIdentifier.replace(/@.*$/, '')
      query.contactIdentifier = { $regex: phoneNumber, $options: 'i' }
    }
    if ((filters as any).professionalId) query.professionalId = (filters as any).professionalId
    if (filters.status) query.status = filters.status

    if (filters.page && filters.limit) {
      return await appointmentRepository.paginate(
        query,
        filters.page,
        filters.limit,
        { sort: { date: 1 } } as any,
      )
    }

    return await appointmentRepository.find(query, { sort: { date: 1 } } as any)
  }

  async getCalendar(start: string, end: string) {
    const startDate = new Date(start)
    const endDate = new Date(end)
    return await appointmentRepository.findByDateRange(startDate, endDate)
  }

  async getAvailableSlots(dateStr: string) {
    const settings = await availabilityRepository.getSettings()

    // Verificar se a data esta bloqueada
    if (settings.blockedDates.includes(dateStr)) {
      return []
    }

    // Mapear dia da semana
    const date = new Date(dateStr + 'T12:00:00.000Z')
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
    const dayName = dayNames[date.getUTCDay()]
    const dayConfig = settings.schedule[dayName]

    if (!dayConfig || !dayConfig.enabled) {
      return []
    }

    // Gerar slots baseado no horario do dia
    const slots: { start: string; end: string; available: boolean }[] = []
    const [startH, startM] = dayConfig.start.split(':').map(Number)
    const [endH, endM] = dayConfig.end.split(':').map(Number)
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM
    const slotDuration = settings.slotDuration || 30

    // Buscar agendamentos do dia para verificar conflitos
    const existingAppointments = await appointmentRepository.findByDate(dateStr)

    for (let m = startMinutes; m + slotDuration <= endMinutes; m += slotDuration) {
      const slotStartH = Math.floor(m / 60).toString().padStart(2, '0')
      const slotStartM = (m % 60).toString().padStart(2, '0')
      const slotEndMin = m + slotDuration
      const slotEndH = Math.floor(slotEndMin / 60).toString().padStart(2, '0')
      const slotEndM = (slotEndMin % 60).toString().padStart(2, '0')

      const slotStart = `${slotStartH}:${slotStartM}`
      const slotEnd = `${slotEndH}:${slotEndM}`

      // Verificar se algum agendamento conflita com este slot
      const slotDateTime = new Date(`${dateStr}T${slotStart}:00.000Z`)
      const slotEndDateTime = new Date(`${dateStr}T${slotEnd}:00.000Z`)

      const hasConflict = existingAppointments.some((appt) => {
        const apptStart = new Date(appt.date)
        const apptEnd = new Date(apptStart.getTime() + appt.duration * 60000)
        return apptStart < slotEndDateTime && apptEnd > slotDateTime
      })

      slots.push({
        start: slotStart,
        end: slotEnd,
        available: !hasConflict,
      })
    }

    return slots
  }

  async create(payload: AppointmentPayload) {
    const title = payload.title?.trim()
    if (!title) {
      throw new Error('Titulo do agendamento e obrigatorio')
    }
    if (!payload.date) {
      throw new Error('Data do agendamento e obrigatoria')
    }

    const now = new Date()
    return await appointmentRepository.create({
      contactId: payload.contactId || undefined,
      contactName: payload.contactName || undefined,
      contactIdentifier: payload.contactIdentifier || undefined,
      operatorId: payload.operatorId || undefined,
      operatorName: payload.operatorName || undefined,
      professionalId: payload.professionalId || undefined,
      professionalName: payload.professionalName || undefined,
      serviceId: payload.serviceId || undefined,
      serviceName: payload.serviceName || undefined,
      title,
      description: payload.description || undefined,
      date: new Date(payload.date),
      duration: payload.duration || 30,
      status: 'scheduled',
      reminderSent: false,
      createdAt: now,
      updatedAt: now,
    } as any)
  }

  async update(id: string, payload: Partial<AppointmentPayload>) {
    if (!id) throw new Error('Agendamento invalido')

    const updateData: any = { updatedAt: new Date() }
    if (payload.title !== undefined) updateData.title = payload.title.trim()
    if (payload.description !== undefined) updateData.description = payload.description
    if (payload.date !== undefined) updateData.date = new Date(payload.date)
    if (payload.duration !== undefined) updateData.duration = payload.duration
    if (payload.contactId !== undefined) updateData.contactId = payload.contactId
    if (payload.contactName !== undefined) updateData.contactName = payload.contactName
    if (payload.contactIdentifier !== undefined) updateData.contactIdentifier = payload.contactIdentifier
    if (payload.operatorId !== undefined) updateData.operatorId = payload.operatorId
    if (payload.operatorName !== undefined) updateData.operatorName = payload.operatorName
    if (payload.professionalId !== undefined) updateData.professionalId = payload.professionalId
    if (payload.professionalName !== undefined) updateData.professionalName = payload.professionalName
    if (payload.serviceId !== undefined) updateData.serviceId = payload.serviceId
    if (payload.serviceName !== undefined) updateData.serviceName = payload.serviceName

    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
    return await appointmentRepository.updateOne(
      { _id: objectId } as any,
      { $set: updateData },
    )
  }

  async updateStatus(id: string, status: string) {
    if (!id) throw new Error('Agendamento invalido')

    const validStatuses = ['scheduled', 'confirmed', 'cancelled', 'completed']
    if (!validStatuses.includes(status)) {
      throw new Error('Status invalido')
    }

    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
    return await appointmentRepository.updateOne(
      { _id: objectId } as any,
      { $set: { status, updatedAt: new Date() } },
    )
  }

  async delete(id: string) {
    if (!id) return false
    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id
    return await appointmentRepository.deleteOne({ _id: objectId } as any)
  }
}

export default new AppointmentService()
