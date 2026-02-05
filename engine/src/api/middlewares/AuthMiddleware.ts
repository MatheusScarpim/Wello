import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

import operatorRepository from '@/api/repositories/OperatorRepository'

/**
 * Interface para payload do JWT
 */
export interface JwtPayload {
  userId: string
  email?: string
  role?: string
}

/**
 * Estende Request do Express para incluir dados do usuário
 */
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

/**
 * Middleware de autenticação JWT
 */
export class AuthMiddleware {
  private secret: string

  constructor() {
    this.secret = process.env.JWT_SECRET || 'default-secret-change-me'
  }

  /**
   * Verifica token JWT
   */
  public authenticate = (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    try {
      // Pega token do header
      const authHeader = req.headers.authorization

      if (!authHeader) {
        res.status(401).json({
          success: false,
          error: 'Token não fornecido',
        })
        return
      }

      // Formato esperado: "Bearer TOKEN"
      const parts = authHeader.split(' ')

      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        res.status(401).json({
          success: false,
          error: 'Formato de token inválido',
        })
        return
      }

      const token = parts[1]

      // Verifica o token
      const decoded = jwt.verify(token, this.secret) as JwtPayload

      // Adiciona dados do usuário à requisição
      req.user = decoded

      if (decoded.userId || decoded.email) {
        operatorRepository
          .touchActivity(decoded.userId, decoded.email)
          .catch(() => undefined)
      }

      next()
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        res.status(401).json({
          success: false,
          error: 'Token expirado',
        })
        return
      }

      if (error.name === 'JsonWebTokenError') {
        res.status(401).json({
          success: false,
          error: 'Token inválido',
        })
        return
      }

      res.status(500).json({
        success: false,
        error: 'Erro ao verificar autenticação',
      })
    }
  }

  /**
   * Middleware opcional - não bloqueia se não houver token
   */
  public optionalAuth = (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    const authHeader = req.headers.authorization

    if (!authHeader) {
      return next()
    }

    try {
      const parts = authHeader.split(' ')
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const token = parts[1]
        const decoded = jwt.verify(token, this.secret) as JwtPayload
        req.user = decoded
      }
    } catch (error) {
      // Ignora erros no modo opcional
    }

    next()
  }

  /**
   * Gera um token JWT
   */
  public generateToken(payload: JwtPayload, expiresIn: string = '24h'): string {
    return jwt.sign(payload, this.secret, { expiresIn })
  }

  /**
   * Verifica se usuário tem role específica
   */
  public requireRole = (role: string) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Não autenticado',
        })
        return
      }

      if (req.user.role !== role) {
        res.status(403).json({
          success: false,
          error: 'Permissão negada',
        })
        return
      }

      next()
    }
  }

  /**
   * Verifica se usuário tem uma das roles
   */
  public requireAnyRole = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Não autenticado',
        })
        return
      }

      if (!req.user.role || !roles.includes(req.user.role)) {
        res.status(403).json({
          success: false,
          error: 'Permissão negada',
        })
        return
      }

      next()
    }
  }
}

export default new AuthMiddleware()
