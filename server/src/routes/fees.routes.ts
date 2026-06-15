import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import { validate, validateQuery } from '../middleware/validate.middleware'
import { CreateFeeReceiptSchema, RejectSchema, ListQuerySchema } from '../schemas/fees.schemas'
import {
  listReceipts,
  createReceipt,
  getReceipt,
  approveReceipt,
  rejectReceipt,
} from '../controllers/fees.controller'
import { getFeeTracker } from '../controllers/fees.tracker.controller'

const router = Router()

// All fees routes require authentication
router.use(authenticate)

// GET /api/fees/tracker — monthly payment status matrix (must be before /:id)
router.get('/tracker', getFeeTracker)

// GET /api/fees — all authenticated roles
router.get('/', validateQuery(ListQuerySchema), listReceipts)

// POST /api/fees
router.post('/', requireRole('CASHIER', 'FINANCE_MANAGER'), validate(CreateFeeReceiptSchema), createReceipt)

// GET /api/fees/:id
router.get('/:id', getReceipt)

// POST /api/fees/:id/approve
router.post('/:id/approve', requireRole('FINANCE_MANAGER', 'PRINCIPAL'), approveReceipt)

// POST /api/fees/:id/reject
router.post('/:id/reject', requireRole('FINANCE_MANAGER', 'PRINCIPAL'), validate(RejectSchema), rejectReceipt)

export default router
