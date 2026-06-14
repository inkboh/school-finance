import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { getSummary, getCashFlow, getRecentActivity } from '../controllers/dashboard.controller'

const router = Router()

// All dashboard routes require authentication; no role restriction — all roles can see the dashboard
router.use(authenticate)

// GET /api/dashboard/summary
router.get('/summary', getSummary)

// GET /api/dashboard/cash-flow
router.get('/cash-flow', getCashFlow)

// GET /api/dashboard/recent
router.get('/recent', getRecentActivity)

export default router
