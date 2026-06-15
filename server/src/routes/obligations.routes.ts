import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import {
  listObligations,
  getObligation,
  createObligation,
  updateObligation,
  recordPayment,
  approvePayment,
  getObligationSummary,
} from '../controllers/obligations.controller'

const router = Router()

router.use(authenticate)

router.get('/summary',                    getObligationSummary)
router.get('/',                           listObligations)
router.get('/:id',                        getObligation)
router.post('/',                          requireRole('FINANCE_MANAGER', 'SUPER_ADMIN'), createObligation)
router.patch('/:id',                      requireRole('FINANCE_MANAGER', 'SUPER_ADMIN'), updateObligation)
router.post('/:id/payments',              requireRole('CASHIER', 'FINANCE_MANAGER', 'SUPER_ADMIN'), recordPayment)
router.post('/:id/payments/:paymentId/approve', requireRole('FINANCE_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN'), approvePayment)

export default router
