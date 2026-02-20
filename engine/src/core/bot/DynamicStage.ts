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
  AppointmentSchedulingNodeData,
  EndNodeData,
} from './interfaces/IVisualBotDefinition'
import { ConditionEvaluator } from './ConditionEvaluator'
import { TemplateEngine } from './TemplateEngine'

/**
 * Estágio dinâmico que executa com base na configuração de um VisualNode
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
      case 'appointment_scheduling':
        return this.executeAppointmentScheduling(context, tpl)
      case 'end':
        return this.executeEnd(tpl)
      default:
        return { message: 'Tipo de nó desconhecido', endSession: true }
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
  // Executores por tipo de nó
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

    // Se está aguardando input, processar a resposta
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

    // Se está aguardando resposta de botões
    if (context.sessionData?._awaitingInput === this.node.id) {
      const selectedButton = this.matchByIdOrIndex(
        context.message,
        data.buttons,
        (b) => b.id,
        (b) => b.text,
      )

      // Buscar edge pelo ID do botão selecionado
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

    // Enviar botões
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

    // Se está aguardando resposta de lista
    if (context.sessionData?._awaitingInput === this.node.id) {
      // Flatten all rows across sections for index-based matching
      const allRows = data.sections.flatMap((s) => s.rows)
      const selectedRow = this.matchByIdOrIndex(
        context.message,
        allRows,
        (r) => r.rowId,
        (r) => r.title,
      )
      const selectedRowId = selectedRow?.rowId

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
            ? { [data.variableName]: selectedRow?.title || context.message }
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

    // Nenhuma condição atendida — usar edge "else"
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
      console.error('Erro na requisição HTTP do bot:', error.message)

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
        console.warn('⚠️ OPENAI_API_KEY não configurada, usando fallback')
        return {
          message: 'Desculpe, o serviço de IA não está disponível no momento.',
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
          .map((d) => `- ID: "${d.id}" | Nome: "${d.name}"${d.description ? ` | Descrição: ${d.description}` : ''}`)
          .join('\n')

        systemPrompt += `\n\nVocê também é um roteador de atendimento. Com base na mensagem do usuário, escolha o departamento mais adequado.

Departamentos disponíveis:
${deptList}

IMPORTANTE: Responda OBRIGATORIAMENTE em JSON válido com este formato:
{"message": "sua resposta ao usuário", "departmentId": "id_do_departamento_escolhido"}

Se nenhum departamento for adequado, use "departmentId": null.
Retorne APENAS o JSON, sem texto adicional.`
      }

      // Montar user prompt com mensagem do usuário + contexto de sessão
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
      console.error('Erro no nó de IA do bot:', error.message)

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

      // IA não escolheu departamento — segue o fluxo normal
      return {
        message: aiMessage || undefined,
        nextStage: defaultEdge
          ? this.nodeIdToStage.get(defaultEdge.target)
          : undefined,
        updateSessionData: Object.keys(updates).length > 0 ? updates : undefined,
      }
    } catch {
      // Falha ao parsear JSON — usar resposta como texto e seguir fluxo
      console.warn('⚠️ IA não retornou JSON válido para roteamento, usando como texto')
      return {
        message: rawContent || undefined,
        nextStage: defaultEdge
          ? this.nodeIdToStage.get(defaultEdge.target)
          : undefined,
      }
    }
  }

  private async executeAppointmentScheduling(
    context: MessageContext,
    tpl: TemplateEngine,
  ): Promise<StageResponse> {
    const data = this.node.data as AppointmentSchedulingNodeData
    const defaultEdge = this.getDefaultEdge()
    const awaiting = context.sessionData?._awaitingInput as string | undefined
    const nodeId = this.node.id

    try {
      const appointmentRepo = (await import('@/api/repositories/AppointmentRepository')).default
      const serviceRepo = (await import('@/api/repositories/ServiceRepository')).default
      const professionalRepo = (await import('@/api/repositories/ProfessionalRepository')).default
      const availabilityRepo = (await import('@/api/repositories/AvailabilityRepository')).default

      // Step 1: Choose service (if not preset)
      if (!data.serviceId && awaiting !== `${nodeId}_service` && awaiting !== `${nodeId}_professional` && awaiting !== `${nodeId}_date` && awaiting !== `${nodeId}_time` && awaiting !== `${nodeId}_name` && awaiting !== `${nodeId}_phone`) {
        const services = await serviceRepo.findAll()
        if (services.length === 0) {
          return {
            message: data.noSlotsMessage || 'Desculpe, não há serviços disponíveis no momento.',
            nextStage: defaultEdge ? this.nodeIdToStage.get(defaultEdge.target) : undefined,
          }
        }

        if (services.length <= 3) {
          return {
            buttons: {
              title: data.askServiceMessage || 'Qual serviço deseja agendar?',
              description: 'Selecione uma opção',
              buttons: services.map((s) => ({ id: s._id!.toString(), text: s.name })),
            },
            updateSessionData: { _awaitingInput: `${nodeId}_service` },
          }
        }

        return {
          list: {
            title: data.askServiceMessage || 'Qual serviço deseja agendar?',
            description: 'Selecione o serviço desejado',
            buttonText: 'Ver serviços',
            sections: [{
              title: 'Serviços',
              rows: services.map((s) => ({
                rowId: s._id!.toString(),
                title: s.name,
                description: s.description || `${s.defaultDuration} min`,
              })),
            }],
          },
          updateSessionData: { _awaitingInput: `${nodeId}_service` },
        }
      }

      // Process service selection
      if (awaiting === `${nodeId}_service`) {
        const services = await serviceRepo.findAll()
        const selected = this.matchByIdOrIndex(
          context.message,
          services,
          (s) => s._id!.toString(),
          (s) => s.name,
        )
        const serviceId = selected ? selected._id!.toString() : context.message
        const serviceName = selected?.name || context.message
        const serviceDuration = selected?.defaultDuration || 30

        // Go to professional selection
        const professionals = data.professionalId
          ? []
          : await professionalRepo.findActive()

        if (!data.professionalId && professionals.length > 0) {
          // Filter by service if professionals have serviceIds
          const filtered = professionals.filter(
            (p) => p.serviceIds.length === 0 || p.serviceIds.includes(serviceId),
          )
          const profList = filtered.length > 0 ? filtered : professionals

          if (profList.length <= 3) {
            return {
              buttons: {
                title: data.askProfessionalMessage || 'Com qual profissional?',
                description: serviceName,
                buttons: profList.map((p) => ({ id: p._id!.toString(), text: p.name })),
              },
              updateSessionData: {
                _awaitingInput: `${nodeId}_professional`,
                _apt_serviceId: serviceId,
                _apt_serviceName: serviceName,
                _apt_duration: serviceDuration,
              },
            }
          }

          return {
            list: {
              title: data.askProfessionalMessage || 'Com qual profissional?',
              description: serviceName,
              buttonText: 'Ver profissionais',
              sections: [{
                title: 'Profissionais',
                rows: profList.map((p) => ({
                  rowId: p._id!.toString(),
                  title: p.name,
                })),
              }],
            },
            updateSessionData: {
              _awaitingInput: `${nodeId}_professional`,
              _apt_serviceId: serviceId,
              _apt_serviceName: serviceName,
              _apt_duration: serviceDuration,
            },
          }
        }

        // Skip professional, go to date
        return this.showDateSelection(data, {
          _apt_serviceId: serviceId,
          _apt_serviceName: serviceName,
          _apt_duration: serviceDuration,
          _apt_professionalId: data.professionalId || '',
          _apt_professionalName: '',
        })
      }

      // Step 2: Professional selected → show dates
      if (awaiting === `${nodeId}_professional`) {
        const professionals = await professionalRepo.findActive()
        const selected = this.matchByIdOrIndex(
          context.message,
          professionals,
          (p) => p._id!.toString(),
          (p) => p.name,
        )

        return this.showDateSelection(data, {
          _apt_professionalId: selected ? selected._id!.toString() : context.message,
          _apt_professionalName: selected?.name || context.message,
        })
      }

      // Step 1b: If service is preset, start with professional or date
      if (data.serviceId && !awaiting) {
        const service = await serviceRepo.findById(data.serviceId)

        if (!data.professionalId) {
          const professionals = await professionalRepo.findActive()
          const filtered = professionals.filter(
            (p) => p.serviceIds.length === 0 || p.serviceIds.includes(data.serviceId!),
          )
          const profList = filtered.length > 0 ? filtered : professionals

          if (profList.length > 0) {
            if (profList.length <= 3) {
              return {
                buttons: {
                  title: data.askProfessionalMessage || 'Com qual profissional?',
                  description: service?.name || '',
                  buttons: profList.map((p) => ({ id: p._id!.toString(), text: p.name })),
                },
                updateSessionData: {
                  _awaitingInput: `${nodeId}_professional`,
                  _apt_serviceId: data.serviceId,
                  _apt_serviceName: service?.name || '',
                  _apt_duration: service?.defaultDuration || 30,
                },
              }
            }

            return {
              list: {
                title: data.askProfessionalMessage || 'Com qual profissional?',
                description: service?.name || '',
                buttonText: 'Ver profissionais',
                sections: [{
                  title: 'Profissionais',
                  rows: profList.map((p) => ({
                    rowId: p._id!.toString(),
                    title: p.name,
                  })),
                }],
              },
              updateSessionData: {
                _awaitingInput: `${nodeId}_professional`,
                _apt_serviceId: data.serviceId,
                _apt_serviceName: service?.name || '',
                _apt_duration: service?.defaultDuration || 30,
              },
            }
          }
        }

        // Both service and professional preset → show dates
        return this.showDateSelection(data, {
          _apt_serviceId: data.serviceId,
          _apt_serviceName: service?.name || '',
          _apt_duration: service?.defaultDuration || 30,
          _apt_professionalId: data.professionalId || '',
          _apt_professionalName: '',
        })
      }

      // Step 3: Date selected → show time slots
      if (awaiting === `${nodeId}_date`) {
        // Rebuild available dates to support numeric index matching
        const daysAhead = data.daysAhead || 7
        const settingsForDates = await availabilityRepo.getSettings()
        const dayNamesForDates = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
        const availDates: string[] = []
        const todayDate = new Date()
        for (let i = 0; i < daysAhead && availDates.length < 10; i++) {
          const d = new Date(todayDate)
          d.setDate(d.getDate() + i)
          const dn = dayNamesForDates[d.getDay()]
          if (settingsForDates.schedule[dn]?.enabled) {
            const ds = d.toISOString().split('T')[0]
            if (!settingsForDates.blockedDates?.includes(ds)) {
              availDates.push(ds)
            }
          }
        }

        // Match by exact date string or numeric index
        const matchedDate = this.matchByIdOrIndex(
          context.message,
          availDates,
          (d) => d,
          (d) => d,
        )
        const dateStr = matchedDate || context.message
        const settings = settingsForDates

        // Get day of week
        const dateObj = new Date(dateStr + 'T12:00:00')
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
        const dayName = dayNames[dateObj.getDay()]
        const daySchedule = settings.schedule[dayName]

        if (!daySchedule || !daySchedule.enabled) {
          return {
            message: 'Este dia não está disponível. Por favor, selecione outro dia.',
            updateSessionData: { _awaitingInput: `${nodeId}_date` },
          }
        }

        // Generate time slots
        const duration = (context.sessionData?._apt_duration as number) || settings.slotDuration || 30
        const [startH, startM] = daySchedule.start.split(':').map(Number)
        const [endH, endM] = daySchedule.end.split(':').map(Number)
        const startMinutes = startH * 60 + startM
        const endMinutes = endH * 60 + endM

        // Get existing appointments for this date
        const startDate = new Date(dateStr + 'T00:00:00')
        const endDate = new Date(dateStr + 'T23:59:59')
        const existingApts = await appointmentRepo.findByDateRange(startDate, endDate)

        const slots: Array<{ time: string; available: boolean }> = []
        for (let m = startMinutes; m + duration <= endMinutes; m += duration) {
          const h = Math.floor(m / 60)
          const min = m % 60
          const timeStr = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`

          // Check conflicts
          const slotStart = new Date(`${dateStr}T${timeStr}:00`)
          const slotEnd = new Date(slotStart.getTime() + duration * 60000)
          const hasConflict = existingApts.some((apt) => {
            const aptStart = new Date(apt.date)
            const aptEnd = new Date(aptStart.getTime() + (apt.duration || 30) * 60000)
            return aptStart < slotEnd && aptEnd > slotStart
          })

          if (!hasConflict) {
            slots.push({ time: timeStr, available: true })
          }
        }

        if (slots.length === 0) {
          return {
            message: data.noSlotsMessage || 'Não há horários disponíveis para esta data. Tente outra data.',
            updateSessionData: { _awaitingInput: `${nodeId}_date` },
          }
        }

        // Show time slots (max 10 in list)
        const displaySlots = slots.slice(0, 10)
        return {
          list: {
            title: data.askTimeMessage || 'Selecione o horário',
            description: `Horários disponíveis para ${dateStr}`,
            buttonText: 'Ver horários',
            sections: [{
              title: 'Horários',
              rows: displaySlots.map((s) => ({
                rowId: s.time,
                title: s.time,
                description: `${duration} minutos`,
              })),
            }],
          },
          updateSessionData: {
            _awaitingInput: `${nodeId}_time`,
            _apt_date: dateStr,
          },
        }
      }

      // Step 4: Time selected → collect name
      if (awaiting === `${nodeId}_time`) {
        // Rebuild slots to support numeric index matching
        const sessionForTime = context.sessionData || {}
        const dateForSlots = sessionForTime._apt_date as string
        const settingsForSlots = await availabilityRepo.getSettings()
        const dayNamesForSlots = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
        const dateObjForSlots = new Date(dateForSlots + 'T12:00:00')
        const dayScheduleForSlots = settingsForSlots.schedule[dayNamesForSlots[dateObjForSlots.getDay()]]
        let availSlots: string[] = []
        if (dayScheduleForSlots?.enabled) {
          const dur = (sessionForTime._apt_duration as number) || settingsForSlots.slotDuration || 30
          const [sH, sM] = dayScheduleForSlots.start.split(':').map(Number)
          const [eH, eM] = dayScheduleForSlots.end.split(':').map(Number)
          const sMin = sH * 60 + sM
          const eMin = eH * 60 + eM
          const sDate = new Date(dateForSlots + 'T00:00:00')
          const eDateRange = new Date(dateForSlots + 'T23:59:59')
          const existingForSlots = await appointmentRepo.findByDateRange(sDate, eDateRange)
          for (let m = sMin; m + dur <= eMin; m += dur) {
            const hh = String(Math.floor(m / 60)).padStart(2, '0')
            const mm = String(m % 60).padStart(2, '0')
            const ts = `${hh}:${mm}`
            const slotS = new Date(`${dateForSlots}T${ts}:00`)
            const slotE = new Date(slotS.getTime() + dur * 60000)
            const conflict = existingForSlots.some((a) => {
              const aS = new Date(a.date)
              const aE = new Date(aS.getTime() + (a.duration || 30) * 60000)
              return aS < slotE && aE > slotS
            })
            if (!conflict) availSlots.push(ts)
          }
        }

        const matchedTime = this.matchByIdOrIndex(
          context.message,
          availSlots,
          (t) => t,
          (t) => t,
        )
        const time = matchedTime || context.message

        return {
          message: data.askNameMessage || 'Qual seu nome?',
          updateSessionData: {
            _awaitingInput: `${nodeId}_name`,
            _apt_time: time,
          },
        }
      }

      // Step 5: Name collected → collect phone
      if (awaiting === `${nodeId}_name`) {
        return {
          message: data.askPhoneMessage || 'Qual seu telefone para contato?',
          updateSessionData: {
            _awaitingInput: `${nodeId}_phone`,
            _apt_contactName: context.message,
          },
        }
      }

      // Step 6: Phone collected → create appointment
      if (awaiting === `${nodeId}_phone`) {
        const sessionData = context.sessionData || {}
        const dateStr = sessionData._apt_date as string
        const timeStr = sessionData._apt_time as string
        const duration = (sessionData._apt_duration as number) || 30
        const dateTime = `${dateStr}T${timeStr}:00`

        const appointmentData = {
          title: (sessionData._apt_serviceName as string) || 'Agendamento via Bot',
          date: new Date(dateTime),
          duration,
          status: 'scheduled' as const,
          reminderSent: false,
          contactName: sessionData._apt_contactName as string || '',
          contactIdentifier: context.message || context.identifier || '',
          serviceId: sessionData._apt_serviceId as string || undefined,
          serviceName: sessionData._apt_serviceName as string || undefined,
          professionalId: sessionData._apt_professionalId as string || undefined,
          professionalName: sessionData._apt_professionalName as string || undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        const result = await appointmentRepo.create(appointmentData as any)
        const appointmentId = result.insertedId?.toString() || ''

        // Build confirmation message
        const confirmMsg = tpl.render(
          data.confirmMessage ||
          `Agendamento confirmado!\n\nServiço: ${sessionData._apt_serviceName || 'N/A'}\nData: ${dateStr}\nHorário: ${timeStr}\nDuração: ${duration} min\nNome: ${sessionData._apt_contactName || 'N/A'}`
        )

        // Clean up session vars
        const cleanupUpdates: Record<string, any> = {
          _awaitingInput: null,
          _apt_serviceId: null,
          _apt_serviceName: null,
          _apt_duration: null,
          _apt_professionalId: null,
          _apt_professionalName: null,
          _apt_date: null,
          _apt_time: null,
          _apt_contactName: null,
        }
        if (data.responseVariable) {
          cleanupUpdates[data.responseVariable] = appointmentId
        }

        return {
          message: confirmMsg,
          nextStage: defaultEdge ? this.nodeIdToStage.get(defaultEdge.target) : undefined,
          updateSessionData: cleanupUpdates,
        }
      }
    } catch (error: any) {
      console.error('Erro no nó de agendamento do bot:', error.message)
      return {
        message: 'Desculpe, ocorreu um erro ao processar o agendamento.',
        nextStage: defaultEdge ? this.nodeIdToStage.get(defaultEdge.target) : undefined,
      }
    }

    // Fallback
    return {
      message: 'Desculpe, ocorreu um erro no fluxo de agendamento.',
      nextStage: defaultEdge ? this.nodeIdToStage.get(defaultEdge.target) : undefined,
    }
  }

  private async showDateSelection(
    data: AppointmentSchedulingNodeData,
    sessionUpdates: Record<string, any>,
  ): Promise<StageResponse> {
    const nodeId = this.node.id
    const daysAhead = data.daysAhead || 7
    const availabilityRepo = (await import('@/api/repositories/AvailabilityRepository')).default
    const settings = await availabilityRepo.getSettings()

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
    const dayLabels: Record<string, string> = {
      sunday: 'Domingo', monday: 'Segunda', tuesday: 'Terça',
      wednesday: 'Quarta', thursday: 'Quinta', friday: 'Sexta', saturday: 'Sábado',
    }

    const availableDates: Array<{ date: string; label: string }> = []
    const today = new Date()

    for (let i = 0; i < daysAhead && availableDates.length < 10; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      const dayName = dayNames[d.getDay()]

      if (settings.schedule[dayName]?.enabled) {
        const dateStr = d.toISOString().split('T')[0]
        if (!settings.blockedDates?.includes(dateStr)) {
          const dayNum = String(d.getDate()).padStart(2, '0')
          const monthNum = String(d.getMonth() + 1).padStart(2, '0')
          availableDates.push({
            date: dateStr,
            label: `${dayLabels[dayName]} ${dayNum}/${monthNum}`,
          })
        }
      }
    }

    if (availableDates.length === 0) {
      return {
        message: data.noSlotsMessage || 'Desculpe, não há datas disponíveis no momento.',
        nextStage: this.getDefaultEdge() ? this.nodeIdToStage.get(this.getDefaultEdge()!.target) : undefined,
      }
    }

    return {
      list: {
        title: data.askDateMessage || 'Selecione uma data',
        description: 'Datas disponíveis para agendamento',
        buttonText: 'Ver datas',
        sections: [{
          title: 'Datas',
          rows: availableDates.map((d) => ({
            rowId: d.date,
            title: d.label,
            description: d.date,
          })),
        }],
      },
      updateSessionData: {
        ...sessionUpdates,
        _awaitingInput: `${nodeId}_date`,
      },
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

  /**
   * Matches user input against a list of items by id, label, or 1-based numeric index.
   * Supports non-interactive channels where users reply with "1", "2", etc.
   */
  private matchByIdOrIndex<T>(
    input: string,
    items: T[],
    getId: (item: T) => string,
    getLabel: (item: T) => string,
  ): T | undefined {
    // Match by exact id
    const byId = items.find((item) => getId(item) === input)
    if (byId) return byId

    // Match by label (case-insensitive)
    const byLabel = items.find(
      (item) => getLabel(item).toLowerCase() === input.toLowerCase(),
    )
    if (byLabel) return byLabel

    // Match by 1-based numeric index
    const num = parseInt(input, 10)
    if (!isNaN(num) && num >= 1 && num <= items.length) {
      return items[num - 1]
    }

    return undefined
  }
}
