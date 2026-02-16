import axios from 'axios'

import { IBotStage, MessageContext, StageResponse } from './interfaces/IBotStage'
import {
  VisualNode,
  VisualEdge,
  StartNodeData,
  SendMessageNodeData,
  AskQuestionNodeData,
  ButtonsNodeData,
  ListNodeData,
  ConditionNodeData,
  SetVariableNodeData,
  HttpRequestNodeData,
  DelayNodeData,
  AiResponseNodeData,
  EndNodeData,
} from './interfaces/IVisualBotDefinition'
import { ConditionEvaluator } from './ConditionEvaluator'
import { TemplateEngine } from './TemplateEngine'

/**
 * Estagio dinamico que executa com base na configuracao de um VisualNode
 */
export class DynamicStage implements IBotStage {
  readonly stageNumber: number
  readonly description: string
  readonly node: VisualNode

  constructor(
    stageNumber: number,
    node: VisualNode,
    private outgoingEdges: VisualEdge[],
    private nodeIdToStage: Map<string, number>,
  ) {
    this.stageNumber = stageNumber
    this.node = node
    this.description = node.label || `${node.type} node`
  }

  async execute(context: MessageContext): Promise<StageResponse> {
    const tpl = new TemplateEngine(context.sessionData || {}, context)

    switch (this.node.type) {
      case 'start':
        return this.executeStart(tpl)
      case 'send_message':
        return this.executeSendMessage(tpl)
      case 'ask_question':
        return this.executeAskQuestion(context, tpl)
      case 'buttons':
        return this.executeButtons(context, tpl)
      case 'list':
        return this.executeList(context, tpl)
      case 'condition':
        return this.executeCondition(tpl)
      case 'set_variable':
        return this.executeSetVariable(tpl)
      case 'http_request':
        return this.executeHttpRequest(context, tpl)
      case 'delay':
        return this.executeDelay()
      case 'ai_response':
        return this.executeAiResponse(context, tpl)
      case 'end':
        return this.executeEnd(tpl)
      default:
        return { message: 'Tipo de no desconhecido', endSession: true }
    }
  }

  async validate(
    input: string,
    _context: MessageContext,
  ): Promise<{ isValid: boolean; error?: string }> {
    if (this.node.type !== 'ask_question') {
      return { isValid: true }
    }

    const data = this.node.data as AskQuestionNodeData
    if (!data.validation || data.validation.type === 'none') {
      return { isValid: true }
    }

    return ConditionEvaluator.validateInput(input, data.validation)
  }

  // ============================================
  // Executores por tipo de no
  // ============================================

  private executeStart(tpl: TemplateEngine): StageResponse {
    const data = this.node.data as StartNodeData
    const defaultEdge = this.getDefaultEdge()

    return {
      message: data.welcomeMessage
        ? tpl.render(data.welcomeMessage)
        : undefined,
      nextStage: defaultEdge
        ? this.nodeIdToStage.get(defaultEdge.target)
        : undefined,
      skipMessage: !data.welcomeMessage,
    }
  }

  private executeSendMessage(tpl: TemplateEngine): StageResponse {
    const data = this.node.data as SendMessageNodeData
    const defaultEdge = this.getDefaultEdge()

    const response: StageResponse = {
      nextStage: defaultEdge
        ? this.nodeIdToStage.get(defaultEdge.target)
        : undefined,
    }

    if (data.messageType === 'text') {
      response.message = tpl.render(data.message || '')
    } else if (data.media) {
      response.media = {
        type: data.media.type,
        url: tpl.render(data.media.url || ''),
        caption: data.media.caption
          ? tpl.render(data.media.caption)
          : undefined,
        filename: data.media.filename,
      }
    }

    return response
  }

  private executeAskQuestion(
    context: MessageContext,
    tpl: TemplateEngine,
  ): StageResponse {
    const data = this.node.data as AskQuestionNodeData

    // Se esta aguardando input, processar a resposta
    if (context.sessionData?._awaitingInput === this.node.id) {
      const defaultEdge = this.getDefaultEdge()
      return {
        nextStage: defaultEdge
          ? this.nodeIdToStage.get(defaultEdge.target)
          : undefined,
        updateSessionData: {
          [data.variableName]: context.message,
          _awaitingInput: null,
        },
        skipMessage: true,
      }
    }

    // Enviar pergunta e aguardar
    return {
      message: tpl.render(data.question),
      updateSessionData: { _awaitingInput: this.node.id },
    }
  }

  private executeButtons(
    context: MessageContext,
    tpl: TemplateEngine,
  ): StageResponse {
    const data = this.node.data as ButtonsNodeData

    // Se esta aguardando resposta de botoes
    if (context.sessionData?._awaitingInput === this.node.id) {
      const selectedButton = data.buttons.find(
        (b) =>
          b.id === context.message ||
          b.text.toLowerCase() === context.message.toLowerCase(),
      )

      // Buscar edge pelo ID do botao selecionado
      let targetEdge: VisualEdge | undefined
      if (selectedButton) {
        targetEdge = this.outgoingEdges.find(
          (e) => e.sourceHandle === selectedButton.id,
        )
      }
      if (!targetEdge) {
        targetEdge = this.getDefaultEdge()
      }

      return {
        nextStage: targetEdge
          ? this.nodeIdToStage.get(targetEdge.target)
          : undefined,
        updateSessionData: {
          ...(data.variableName
            ? { [data.variableName]: selectedButton?.id || context.message }
            : {}),
          _awaitingInput: null,
        },
        skipMessage: true,
      }
    }

    // Enviar botoes
    return {
      buttons: {
        title: tpl.render(data.title),
        description: tpl.render(data.description),
        buttons: data.buttons.map((b) => ({
          id: b.id,
          text: tpl.render(b.text),
        })),
        footer: data.footer ? tpl.render(data.footer) : undefined,
      },
      updateSessionData: { _awaitingInput: this.node.id },
    }
  }

  private executeList(
    context: MessageContext,
    tpl: TemplateEngine,
  ): StageResponse {
    const data = this.node.data as ListNodeData

    // Se esta aguardando resposta de lista
    if (context.sessionData?._awaitingInput === this.node.id) {
      let selectedRowId: string | undefined
      for (const section of data.sections) {
        const row = section.rows.find(
          (r) =>
            r.rowId === context.message ||
            r.title.toLowerCase() === context.message.toLowerCase(),
        )
        if (row) {
          selectedRowId = row.rowId
          break
        }
      }

      // Buscar edge pelo rowId selecionado
      let targetEdge: VisualEdge | undefined
      if (selectedRowId) {
        targetEdge = this.outgoingEdges.find(
          (e) => e.sourceHandle === selectedRowId,
        )
      }
      if (!targetEdge) {
        targetEdge = this.getDefaultEdge()
      }

      return {
        nextStage: targetEdge
          ? this.nodeIdToStage.get(targetEdge.target)
          : undefined,
        updateSessionData: {
          ...(data.variableName
            ? { [data.variableName]: selectedRowId || context.message }
            : {}),
          _awaitingInput: null,
        },
        skipMessage: true,
      }
    }

    // Enviar lista
    return {
      list: {
        title: tpl.render(data.title),
        description: tpl.render(data.description),
        buttonText: tpl.render(data.buttonText),
        sections: data.sections.map((s) => ({
          title: tpl.render(s.title),
          rows: s.rows.map((r) => ({
            rowId: r.rowId,
            title: tpl.render(r.title),
            description: r.description
              ? tpl.render(r.description)
              : undefined,
          })),
        })),
      },
      updateSessionData: { _awaitingInput: this.node.id },
    }
  }

  private executeCondition(tpl: TemplateEngine): StageResponse {
    const data = this.node.data as ConditionNodeData

    for (const condition of data.conditions) {
      const variableValue = tpl.resolve(condition.variable)
      if (
        ConditionEvaluator.evaluate(
          variableValue,
          condition.operator,
          condition.value,
        )
      ) {
        const matchingEdge = this.outgoingEdges.find(
          (e) => e.sourceHandle === condition.id,
        )
        return {
          nextStage: matchingEdge
            ? this.nodeIdToStage.get(matchingEdge.target)
            : undefined,
          skipMessage: true,
        }
      }
    }

    // Nenhuma condicao atendida — usar edge "else"
    const elseEdge =
      this.outgoingEdges.find((e) => e.sourceHandle === 'else') ||
      this.getDefaultEdge()

    return {
      nextStage: elseEdge
        ? this.nodeIdToStage.get(elseEdge.target)
        : undefined,
      skipMessage: true,
    }
  }

  private executeSetVariable(tpl: TemplateEngine): StageResponse {
    const data = this.node.data as SetVariableNodeData
    const defaultEdge = this.getDefaultEdge()

    const updates: Record<string, any> = {}
    for (const assignment of data.assignments) {
      updates[assignment.variable] = tpl.render(assignment.value)
    }

    return {
      nextStage: defaultEdge
        ? this.nodeIdToStage.get(defaultEdge.target)
        : undefined,
      updateSessionData: updates,
      skipMessage: true,
    }
  }

  private async executeHttpRequest(
    context: MessageContext,
    tpl: TemplateEngine,
  ): Promise<StageResponse> {
    const data = this.node.data as HttpRequestNodeData
    const defaultEdge = this.getDefaultEdge()

    try {
      const url = tpl.render(data.url)
      const headers: Record<string, string> = {}
      if (data.headers) {
        for (const [key, value] of Object.entries(data.headers)) {
          headers[key] = tpl.render(value)
        }
      }

      let body: any
      if (data.body) {
        try {
          body = JSON.parse(tpl.render(data.body))
        } catch {
          body = tpl.render(data.body)
        }
      }

      const response = await axios({
        method: data.method.toLowerCase() as any,
        url,
        headers,
        data: body,
        timeout: data.timeout || 10000,
      })

      const updates: Record<string, any> = {}
      if (data.responseVariable) {
        updates[data.responseVariable] =
          typeof response.data === 'string'
            ? response.data
            : JSON.stringify(response.data)
      }

      return {
        nextStage: defaultEdge
          ? this.nodeIdToStage.get(defaultEdge.target)
          : undefined,
        updateSessionData: Object.keys(updates).length > 0 ? updates : undefined,
        skipMessage: true,
      }
    } catch (error: any) {
      console.error('Erro na requisicao HTTP do bot:', error.message)

      const updates: Record<string, any> = {}
      if (data.responseVariable) {
        updates[data.responseVariable] = JSON.stringify({
          error: true,
          message: error.message,
        })
      }

      return {
        nextStage: defaultEdge
          ? this.nodeIdToStage.get(defaultEdge.target)
          : undefined,
        updateSessionData: Object.keys(updates).length > 0 ? updates : undefined,
        skipMessage: true,
      }
    }
  }

  private async executeDelay(): Promise<StageResponse> {
    const data = this.node.data as DelayNodeData
    const defaultEdge = this.getDefaultEdge()

    if (data.delayMs > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(data.delayMs, 30000)),
      )
    }

    return {
      nextStage: defaultEdge
        ? this.nodeIdToStage.get(defaultEdge.target)
        : undefined,
      skipMessage: true,
    }
  }

  private async executeAiResponse(
    context: MessageContext,
    tpl: TemplateEngine,
  ): Promise<StageResponse> {
    const data = this.node.data as AiResponseNodeData
    const defaultEdge = this.getDefaultEdge()

    try {
      const openaiApiKey = process.env.OPENAI_API_KEY
      if (!openaiApiKey) {
        console.warn('⚠️ OPENAI_API_KEY nao configurada, usando fallback')
        return {
          message: 'Desculpe, o servico de IA nao esta disponivel no momento.',
          nextStage: defaultEdge
            ? this.nodeIdToStage.get(defaultEdge.target)
            : undefined,
        }
      }

      // Montar system prompt com template engine
      let systemPrompt = tpl.render(data.systemPrompt || '')

      // Se modo roteamento, buscar departamentos e injetar no prompt
      let departments: Array<{ id: string; name: string; description?: string }> = []
      if (data.routeToDepartment) {
        const departmentRepository = (await import('@/api/repositories/DepartmentRepository')).default
        const activeDepts = await departmentRepository.findActive()
        departments = activeDepts.map((d) => ({
          id: d._id!.toString(),
          name: d.name,
          description: d.description,
        }))

        const deptList = departments
          .map((d) => `- ID: "${d.id}" | Nome: "${d.name}"${d.description ? ` | Descricao: ${d.description}` : ''}`)
          .join('\n')

        systemPrompt += `\n\nVoce tambem e um roteador de atendimento. Com base na mensagem do usuario, escolha o departamento mais adequado.

Departamentos disponiveis:
${deptList}

IMPORTANTE: Responda OBRIGATORIAMENTE em JSON valido com este formato:
{"message": "sua resposta ao usuario", "departmentId": "id_do_departamento_escolhido"}

Se nenhum departamento for adequado, use "departmentId": null.
Retorne APENAS o JSON, sem texto adicional.`
      }

      // Montar user prompt com mensagem do usuario + contexto de sessao
      let userPrompt = context.message || ''
      if (data.includeSessionContext && context.sessionData) {
        const sessionVars = Object.entries(context.sessionData)
          .filter(([k]) => !k.startsWith('_'))
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n')
        if (sessionVars) {
          userPrompt = `Contexto:\n${sessionVars}\n\nMensagem: ${userPrompt}`
        }
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: data.temperature ?? 0.7,
          max_tokens: data.maxTokens ?? 300,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      const result = await response.json()
      const rawContent = result.choices?.[0]?.message?.content?.trim() || ''

      // Processar resposta — modo roteamento retorna JSON
      if (data.routeToDepartment) {
        return this.processAiRouting(rawContent, departments, data, defaultEdge)
      }

      // Modo normal — resposta de texto
      const updates: Record<string, any> = {}
      if (data.responseVariable && rawContent) {
        updates[data.responseVariable] = rawContent
      }

      return {
        message: rawContent || undefined,
        nextStage: defaultEdge
          ? this.nodeIdToStage.get(defaultEdge.target)
          : undefined,
        updateSessionData: Object.keys(updates).length > 0 ? updates : undefined,
      }
    } catch (error: any) {
      console.error('Erro no no de IA do bot:', error.message)

      return {
        message: 'Desculpe, ocorreu um erro ao processar com a IA.',
        nextStage: defaultEdge
          ? this.nodeIdToStage.get(defaultEdge.target)
          : undefined,
      }
    }
  }

  private processAiRouting(
    rawContent: string,
    departments: Array<{ id: string; name: string; description?: string }>,
    data: AiResponseNodeData,
    defaultEdge: VisualEdge | undefined,
  ): StageResponse {
    try {
      // Tentar extrair JSON da resposta (pode vir com markdown ```json)
      let jsonStr = rawContent
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        jsonStr = jsonMatch[0]
      }

      const parsed = JSON.parse(jsonStr)
      const aiMessage = parsed.message || ''
      const departmentId = parsed.departmentId || null

      // Validar se o departamento existe
      const validDept = departmentId
        ? departments.find((d) => d.id === departmentId)
        : null

      const updates: Record<string, any> = {}
      if (data.responseVariable) {
        updates[data.responseVariable] = aiMessage
      }

      if (validDept) {
        // Transferir para o departamento escolhido pela IA
        return {
          message: aiMessage || undefined,
          endSession: true,
          transferToHuman: true,
          transferDepartmentId: validDept.id,
          updateSessionData: Object.keys(updates).length > 0 ? updates : undefined,
        }
      }

      // IA nao escolheu departamento — segue o fluxo normal
      return {
        message: aiMessage || undefined,
        nextStage: defaultEdge
          ? this.nodeIdToStage.get(defaultEdge.target)
          : undefined,
        updateSessionData: Object.keys(updates).length > 0 ? updates : undefined,
      }
    } catch {
      // Falha ao parsear JSON — usar resposta como texto e seguir fluxo
      console.warn('⚠️ IA nao retornou JSON valido para roteamento, usando como texto')
      return {
        message: rawContent || undefined,
        nextStage: defaultEdge
          ? this.nodeIdToStage.get(defaultEdge.target)
          : undefined,
      }
    }
  }

  private executeEnd(tpl: TemplateEngine): StageResponse {
    const data = this.node.data as EndNodeData

    return {
      message: data.finalMessage ? tpl.render(data.finalMessage) : undefined,
      endSession: true,
      skipMessage: !data.finalMessage,
      transferToHuman: data.transferToHuman || false,
      transferDepartmentId: data.transferDepartmentId || undefined,
    }
  }

  // ============================================
  // Helpers
  // ============================================

  private getDefaultEdge(): VisualEdge | undefined {
    return (
      this.outgoingEdges.find(
        (e) => !e.sourceHandle || e.sourceHandle === 'default',
      ) || this.outgoingEdges[0]
    )
  }
}
