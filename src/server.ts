import { buildApp } from './app'
import dotenv from 'dotenv'

dotenv.config()

const PORT = Number(process.env.PORT) || 3001
const HOST = process.env.HOST || '0.0.0.0'

async function start() {
  const app = await buildApp()
  try {
    await app.listen({ port: PORT, host: HOST })
    console.log(`\n🚀 Corporate OS API Server running at http://${HOST}:${PORT}`)
    console.log(`📚 API Docs: http://localhost:${PORT}/docs`)
    console.log(`❤️  Health: http://localhost:${PORT}/health\n`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
