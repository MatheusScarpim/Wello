import { BaseBot } from '@/core/bot/BaseBot'
import {
  IBotStage,
  MessageContext,
  StageResponse,
} from '@/core/bot/interfaces/IBotStage'

import { CoopLuizaRepository } from './repository/CoopLuizaRepository'

/**
 * Bot CoopLuiza - Implementação completa usando nova arquitetura
 */
export class CoopLuizaBot extends BaseBot {
  private repository!: CoopLuizaRepository

  constructor() {
    super({
      id: 'coopluiza',
      name: 'CoopLuiza Atendimento',
      description: 'Bot de atendimento da CoopLuiza',
      initialStage: 0,
      sessionTimeout: 1440,
      enableAnalytics: true,
    })
  }

  /**
   * Registra todos os estágios do bot
   */
  protected registerStages(): void {
    this.addStage(new WelcomeStage())
    this.addStage(new MenuStage())
    this.addStage(new CollectNameStage())
    this.addStage(new CollectDocumentStage())
    this.addStage(new CollectServiceStage())
    this.addStage(new ConfirmationStage())
    this.addStage(new FinalStage())
  }

  /**
   * Sobrescreve inicialização para configurar recursos específicos
   */
  async initialize(): Promise<void> {
    await super.initialize()
    this.repository = new CoopLuizaRepository() // Initialize repository here
    await this.repository.initialize()
    console.log('✅ CoopLuiza Bot inicializado')
  }

  /**
   * Sobrescreve dispose para limpar recursos
   */
  async dispose(): Promise<void> {
    await this.repository.cleanup()
    await super.dispose()
  }
}

/**
 * Estágio 0: Boas-vindas
 */
class WelcomeStage implements IBotStage {
  readonly stageNumber = 0
  readonly description = 'Mensagem de boas-vindas'

  async execute(context: MessageContext): Promise<StageResponse> {
    const message = `👋 Olá ${context.name}!

Bem-vindo(a) ao atendimento da *CoopLuiza*!

Estou aqui para ajudá-lo(a) com nossos serviços.

Digite qualquer coisa para continuar...`

    return {
      message,
      nextStage: 1,
    }
  }
}

/**
 * Estágio 1: Menu principal
 */
class MenuStage implements IBotStage {
  readonly stageNumber = 1
  readonly description = 'Menu de opções'

  async execute(context: MessageContext): Promise<StageResponse> {
    return {
      list: {
        title: '📋 Menu Principal',
        description: 'Por favor, escolha uma opção:',
        buttonText: 'Ver opções',
        sections: [
          {
            title: 'Atendimento',
            rows: [
              {
                rowId: '1',
                title: '1️⃣ Solicitar Atendimento',
                description: 'Abrir nova solicitação',
              },
              {
                rowId: '2',
                title: '2️⃣ Acompanhar Protocolo',
                description: 'Consultar status de protocolo',
              },
            ],
          },
          {
            title: 'Informações',
            rows: [
              {
                rowId: '3',
                title: '3️⃣ Informações sobre Serviços',
                description: 'Conheça nossos serviços',
              },
              {
                rowId: '4',
                title: '4️⃣ Falar com Atendente',
                description: 'Transferir para atendimento humano',
              },
            ],
          },
        ],
      },
      nextStage: 2,
    }
  }

  async validate(input: string): Promise<{ isValid: boolean; error?: string }> {
    const option = input.trim()
    if (!['1', '2', '3', '4'].includes(option)) {
      return {
        isValid: false,
        error: '❌ Opção inválida. Por favor, selecione uma opção da lista.',
      }
    }
    return { isValid: true }
  }
}

/**
 * Estágio 2: Coleta de nome
 */
class CollectNameStage implements IBotStage {
  readonly stageNumber = 2
  readonly description = 'Coleta nome do usuário'

  async execute(context: MessageContext): Promise<StageResponse> {
    const menuOption = context.sessionData?.menuOption || context.message

    // Salva opção do menu
    if (!context.sessionData?.menuOption) {
      return {
        message:
          '📝 Perfeito! Para continuar, por favor informe seu *nome completo*:',
        nextStage: 3,
        updateSessionData: {
          menuOption,
        },
      }
    }

    return {
      message: '📝 Por favor, informe seu *nome completo*:',
      nextStage: 3,
    }
  }

  async validate(input: string): Promise<{ isValid: boolean; error?: string }> {
    const name = input.trim()
    if (name.length < 3) {
      return {
        isValid: false,
        error: '❌ Por favor, informe um nome válido (mínimo 3 caracteres).',
      }
    }
    return { isValid: true }
  }
}

/**
 * Estágio 3: Coleta de documento (CPF/CNPJ)
 */
class CollectDocumentStage implements IBotStage {
  readonly stageNumber = 3
  readonly description = 'Coleta CPF ou CNPJ'

  async execute(context: MessageContext): Promise<StageResponse> {
    const name = context.message.trim()

    const message = `Obrigado, ${name}!

📄 Agora, por favor informe seu *CPF* ou *CNPJ*:

(Digite apenas os números)`

    return {
      message,
      nextStage: 4,
      updateSessionData: {
        userName: name,
      },
    }
  }

  async validate(input: string): Promise<{ isValid: boolean; error?: string }> {
    const doc = input.replace(/\D/g, '')

    if (doc.length !== 11 && doc.length !== 14) {
      return {
        isValid: false,
        error:
          '❌ CPF ou CNPJ inválido. Por favor, digite apenas os números (11 para CPF ou 14 para CNPJ).',
      }
    }

    // Validação básica de CPF
    if (doc.length === 11) {
      if (/^(\d)\1+$/.test(doc)) {
        return {
          isValid: false,
          error: '❌ CPF inválido.',
        }
      }
    }

    return { isValid: true }
  }
}

/**
 * Estágio 4: Coleta de serviço desejado
 */
class CollectServiceStage implements IBotStage {
  readonly stageNumber = 4
  readonly description = 'Coleta tipo de serviço'

  async execute(context: MessageContext): Promise<StageResponse> {
    const document = context.message.replace(/\D/g, '')

    return {
      list: {
        title: '📋 Serviços Disponíveis',
        description:
          '✅ Documento registrado!\n\nSelecione o serviço desejado:',
        buttonText: 'Ver serviços',
        sections: [
          {
            title: 'Produtos Bancários',
            rows: [
              {
                rowId: '1',
                title: '1️⃣ Abertura de Conta',
                description: 'Conta corrente ou poupança',
              },
              {
                rowId: '2',
                title: '2️⃣ Empréstimos',
                description: 'Crédito pessoal e consignado',
              },
              {
                rowId: '3',
                title: '3️⃣ Cartões',
                description: 'Cartão de crédito e débito',
              },
            ],
          },
          {
            title: 'Investimentos e Proteção',
            rows: [
              {
                rowId: '4',
                title: '4️⃣ Investimentos',
                description: 'CDB, Poupança, Fundos',
              },
              {
                rowId: '5',
                title: '5️⃣ Seguros',
                description: 'Seguro de vida, auto, residencial',
              },
              {
                rowId: '6',
                title: '6️⃣ Outros',
                description: 'Outros serviços',
              },
            ],
          },
        ],
      },
      nextStage: 5,
      updateSessionData: {
        document,
      },
    }
  }

  async validate(input: string): Promise<{ isValid: boolean; error?: string }> {
    const option = input.trim()
    if (!['1', '2', '3', '4', '5', '6'].includes(option)) {
      return {
        isValid: false,
        error: '❌ Opção inválida. Por favor, selecione um serviço da lista.',
      }
    }
    return { isValid: true }
  }
}

/**
 * Estágio 5: Confirmação dos dados
 */
class ConfirmationStage implements IBotStage {
  readonly stageNumber = 5
  readonly description = 'Confirmação de dados'

  private getServiceName(serviceId: string): string {
    const services: Record<string, string> = {
      '1': 'Abertura de Conta',
      '2': 'Empréstimos',
      '3': 'Cartões',
      '4': 'Investimentos',
      '5': 'Seguros',
      '6': 'Outros',
    }
    return services[serviceId] || 'Não especificado'
  }

  async execute(context: MessageContext): Promise<StageResponse> {
    const serviceId = context.message.trim()
    const serviceName = this.getServiceName(serviceId)

    const { userName, document } = context.sessionData || {}

    return {
      buttons: {
        title: '📝 Confirmação dos Dados',
        description: `👤 Nome: ${userName}\n📄 Documento: ${this.formatDocument(document)}\n🏢 Serviço: ${serviceName}\n\nOs dados estão corretos?`,
        buttons: [
          {
            id: 'SIM',
            text: '✅ Confirmar',
          },
          {
            id: 'NAO',
            text: '❌ Recomeçar',
          },
        ],
        footer: 'CoopLuiza Atendimento',
      },
      nextStage: 6,
      updateSessionData: {
        serviceId,
        serviceName,
      },
    }
  }

  private formatDocument(doc: string): string {
    if (!doc) return ''
    if (doc.length === 11) {
      return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    }
    return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }

  async validate(input: string): Promise<{ isValid: boolean; error?: string }> {
    const response = input.trim().toUpperCase()
    if (!['SIM', 'NAO', 'NÃO'].includes(response)) {
      return {
        isValid: false,
        error: '❌ Por favor, responda com SIM ou NÃO.',
      }
    }
    return { isValid: true }
  }
}

/**
 * Estágio 6: Finalização
 */
class FinalStage implements IBotStage {
  readonly stageNumber = 6
  readonly description = 'Finalização do atendimento'

  async execute(context: MessageContext): Promise<StageResponse> {
    const response = context.message.trim().toUpperCase()

    if (['NAO', 'NÃO'].includes(response)) {
      return {
        message:
          '🔄 Sem problemas! Vamos recomeçar.\n\nDigite qualquer coisa para voltar ao menu.',
        nextStage: 1,
        updateSessionData: {},
      }
    }

    // Gera protocolo
    const protocol = this.generateProtocol()

    const { userName, serviceName } = context.sessionData || {}

    const message = `✅ *Solicitação Registrada com Sucesso!*

📋 *Protocolo:* ${protocol}
👤 *Nome:* ${userName}
🏢 *Serviço:* ${serviceName}

Em breve nossa equipe entrará em contato com você!

⏱️ *Prazo de resposta:* até 24 horas úteis

Obrigado por escolher a CoopLuiza! 💚`

    // Aqui você salvaria no banco de dados
    this.saveToDatabase(context, protocol)

    return {
      message,
      endSession: true,
      updateSessionData: {
        protocol,
        completed: true,
      },
    }
  }

  private generateProtocol(): string {
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')
    return `CL${timestamp}${random}`
  }

  private async saveToDatabase(
    context: MessageContext,
    protocol: string,
  ): Promise<void> {
    // Implementar salvamento no banco
    console.log('💾 Salvando protocolo:', protocol, context.sessionData)
  }
}
