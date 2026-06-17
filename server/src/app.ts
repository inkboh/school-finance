import 'dotenv/config'
import * as path from 'path'
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'

import authRoutes from './routes/auth.routes'
import usersRoutes from './routes/users.routes'
import feesRoutes from './routes/fees.routes'
import expensesRoutes from './routes/expenses.routes'
import loansRoutes from './routes/loans.routes'
import dashboardRoutes from './routes/dashboard.routes'
import auditRoutes from './routes/audit.routes'
import settingsRoutes from './routes/settings.routes'
import studentsRoutes from './routes/students.routes'
import obligationsRoutes from './routes/obligations.routes'
import projectsRoutes from './routes/projects.routes'
import documentsRoutes from './routes/documents.routes'
import votesRoutes from './routes/votes.routes'
import cashflowRoutes from './routes/cashflow.routes'

const app = express()
const CLIENT_URL = process.env['CLIENT_URL'] ?? 'http://localhost:5173'

app.set('trust proxy', 1)

app.use(helmet())
app.use(cors({ origin: CLIENT_URL, credentials: true }))
app.use(compression())
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' },
})

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts, please try again later' },
})

app.use('/api', generalLimiter)
app.use('/api/auth/login', loginLimiter)

app.use('/api/auth', authRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/fees', feesRoutes)
app.use('/api/expenses', expensesRoutes)
app.use('/api/loans', loansRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/students', studentsRoutes)
app.use('/api/obligations', obligationsRoutes)
app.use('/api/projects', projectsRoutes)
app.use('/api/documents', documentsRoutes)
app.use('/api/votes', votesRoutes)
app.use('/api/cashflow', cashflowRoutes)

// Serve uploaded files in local dev only (production uses S3)
if (process.env.NODE_ENV !== 'production') {
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))
}

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Not found' })
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[unhandled error]', err)
  res.status(500).json({ success: false, error: 'Internal server error' })
})

export default app
