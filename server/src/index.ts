import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { prisma } from './services/prisma.service'

import authRoutes from './routes/auth.routes'
import usersRoutes from './routes/users.routes'
import feesRoutes from './routes/fees.routes'
import expensesRoutes from './routes/expenses.routes'
import loansRoutes from './routes/loans.routes'
import dashboardRoutes from './routes/dashboard.routes'
import auditRoutes from './routes/audit.routes'
import settingsRoutes from './routes/settings.routes'

const app = express()
const PORT = process.env['PORT'] ?? 4000
const CLIENT_URL = process.env['CLIENT_URL'] ?? 'http://localhost:5173'

// ── Security & utility middleware ─────────────────────────────────────────────

app.use(helmet())
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
)
app.use(compression())
app.use(morgan('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ── Rate limiting ─────────────────────────────────────────────────────────────

// General limiter: 100 requests per 15 minutes on all /api routes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' },
})

// Stricter limiter for login: 10 requests per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts, please try again later' },
})

app.use('/api', generalLimiter)
app.use('/api/auth/login', loginLimiter)

// ── Routes ────────────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/fees', feesRoutes)
app.use('/api/expenses', expensesRoutes)
app.use('/api/loans', loansRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/settings', settingsRoutes)

// ── 404 handler ───────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Not found' })
})

// ── Global error handler ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[unhandled error]', err)
  res.status(500).json({ success: false, error: 'Internal server error' })
})

// ── Start server ──────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

// ── Graceful shutdown ─────────────────────────────────────────────────────────

process.on('SIGTERM', async () => {
  console.log('SIGTERM received — shutting down gracefully')
  server.close(async () => {
    await prisma.$disconnect()
    console.log('Prisma disconnected. Goodbye.')
    process.exit(0)
  })
})

export default app
