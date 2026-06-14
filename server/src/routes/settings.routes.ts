import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import { validate } from '../middleware/validate.middleware'
import {
  CreateCurrencySchema,
  CreateExchangeRateSchema,
  CreateFeeCategorySchema,
  UpdateFeeCategorySchema,
  CreateExpenseCategorySchema,
  UpdateExpenseCategorySchema,
} from '../schemas/settings.schemas'
import {
  listCurrencies,
  createCurrency,
  updateCurrency,
  listExchangeRates,
  createExchangeRate,
  listFeeCategories,
  createFeeCategory,
  updateFeeCategory,
  listExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
} from '../controllers/settings.controller'

const router = Router()

// All settings routes require authentication
router.use(authenticate)

// ── Currencies ────────────────────────────────────────────────────────────────

// GET /api/settings/currencies — all authenticated roles
router.get('/currencies', listCurrencies)

// POST /api/settings/currencies
router.post('/currencies', requireRole('SUPER_ADMIN'), validate(CreateCurrencySchema), createCurrency)

// PUT /api/settings/currencies/:id
router.put('/currencies/:id', requireRole('SUPER_ADMIN'), updateCurrency)

// ── Exchange Rates ────────────────────────────────────────────────────────────

// GET /api/settings/exchange-rates — all authenticated roles
router.get('/exchange-rates', listExchangeRates)

// POST /api/settings/exchange-rates
router.post('/exchange-rates', requireRole('SUPER_ADMIN'), validate(CreateExchangeRateSchema), createExchangeRate)

// ── Fee Categories ────────────────────────────────────────────────────────────

// GET /api/settings/fee-categories — all authenticated roles
router.get('/fee-categories', listFeeCategories)

// POST /api/settings/fee-categories
router.post('/fee-categories', requireRole('SUPER_ADMIN'), validate(CreateFeeCategorySchema), createFeeCategory)

// PUT /api/settings/fee-categories/:id
router.put('/fee-categories/:id', requireRole('SUPER_ADMIN'), validate(UpdateFeeCategorySchema), updateFeeCategory)

// ── Expense Categories ────────────────────────────────────────────────────────

// GET /api/settings/expense-categories — all authenticated roles
router.get('/expense-categories', listExpenseCategories)

// POST /api/settings/expense-categories
router.post('/expense-categories', requireRole('SUPER_ADMIN'), validate(CreateExpenseCategorySchema), createExpenseCategory)

// PUT /api/settings/expense-categories/:id
router.put('/expense-categories/:id', requireRole('SUPER_ADMIN'), validate(UpdateExpenseCategorySchema), updateExpenseCategory)

export default router
