import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'
import { prisma } from './db'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export async function buildApp() {
  const app = Fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true }
      }
    },
    trustProxy: true
  })

  // CORS
  await app.register(cors, {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
  })

  // Rate Limiting
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute'
  })

  // JWT
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'fallback-secret-for-dev',
    sign: { expiresIn: '24h' }
  })

  // Multipart (file uploads)
  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
      files: 5
    }
  })

  // Swagger Docs
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Corporate OS API',
        description: 'Enterprise Management & Productivity System',
        version: '1.0.0'
      },
      servers: [{ url: `http://localhost:${process.env.PORT || 3001}` }],
      components: {
        securitySchemes: {
          BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
        }
      }
    }
  })

  await app.register(swaggerUI, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: false }
  })

  // Auth decorator
  app.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.code(401).send({ success: false, message: 'Unauthorized: Invalid or expired token' })
    }
  })

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'MANAGEMENT-OS-API',
    version: '1.0.0'
  }))

  // Register routes
  await app.register(import('./routes/auth'), { prefix: '/api/v1/auth' })
  await app.register(import('./routes/companies'), { prefix: '/api/v1/companies' })
  await app.register(import('./routes/departments'), { prefix: '/api/v1/departments' })
  await app.register(import('./routes/positions'), { prefix: '/api/v1/positions' })
  await app.register(import('./routes/employees'), { prefix: '/api/v1/employees' })
  await app.register(import('./routes/appraisals'), { prefix: '/api/v1/appraisals' })
  await app.register(import('./routes/okr/cycles'), { prefix: '/api/v1/okr/cycles' })
  await app.register(import('./routes/okr/objectives'), { prefix: '/api/v1/okr/objectives' })
  await app.register(import('./routes/okr/keyresults'), { prefix: '/api/v1/okr/key-results' })
  await app.register(import('./routes/okr/actionplans'), { prefix: '/api/v1/okr/action-plans' })
  await app.register(import('./routes/okr/tasks'), { prefix: '/api/v1/okr/tasks' })
  await app.register(import('./routes/okr/blockers'), { prefix: '/api/v1/okr/blockers' })
  await app.register(import('./routes/okr/checkins'), { prefix: '/api/v1/okr/check-ins' })
  await app.register(import('./routes/analytics'), { prefix: '/api/v1/analytics' })
  await app.register(import('./routes/dashboard'), { prefix: '/api/v1/dashboard' })
  await app.register(import('./routes/announcements'), { prefix: '/api/v1/announcements' })

  // Graceful shutdown
  app.addHook('onClose', async () => {
    await prisma.$disconnect()
  })

  return app
}
