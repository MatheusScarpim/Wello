import type { tokenStore } from '@wppconnect-team/wppconnect'

import whatsappSessionRepository from '@/api/repositories/WhatsAppSessionRepository'

class SessionTokenStore implements tokenStore.TokenStore {
  async getToken(
    sessionName: string,
  ): Promise<tokenStore.SessionToken | undefined> {
    console.log(`🧯 SessionTokenStore.getToken -> ${sessionName}`)
    const session =
      await whatsappSessionRepository.findBySessionName(sessionName)
    if (session?.tokens) {
      console.log(
        `🧯 SessionTokenStore.getToken -> ${sessionName} TOKEN ENCONTRADO`,
      )
      return session.tokens
    }
    console.log(`🧯 SessionTokenStore.getToken -> ${sessionName} SEM TOKEN`)
    return undefined
  }

  async setToken(
    sessionName: string,
    tokenData: tokenStore.SessionToken | null,
  ): Promise<boolean> {
    console.log(
      `🧯 SessionTokenStore.setToken -> ${sessionName} (hasToken=${tokenData !== null})`,
    )
    try {
      if (!tokenData) {
        const result = await whatsappSessionRepository.removeToken(sessionName)
        console.log(
          `🧯 SessionTokenStore.setToken -> ${sessionName} removido: ${result}`,
        )
        return result
      }

      const result = await whatsappSessionRepository.upsertToken(
        sessionName,
        tokenData,
      )
      console.log(
        `🧯 SessionTokenStore.setToken -> ${sessionName} salvo: ${result ? 'SUCESSO' : 'FALHA'}`,
      )
      return result
    } catch (error) {
      console.error(
        `🧯 SessionTokenStore.setToken -> ${sessionName} ERRO:`,
        error,
      )
      return false
    }
  }

  async removeToken(sessionName: string): Promise<boolean> {
    console.log(`🧯 SessionTokenStore.removeToken -> ${sessionName}`)
    return whatsappSessionRepository.removeToken(sessionName)
  }

  async listTokens(): Promise<string[]> {
    console.log('🧯 SessionTokenStore.listTokens')
    return whatsappSessionRepository.listSessionNames()
  }
}

export default new SessionTokenStore()
