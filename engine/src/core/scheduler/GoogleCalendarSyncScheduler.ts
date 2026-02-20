import googleCalendarSyncService from '@/api/services/GoogleCalendarSyncService'
import GoogleCalendarManager from '@/core/providers/GoogleCalendarManager'

class GoogleCalendarSyncScheduler {
  private interval: ReturnType<typeof setInterval> | null = null

  start() {
    if (this.interval) return

    if (!GoogleCalendarManager.getIsEnabled()) {
      console.log('Google Calendar Sync Scheduler: desabilitado (sem credenciais)')
      return
    }

    console.log('Google Calendar Sync Scheduler iniciado (polling a cada 5 min)')
    this.interval = setInterval(() => this.tick(), 5 * 60 * 1000)
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  private async tick() {
    try {
      const status = await GoogleCalendarManager.getConnectionStatus()
      if (!status.connected) return

      await googleCalendarSyncService.syncFromGoogle()
    } catch (error) {
      console.error('Erro no sync scheduler do Google Calendar:', error)
    }
  }
}

export default new GoogleCalendarSyncScheduler()
