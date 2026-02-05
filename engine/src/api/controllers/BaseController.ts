import { NextFunction, Request, Response } from 'express'

/**
 * Tipos para handlers
 */
export type ControllerHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void> | void

/**
 * Resultado de operação do controller
 */
export interface ControllerResult<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  statusCode?: number
}

/**
 * Controller base com métodos úteis
 */
export abstract class BaseController {
  /**
   * Envia resposta de sucesso
   */
  protected sendSuccess<T>(
    res: Response,
    data?: T,
    message?: string,
    statusCode: number = 200,
  ): void {
    res.status(statusCode).json({
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Envia resposta de erro
   */
  protected sendError(
    res: Response,
    error: string,
    statusCode: number = 400,
    details?: any,
  ): void {
    res.status(statusCode).json({
      success: false,
      error,
      details,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Envia resposta de erro interno
   */
  protected sendInternalError(res: Response, error: Error): void {
    console.error('❌ Erro interno:', error)

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message:
        process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Valida campos obrigatórios
   */
  protected validateRequiredFields(
    data: Record<string, any>,
    requiredFields: string[],
  ): { valid: boolean; missing?: string[] } {
    const missing = requiredFields.filter((field) => {
      const value = data[field]
      return value === undefined || value === null || value === ''
    })

    if (missing.length > 0) {
      return { valid: false, missing }
    }

    return { valid: true }
  }

  /**
   * Extrai parâmetros de query com valores padrão
   */
  protected getQueryParam(
    req: Request,
    key: string,
    defaultValue?: string,
  ): string | undefined {
    return (req.query[key] as string) || defaultValue
  }

  /**
   * Extrai parâmetros numéricos de query
   */
  protected getQueryParamAsNumber(
    req: Request,
    key: string,
    defaultValue?: number,
  ): number | undefined {
    const value = req.query[key] as string
    if (!value) return defaultValue

    const parsed = parseInt(value, 10)
    return isNaN(parsed) ? defaultValue : parsed
  }

  /**
   * Extrai parâmetros booleanos de query
   */
  protected getQueryParamAsBoolean(
    req: Request,
    key: string,
    defaultValue?: boolean,
  ): boolean {
    const value = req.query[key] as string
    if (!value) return defaultValue || false

    return value.toLowerCase() === 'true' || value === '1'
  }

  /**
   * Wrapper para tratamento de erros assíncronos
   */
  protected asyncHandler(handler: ControllerHandler): ControllerHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        await handler(req, res, next)
      } catch (error) {
        this.sendInternalError(res, error as Error)
      }
    }
  }

  /**
   * Extrai paginação da query
   */
  protected getPagination(req: Request): {
    page: number
    limit: number
    skip: number
  } {
    const pickValue = (value: unknown): unknown => {
      if (Array.isArray(value)) {
        return value[0]
      }
      return value
    }

    const parseNumericParam = (
      value: unknown,
      defaultValue: number,
    ): number => {
      const normalized = pickValue(value)

      if (typeof normalized === 'number' && !isNaN(normalized)) {
        return normalized
      }

      if (typeof normalized === 'string') {
        const parsed = parseInt(normalized, 10)
        if (!isNaN(parsed)) {
          return parsed
        }
      }

      return defaultValue
    }

    const rawPage = req.query.page ?? req.body?.page
    const rawLimit = req.query.limit ?? req.body?.limit

    const page = Math.max(1, parseNumericParam(rawPage, 1))
    const limit = Math.min(100, Math.max(1, parseNumericParam(rawLimit, 10)))
    const skip = (page - 1) * limit

    return { page, limit, skip }
  }
}

export default BaseController
