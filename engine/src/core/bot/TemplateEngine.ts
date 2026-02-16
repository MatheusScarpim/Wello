import { MessageContext } from './interfaces/IBotStage'

/**
 * Motor de template para interpolacao de {{variaveis}} em mensagens
 */
export class TemplateEngine {
  constructor(
    private sessionData: Record<string, any>,
    private context: MessageContext,
  ) {}

  /**
   * Substitui {{key}} por valores de sessao/contexto
   */
  render(template: string): string {
    if (!template) return ''

    return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
      const resolved = this.resolve(key)
      return resolved ?? `{{${key}}}`
    })
  }

  /**
   * Resolve uma variavel pelo nome
   */
  resolve(key: string): string | undefined {
    // Variaveis built-in do contexto
    switch (key) {
      case 'lastMessage':
        return this.context.message
      case 'userName':
        return this.context.name
      case 'userPhone':
        return this.context.identifier
      case 'provider':
        return this.context.provider
      case 'conversationId':
        return this.context.conversationId
    }

    // Variaveis de sessao
    const value = this.sessionData[key]
    if (value !== undefined && value !== null) {
      return String(value)
    }

    return undefined
  }
}
