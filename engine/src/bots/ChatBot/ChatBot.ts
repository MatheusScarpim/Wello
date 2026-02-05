import { BaseBot } from '@/core/bot/BaseBot'
import {
  IBotStage,
  MessageContext,
  StageResponse,
} from '@/core/bot/interfaces/IBotStage'

class ChatStage implements IBotStage {
  stageNumber = 0

  async execute(context: MessageContext): Promise<StageResponse> {
    return {
      message:
        'Olá! No momento, nossos atendentes não estão disponíveis. Por favor, tente novamente mais tarde.',
      endSession: true,
    }
  }
}

export class ChatBot extends BaseBot {
  constructor() {
    super({
      id: 'chat',
      name: 'Chat',
      description: 'Bot para conversas gerais',
    })
  }

  protected registerStages(): void {
    this.addStage(new ChatStage())
  }
}
