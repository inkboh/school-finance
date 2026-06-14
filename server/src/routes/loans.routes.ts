import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import { validate, validateQuery } from '../middleware/validate.middleware'
import {
  CreateLoanSchema,
  UpdateLoanStatusSchema,
  CreateLoanPaymentSchema,
  LoanListQuerySchema,
} from '../schemas/loans.schemas'
import {
  listLoans,
  createLoan,
  getLoan,
  updateLoanStatus,
  createPayment,
  approvePayment,
} from '../controllers/loans.controller'

const router = Router()

// All loans routes require authentication
router.use(authenticate)

// GET /api/loans — all authenticated roles
router.get('/', validateQuery(LoanListQuerySchema), listLoans)

// POST /api/loans
router.post('/', requireRole('FINANCE_MANAGER'), validate(CreateLoanSchema), createLoan)

// GET /api/loans/:id
router.get('/:id', getLoan)

// PATCH /api/loans/:id/status
router.patch('/:id/status', requireRole('FINANCE_MANAGER', 'PRINCIPAL'), validate(UpdateLoanStatusSchema), updateLoanStatus)

// POST /api/loans/:id/payments
router.post('/:id/payments', requireRole('FINANCE_MANAGER'), validate(CreateLoanPaymentSchema), createPayment)

// POST /api/loans/:id/payments/:paymentId/approve
router.post('/:id/payments/:paymentId/approve', requireRole('FINANCE_MANAGER', 'PRINCIPAL'), approvePayment)

export default router
