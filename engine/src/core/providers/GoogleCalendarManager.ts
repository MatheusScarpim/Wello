import { google, calendar_v3 } from 'googleapis'
import EventEmitter from 'events'

import googleCalendarSettingsRepository from '@/api/repositories/GoogleCalendarSettingsRepository'

export interface GoogleCalendarEvent {
  id?: string
  summary: string
  description?: string
  start: Date
  end: Date
  extendedProperties?: {
    private?: Record<string, string>
  }
}

/**
 * Gerenciador do Google Calendar API
 * Singleton + EventEmitter (mesmo padrão do MetaManager)
 */
export class GoogleCalendarManager extends EventEmitter {
  private static instance: GoogleCalendarManager
  private clientId: string
  private clientSecret: string
  private redirectUri: string
  private calendarId: string
  private oauth2Client: InstanceType<typeof google.auth.OAuth2> | null = null
  private isEnabled: boolean

  private constructor() {
    super()

    this.clientId = process.env.GOOGLE_CLIENT_ID || ''
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || ''
    this.redirectUri = process.env.GOOGLE_REDIRECT_URI || ''
    this.calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary'

    this.isEnabled = !!this.clientId && !!this.clientSecret

    if (this.isEnabled) {
      this.oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
        this.redirectUri,
      )
      console.log('Google Calendar API configurado')
    } else {
      console.log('Google Calendar API: Sem credenciais configuradas')
    }
  }

  public static getInstance(): GoogleCalendarManager {
    if (!GoogleCalendarManager.instance) {
      GoogleCalendarManager.instance = new GoogleCalendarManager()
    }
    return GoogleCalendarManager.instance
  }

  public getIsEnabled(): boolean {
    return this.isEnabled
  }

  // --- OAuth Flow ---

  public getAuthUrl(): string {
    if (!this.oauth2Client) throw new Error('Google Calendar nao configurado')
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/calendar'],
    })
  }

  public async handleOAuthCallback(code: string): Promise<void> {
    if (!this.oauth2Client) throw new Error('Google Calendar nao configurado')

    const { tokens } = await this.oauth2Client.getToken(code)
    this.oauth2Client.setCredentials(tokens)

    await googleCalendarSettingsRepository.saveSettings({
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      tokenExpiry: new Date(tokens.expiry_date!),
      calendarId: this.calendarId,
      isConnected: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    this.emit('connected')
  }

  // --- Token Management ---

  private async ensureAuthenticated(): Promise<calendar_v3.Calendar> {
    if (!this.oauth2Client) throw new Error('Google Calendar nao configurado')

    const settings = await googleCalendarSettingsRepository.getSettings()
    if (!settings || !settings.isConnected) {
      throw new Error('Google Calendar nao conectado')
    }

    this.oauth2Client.setCredentials({
      access_token: settings.accessToken,
      refresh_token: settings.refreshToken,
      expiry_date: settings.tokenExpiry.getTime(),
    })

    this.oauth2Client.on('tokens', async (tokens: any) => {
      await googleCalendarSettingsRepository.updateTokens(
        tokens.access_token,
        tokens.refresh_token || settings.refreshToken,
        new Date(tokens.expiry_date),
      )
    })

    return google.calendar({ version: 'v3', auth: this.oauth2Client })
  }

  // --- CRUD Operations ---

  public async createEvent(event: GoogleCalendarEvent): Promise<string> {
    const calendar = await this.ensureAuthenticated()
    const settings = await googleCalendarSettingsRepository.getSettings()

    const response = await calendar.events.insert({
      calendarId: settings?.calendarId || 'primary',
      requestBody: this.toGoogleEvent(event),
    })

    return response.data.id!
  }

  public async updateEvent(eventId: string, event: GoogleCalendarEvent): Promise<void> {
    const calendar = await this.ensureAuthenticated()
    const settings = await googleCalendarSettingsRepository.getSettings()

    await calendar.events.update({
      calendarId: settings?.calendarId || 'primary',
      eventId,
      requestBody: this.toGoogleEvent(event),
    })
  }

  public async deleteEvent(eventId: string): Promise<void> {
    const calendar = await this.ensureAuthenticated()
    const settings = await googleCalendarSettingsRepository.getSettings()

    await calendar.events.delete({
      calendarId: settings?.calendarId || 'primary',
      eventId,
    })
  }

  public async listEvents(timeMin: Date, timeMax: Date): Promise<calendar_v3.Schema$Event[]> {
    const calendar = await this.ensureAuthenticated()
    const settings = await googleCalendarSettingsRepository.getSettings()

    const response = await calendar.events.list({
      calendarId: settings?.calendarId || 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    })

    return response.data.items || []
  }

  // --- Incremental Sync ---

  public async incrementalSync(): Promise<calendar_v3.Schema$Event[]> {
    const calendar = await this.ensureAuthenticated()
    const settings = await googleCalendarSettingsRepository.getSettings()

    try {
      const params: any = {
        calendarId: settings?.calendarId || 'primary',
        singleEvents: true,
      }

      if (settings?.syncToken) {
        params.syncToken = settings.syncToken
      } else {
        params.timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      }

      const response = await calendar.events.list(params)

      if (response.data.nextSyncToken) {
        await googleCalendarSettingsRepository.updateSyncInfo(
          new Date(),
          response.data.nextSyncToken,
        )
      }

      return response.data.items || []
    } catch (error: any) {
      if (error.code === 410) {
        await googleCalendarSettingsRepository.updateSyncInfo(new Date(), undefined)
        return this.incrementalSync()
      }
      throw error
    }
  }

  // --- Push Notifications ---

  public async setupWatch(webhookUrl: string): Promise<void> {
    const calendar = await this.ensureAuthenticated()
    const settings = await googleCalendarSettingsRepository.getSettings()
    const channelId = `scarlatchat-${Date.now()}`

    const response = await calendar.events.watch({
      calendarId: settings?.calendarId || 'primary',
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    await googleCalendarSettingsRepository.updateWatchInfo(
      channelId,
      response.data.resourceId!,
      new Date(Number(response.data.expiration!)),
    )
  }

  public async stopWatch(): Promise<void> {
    if (!this.oauth2Client) return

    const calendar = await this.ensureAuthenticated()
    const settings = await googleCalendarSettingsRepository.getSettings()

    if (settings?.watchChannelId && settings?.watchResourceId) {
      await calendar.channels.stop({
        requestBody: {
          id: settings.watchChannelId,
          resourceId: settings.watchResourceId,
        },
      })
    }
  }

  // --- Connection Status ---

  public async getConnectionStatus(): Promise<{
    connected: boolean
    calendarId?: string
    lastSyncAt?: Date
    watchExpiration?: Date
  }> {
    const settings = await googleCalendarSettingsRepository.getSettings()
    if (!settings || !settings.isConnected) {
      return { connected: false }
    }

    return {
      connected: true,
      calendarId: settings.calendarId,
      lastSyncAt: settings.lastSyncAt,
      watchExpiration: settings.watchExpiration,
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.stopWatch()
    } catch { /* ignore */ }

    await googleCalendarSettingsRepository.saveSettings({
      isConnected: false,
      accessToken: '',
      refreshToken: '',
      syncToken: undefined,
      watchChannelId: undefined,
      watchResourceId: undefined,
      watchExpiration: undefined,
      updatedAt: new Date(),
    } as any)

    this.emit('disconnected')
  }

  // --- Mapping ---

  private toGoogleEvent(event: GoogleCalendarEvent): calendar_v3.Schema$Event {
    return {
      summary: event.summary,
      description: event.description || '',
      start: {
        dateTime: event.start.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: event.end.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      extendedProperties: event.extendedProperties,
    }
  }
}

export default GoogleCalendarManager.getInstance()
