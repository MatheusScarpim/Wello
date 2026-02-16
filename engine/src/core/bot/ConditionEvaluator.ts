/**
 * Avaliador de condicoes para nos Condition e validacao de input
 */
export class ConditionEvaluator {
  /**
   * Avalia uma condicao comparando variableValue com compareValue usando o operador
   */
  static evaluate(
    variableValue: string | undefined,
    operator: string,
    compareValue: string,
  ): boolean {
    const v = (variableValue ?? '').toString()
    const c = (compareValue ?? '').toString()

    switch (operator) {
      case 'equals':
        return v === c
      case 'not_equals':
        return v !== c
      case 'contains':
        return v.toLowerCase().includes(c.toLowerCase())
      case 'not_contains':
        return !v.toLowerCase().includes(c.toLowerCase())
      case 'starts_with':
        return v.toLowerCase().startsWith(c.toLowerCase())
      case 'ends_with':
        return v.toLowerCase().endsWith(c.toLowerCase())
      case 'regex':
        try {
          return new RegExp(c, 'i').test(v)
        } catch {
          return false
        }
      case 'greater_than':
        return parseFloat(v) > parseFloat(c)
      case 'less_than':
        return parseFloat(v) < parseFloat(c)
      case 'is_empty':
        return v.trim() === ''
      case 'is_not_empty':
        return v.trim() !== ''
      default:
        return false
    }
  }

  /**
   * Valida input de usuario para nos AskQuestion
   */
  static validateInput(
    input: string,
    validation: {
      type: string
      value?: any
      errorMessage?: string
    },
  ): { isValid: boolean; error?: string } {
    const defaultError =
      validation.errorMessage || 'Entrada invalida. Tente novamente.'

    switch (validation.type) {
      case 'none':
        return { isValid: true }

      case 'options': {
        const options: string[] = Array.isArray(validation.value)
          ? validation.value
          : String(validation.value || '')
              .split(',')
              .map((s) => s.trim())
        const isValid = options.some(
          (opt) => opt.toLowerCase() === input.toLowerCase(),
        )
        return isValid
          ? { isValid: true }
          : { isValid: false, error: defaultError }
      }

      case 'regex': {
        try {
          const regex = new RegExp(validation.value || '', 'i')
          const isValid = regex.test(input)
          return isValid
            ? { isValid: true }
            : { isValid: false, error: defaultError }
        } catch {
          return { isValid: true }
        }
      }

      case 'length': {
        const min = validation.value?.min ?? 0
        const max = validation.value?.max ?? Infinity
        const isValid = input.length >= min && input.length <= max
        return isValid
          ? { isValid: true }
          : { isValid: false, error: defaultError }
      }

      case 'number': {
        const isValid = !isNaN(parseFloat(input)) && isFinite(Number(input))
        return isValid
          ? { isValid: true }
          : {
              isValid: false,
              error: defaultError || 'Por favor, digite um numero valido.',
            }
      }

      case 'email': {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        const isValid = emailRegex.test(input)
        return isValid
          ? { isValid: true }
          : {
              isValid: false,
              error: defaultError || 'Por favor, digite um email valido.',
            }
      }

      case 'phone': {
        const phoneRegex = /^\+?[\d\s()-]{8,20}$/
        const isValid = phoneRegex.test(input)
        return isValid
          ? { isValid: true }
          : {
              isValid: false,
              error:
                defaultError || 'Por favor, digite um telefone valido.',
            }
      }

      default:
        return { isValid: true }
    }
  }
}
