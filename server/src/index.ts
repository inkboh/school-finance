import 'dotenv/config'
import app from './app'
import { prisma } from './services/prisma.service'

const PORT = process.env['PORT'] ?? 4000

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

process.on('SIGTERM', async () => {
  console.log('SIGTERM received -- shutting down gracefully')
  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
})
