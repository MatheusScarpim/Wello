import bodyParser from 'body-parser'
import cors from 'cors'
import express, { Application, NextFunction, Request, Response } from 'express'
import { createServer, Server as HttpServerInstance } from 'http'
import * as path from 'path'
import swaggerUi from 'swagger-ui-express'

import swaggerDocument from '@/api/docs/swagger'
import SocketServer from '@/api/socket/SocketServer'

/**
 * Servidor HTTP principal da aplicação
 * Implementa padrão Singleton
 */
export class HttpServer {
  private static instance: HttpServer
  private app: Application
  private port: number
  private isRunning: boolean = false
  private errorHandlingConfigured: boolean = false
  private server: HttpServerInstance | null = null

  private constructor() {
    this.app = express()
    this.port = parseInt(process.env.HTTP_PORT || '8081', 10)
    this.setupMiddlewares()
    this.setupSwaggerDocs()
  }

  /**
   * Retorna instância única do servidor
   */
  public static getInstance(): HttpServer {
    if (!HttpServer.instance) {
      HttpServer.instance = new HttpServer()
    }
    return HttpServer.instance
  }

  /**
   * Configura middlewares globais
   */
  private setupMiddlewares(): void {
    // CORS
    this.app.use(
      cors({
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      }),
    )

    // Body parsers
    this.app.use(bodyParser.json({ limit: '100mb' }))
    this.app.use(bodyParser.urlencoded({ extended: true, limit: '100mb' }))

    // Serve arquivos estáticos da pasta uploads
    const uploadsPath = path.join(process.cwd(), 'uploads')
    this.app.use('/uploads', express.static(uploadsPath))

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const timestamp = new Date().toISOString()
      console.log(`📥 [${timestamp}] ${req.method} ${req.path}`)
      next()
    })

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      })
    })

    // Status endpoint
    this.app.get('/status', (req: Request, res: Response) => {
      res.status(200).json({
        status: 'operational',
        version: '2.0.0',
        service: 'welloChat API',
      })
    })
  }

  /**
   * Registra Swagger UI e o JSON bruto
   */
  private setupSwaggerDocs(): void {
    this.app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))
    this.app.get('/api/docs.json', (req: Request, res: Response) => {
      res.json(swaggerDocument)
    })
  }

  /**
   * Configura tratamento de erros
   */
  private setupErrorHandling(): void {
    if (this.errorHandlingConfigured) {
      return
    }

    this.errorHandlingConfigured = true

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
        timestamp: new Date().toISOString(),
      })
    })

    // Global error handler
    this.app.use(
      (err: Error, req: Request, res: Response, next: NextFunction) => {
        console.error('❌ Erro não tratado:', err)

        res.status(500).json({
          error: 'Internal Server Error',
          message:
            process.env.NODE_ENV === 'development'
              ? err.message
              : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        })
      },
    )
  }

  /**
   * Registra um router
   */
  public registerRouter(path: string, router: express.Router): void {
    this.app.use(path, router)
    console.log(`🔌 Router registrado: ${path}`)
  }

  /**
   * Registra múltiplos routers
   */
  public registerRouters(
    routers: Array<{ path: string; router: express.Router }>,
  ): void {
    routers.forEach(({ path, router }) => {
      this.registerRouter(path, router)
    })
  }

  /**
   * Retorna a aplicação Express
   */
  public getApp(): Application {
    return this.app
  }

  /**
   * Inicia o servidor
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Servidor HTTP já está rodando')
      return
    }

    // Error handlers must be registered after all routes
    this.setupErrorHandling()

    return new Promise((resolve) => {
      this.server = createServer(this.app)
      SocketServer.init(this.server)
      this.server.listen(this.port, () => {
        this.isRunning = true
        console.log(`🌐 Servidor HTTP rodando na porta ${this.port}`)
        resolve()
      })
    })
  }

  /**
   * Para o servidor
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️  Servidor HTTP não está rodando')
      return
    }

    if (this.server) {
      this.server.close()
    }
    this.isRunning = false
    console.log('🛑 Servidor HTTP parado')
  }

  /**
   * Verifica se está rodando
   */
  public getIsRunning(): boolean {
    return this.isRunning
  }

  /**
   * Retorna a porta
   */
  public getPort(): number {
    return this.port
  }
}

export default HttpServer.getInstance()
