import { Request, Response, Router } from 'express'

import AuthMiddleware from '@/api/middlewares/AuthMiddleware'
import operatorRepository from '@/api/repositories/OperatorRepository'

const router = Router()

/**
 * Interface para requisição de token
 */
interface GenerateTokenRequest {
  userId: string
  email?: string
  role?: string
  expiresIn?: string
  description?: string
}

/**
 * Gera um token de autenticação
 * POST /api/auth/token/generate
 */
router.post('/token/generate', (req: Request, res: Response) => {
  try {
    const {
      userId,
      email,
      role,
      expiresIn,
      description,
    }: GenerateTokenRequest = req.body

    // Validação
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId é obrigatório',
      })
    }

    // Gera o token
    const token = AuthMiddleware.generateToken(
      {
        userId,
        email,
        role: role || 'user',
      },
      expiresIn || '365d', // Padrão: 1 ano (token permanente)
    )

    res.json({
      success: true,
      data: {
        token,
        userId,
        email,
        role: role || 'user',
        expiresIn: expiresIn || '365d',
        description,
        createdAt: new Date().toISOString(),
        usage: `Authorization: Bearer ${token}`,
      },
      message: 'Token gerado com sucesso',
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Erro ao gerar token',
      message: error.message,
    })
  }
})

/**
 * Valida um token
 * POST /api/auth/token/validate
 */
router.post('/token/validate', (req: Request, res: Response) => {
  try {
    const { token } = req.body

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token não fornecido',
      })
    }

    // Usa o middleware para validar
    const mockReq: any = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    }

    const mockRes: any = {
      status: (code: number) => ({
        json: (data: any) => {
          res.status(code).json(data)
        },
      }),
    }

    const mockNext = () => {
      // Token válido
      res.json({
        success: true,
        data: mockReq.user,
        message: 'Token válido',
      })
    }

    AuthMiddleware.authenticate(mockReq, mockRes, mockNext)
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Erro ao validar token',
      message: error.message,
    })
  }
})

/**
 * Login de operador
 * POST /api/auth/login
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, remember, expiresIn } = req.body || {}

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email e password sao obrigatorios',
      })
    }

    const operator = await operatorRepository.validateCredentials(
      email,
      password,
    )
    if (!operator) {
      return res.status(401).json({
        success: false,
        error: 'Credenciais invalidas',
      })
    }

    if (operator._id) {
      await operatorRepository.updateStatus(operator._id.toString(), 'online')
      operator.status = 'online'
    }

    const tokenExpiresIn = expiresIn || (remember ? '30d' : '24h')
    const userId = operator._id?.toString() || email

    const token = AuthMiddleware.generateToken(
      {
        userId,
        email: operator.email,
        role: operator.role,
      },
      tokenExpiresIn,
    )

    return res.json({
      success: true,
      data: {
        token,
        userId,
        email: operator.email,
        role: operator.role,
        expiresIn: tokenExpiresIn,
        createdAt: new Date().toISOString(),
        usage: `Authorization: Bearer ${token}`,
        operator,
      },
      message: 'Login realizado com sucesso',
    })
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: 'Erro ao realizar login',
      message: error.message,
    })
  }
})

/**
 * Informações sobre o sistema de autenticação
 * GET /api/auth/info
 */
router.get('/info', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      type: 'JWT (JSON Web Token)',
      algorithm: 'HS256',
      header: 'Authorization: Bearer <token>',
      defaultExpiration: '365d',
      endpoints: {
        generate: 'POST /api/auth/token/generate',
        validate: 'POST /api/auth/token/validate',
        info: 'GET /api/auth/info',
      },
      usage: {
        description:
          'Inclua o token no header Authorization de todas as requisições protegidas',
        example: {
          header: 'Authorization',
          value: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
})

/**
 * Endpoint protegido de exemplo (teste)
 * GET /api/auth/test
 */
router.get(
  '/test',
  AuthMiddleware.authenticate,
  (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'Autenticação bem-sucedida!',
      data: {
        authenticatedUser: req.user,
        timestamp: new Date().toISOString(),
      },
    })
  },
)

export default router
