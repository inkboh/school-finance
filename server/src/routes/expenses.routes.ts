import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import { validate, validateQuery } from '../middleware/validate.middleware'
import { CreateExpenseSchema, RejectExpenseSchema, ExpenseListQuerySchema } from '../schemas/expenses.schemas'
import {
  listExpenses,
  createExpense,
  getExpense,
  approveExpense,
  rejectExpense,
  getExpenseMonthlySummary,
} from '../controllers/expenses.controller'

const router = Router()

// All expenses routes require authentication
router.use(authenticate)

// GET /api/expenses — all authenticated roles
router.get('/', validateQuery(ExpenseListQuerySchema), listExpenses)

// GET /api/expenses/monthly-summary — must come before /:id
router.get('/monthly-summary', getExpenseMonthlySummary)

// POST /api/expenses
router.post('/', requireRole('FINANCE_MANAGER'), validate(CreateExpenseSchema), createExpense)

// GET /api/expenses/:id
router.get('/:id', getExpense)

// POST /api/expenses/:id/approve
router.post('/:id/approve', requireRole('FINANCE_MANAGER', 'PRINCIPAL'), approveExpense)

// POST /api/expenses/:id/reject
router.post('/:id/reject', requireRole('FINANCE_MANAGER', 'PRINCIPAL'), validate(RejectExpenseSchema), rejectExpense)

export default router
