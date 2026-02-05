import conversationRepository from '@/api/repositories/ConversationRepository'
import departmentRepository from '@/api/repositories/DepartmentRepository'
import operatorRepository, {
  IOperator,
} from '@/api/repositories/OperatorRepository'
import whatsappInstanceRepository from '@/api/repositories/WhatsAppInstanceRepository'
import SocketServer from '@/api/socket/SocketServer'

class FairDistributionService {
  private interval: NodeJS.Timeout | null = null
  private isProcessing = false
  private departmentPointer = new Map<string, number>()
  private readonly intervalMs =
    Number(process.env.FAIR_DISTRIBUTION_INTERVAL_MS) || 10000
  private readonly offerDurationMs =
    Number(process.env.FAIR_DISTRIBUTION_OFFER_MS) || 3 * 60 * 1000
  private readonly offerCooldownMs =
    Number(process.env.FAIR_DISTRIBUTION_COOLDOWN_MS) || 5 * 60 * 1000

  start() {
    if (this.interval) return
    this.interval = setInterval(() => this.ensureOffers(), this.intervalMs)
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  async offerConversationNow(conversation: any) {
    if (this.isProcessing || !conversation) {
      return
    }
    const now = new Date()
    const activeChatsCache = new Map<string, number>()
    try {
      await this.tryOfferConversation(conversation, now, activeChatsCache)
    } catch (error) {
      console.error('❌ Erro ao ofertar conversa imediatamente:', error)
    }
  }

  private async ensureOffers() {
    if (this.isProcessing) {
      return
    }

    this.isProcessing = true
    try {
      const now = new Date()
      const activeChatsCache = new Map<string, number>()
      const conversations = await conversationRepository.find(
        {
          archived: false,
          status: { $ne: 'finalized' },
          operatorId: { $exists: false },
          $or: [
            { offerOperatorId: { $exists: false } },
            { offerExpiresAt: { $lte: now } },
          ],
        },
        { sort: { createdAt: 1 }, limit: 25 },
      )

      for (const conversation of conversations) {
        if (
          conversation.offerOperatorId &&
          conversation.offerExpiresAt &&
          new Date(conversation.offerExpiresAt) <= now
        ) {
          await this.handleExpiredOffer(conversation)
        }
        await this.tryOfferConversation(conversation, now, activeChatsCache)
      }
    } catch (error) {
      console.error('❌ Erro na distribuição justa da fila:', error)
    } finally {
      this.isProcessing = false
    }
  }

  private async tryOfferConversation(
    conversation: any,
    now: Date,
    activeChatsCache: Map<string, number>,
  ) {
    const sessionName: string | undefined = conversation.sessionName
    if (!sessionName) return

    const instance = await whatsappInstanceRepository.findBySessionName(
      sessionName,
    )
    if (!instance || !instance.fairDistributionEnabled) {
      return
    }

    const departmentId =
      conversation.departmentId ||
      (instance.departmentIds?.length ? instance.departmentIds[0] : undefined)

    if (!departmentId) return

    if (!conversation.departmentId) {
      await conversationRepository.updateOne(
        { _id: conversation._id } as any,
        {
          $set: {
            departmentId,
            updatedAt: new Date(),
          },
        },
      )
      conversation.departmentId = departmentId
    }

    const department = await departmentRepository.findById(departmentId)
    if (!department || !department.isActive) {
      return
    }

    const operators = await operatorRepository.findByDepartment(departmentId)
    if (!operators.length) return

    const availableOperators = operators.filter((op) =>
      ['online', 'busy'].includes(op.status),
    )
    if (!availableOperators.length) return

    const selectedOperator = await this.selectOperator(
      departmentId,
      availableOperators,
      activeChatsCache,
      conversation,
      now,
    )
    if (!selectedOperator) return

    const offerExpires = new Date(Date.now() + this.offerDurationMs)
    const operatorId = selectedOperator._id?.toString()
    const offerPayload: any = {
      offerOperatorId: operatorId,
      offerOperatorName: selectedOperator.name,
      offerExpiresAt: offerExpires,
      offerAttempt: (conversation.offerAttempt ?? 0) + 1,
      updatedAt: new Date(),
    }

    await conversationRepository.updateOne(
      { _id: conversation._id } as any,
      {
        $set: offerPayload,
      },
    )

    SocketServer.emitConversationUpdate(
      {
        conversationId: conversation._id?.toString(),
        ...offerPayload,
      },
      conversation._id?.toString(),
      operatorId,
    )
  }

  private async handleExpiredOffer(conversation: any) {
    const operatorId = conversation.offerOperatorId?.toString?.()
    if (operatorId) {
      const operator = await operatorRepository.findById(operatorId)
      if (operator && ['online', 'busy'].includes(operator.status)) {
        await operatorRepository.updateStatus(operatorId, 'offline')
      }
    }

    await conversationRepository.updateOne(
      { _id: conversation._id } as any,
      {
        $unset: {
          offerOperatorId: '',
          offerOperatorName: '',
          offerExpiresAt: '',
        },
        $set: { updatedAt: new Date() },
      },
    )
  }

  private async selectOperator(
    departmentId: string,
    operators: IOperator[],
    activeChatsCache: Map<string, number>,
    conversation: any,
    now: Date,
  ): Promise<IOperator | null> {
    if (!operators.length) return null

    const lastOperatorId =
      conversation?.lastOperatorId?.toString?.() || conversation?.lastOperatorId
    const hasCooldown =
      lastOperatorId &&
      conversation?.lastResolvedAt &&
      now.getTime() - new Date(conversation.lastResolvedAt).getTime() <
        this.offerCooldownMs

    const hasAlternativeOperator = operators.some((op) => {
      const opId = op._id?.toString()
      if (!opId || opId === lastOperatorId) return false
      return ['online', 'busy'].includes(op.status)
    })

    const pointer = this.departmentPointer.get(departmentId) ?? 0
    for (let i = 0; i < operators.length; i += 1) {
      const index = (pointer + i) % operators.length
      const operator = operators[index]
      const operatorId = operator._id?.toString()
      if (!operatorId) continue
      if (
        hasCooldown &&
        hasAlternativeOperator &&
        operatorId === lastOperatorId
      ) {
        continue
      }

      const activeChats = await this.getOperatorActiveChats(
        operatorId,
        activeChatsCache,
      )
      const maxChats = operator.settings?.maxConcurrentChats ?? 5
      if (activeChats >= maxChats) continue

      this.departmentPointer.set(departmentId, (index + 1) % operators.length)
      return operator
    }

    return null
  }

  private async getOperatorActiveChats(
    operatorId: string,
    cache: Map<string, number>,
  ): Promise<number> {
    if (cache.has(operatorId)) {
      return cache.get(operatorId) as number
    }
    const count = await conversationRepository.count({
      operatorId,
      archived: false,
      status: { $ne: 'finalized' },
    } as any)

    cache.set(operatorId, count)
    return count
  }
}

export default new FairDistributionService()
