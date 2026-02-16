import { BaseBot } from './BaseBot'
import { BotConfig } from './interfaces/IBot'
import { DynamicStage } from './DynamicStage'
import type { VisualBotDefinition } from './interfaces/IVisualBotDefinition'

/**
 * Bot dinamico que executa a partir de uma definicao visual (JSON)
 * Ponte entre IDs de no (string) e stage numbers (int) do BaseBot
 */
export class DynamicBot extends BaseBot {
  private definition: VisualBotDefinition
  private nodeIdToStage: Map<string, number> = new Map()
  private stageToNodeId: Map<number, string> = new Map()

  constructor(definition: VisualBotDefinition) {
    const config: BotConfig = {
      id: definition.botId,
      name: definition.name,
      description: definition.description,
      initialStage: 0,
      sessionTimeout: definition.sessionTimeout || 1440,
      enableAnalytics: definition.enableAnalytics ?? true,
    }
    super(config)
    this.definition = definition
  }

  protected registerStages(): void {
    // 1. Mapear node IDs para stage numbers sequenciais
    let stageNumber = 0
    for (const node of this.definition.nodes) {
      this.nodeIdToStage.set(node.id, stageNumber)
      this.stageToNodeId.set(stageNumber, node.id)
      stageNumber++
    }

    // 2. Definir o initialStage a partir do no Start
    const startNode = this.definition.nodes.find((n) => n.type === 'start')
    if (startNode) {
      const initialStage = this.nodeIdToStage.get(startNode.id) ?? 0
      ;(this.config as any).initialStage = initialStage
    }

    // 3. Criar DynamicStage para cada no
    for (const node of this.definition.nodes) {
      const nodeStageNumber = this.nodeIdToStage.get(node.id)!
      const outgoingEdges = this.definition.edges.filter(
        (e) => e.source === node.id,
      )

      const stage = new DynamicStage(
        nodeStageNumber,
        node,
        outgoingEdges,
        this.nodeIdToStage,
      )
      this.addStage(stage)
    }
  }

  /**
   * Cria uma factory class compativel com BotFactory.registerBot()
   * BotFactory espera `new () => IBot`, entao retornamos uma classe
   * com constructor sem argumentos que captura a definition no closure
   */
  static createFactory(
    definition: VisualBotDefinition,
  ): new () => DynamicBot {
    const captured = definition
    return class extends DynamicBot {
      constructor() {
        super(captured)
      }
    } as any
  }
}
