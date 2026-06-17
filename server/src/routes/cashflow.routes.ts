import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { getCashFlowSummary } from '../controllers/cashflow.controller'

const router = Router()

router.use(authenticate)

router.get('/summary', getCashFlowSummary)

export default router
