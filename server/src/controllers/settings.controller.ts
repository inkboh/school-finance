import { z } from 'zod'
import { Response } from 'express'
import { prisma } from '../services/prisma.service'
import { audit } from '../services/audit.service'
import { AuthRequest } from '../types'
import {
  CreateCurrencySchema,
  CreateExchangeRateSchema,
  CreateFeeCategorySchema,
  UpdateFeeCategorySchema,
  CreateExpenseCategorySchema,
  UpdateExpenseCategorySchema,
} from '../schemas/settings.schemas'

const UpdateCurrencySchema = z.object({
  name: z.string().min(1).optional(),
  symbol: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
})

// ─── Currencies ───────────────────────────────────────────────────────────────

export const listCurrencies = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currencies = await prisma.currency.findMany({
      orderBy: { code: 'asc' },
      include: {
        exchangeRates: {
          orderBy: { effectiveDate: 'desc' },
          take: 1,
        },
      },
    })

    res.json({ success: true, data: currencies })
  } catch (err) {
    console.error('[settings] listCurrencies error:', err)
    res.status(500).json({ success: false, error: 'Failed to retrieve currencies' })
  }
}

export const createCurrency = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = CreateCurrencySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.errors })
      return
    }

    const { code, name, symbol, isBaseCurrency } = parsed.data

    // If this will be the base currency, demote all existing base currencies first
    if (isBaseCurrency) {
      await prisma.currency.updateMany({
        where: { isBaseCurrency: true },
        data: { isBaseCurrency: false },
      })
    }

    const currency = await prisma.currency.create({
      data: { code, name, symbol, isBaseCurrency },
    })

    audit({
      userId: req.user.sub,
      action: 'CREATE',
      entityType: 'Currency',
      entityId: currency.id,
      newValue: currency,
    })

    res.status(201).json({ success: true, data: currency })
  } catch (err: unknown) {
    console.error('[settings] createCurrency error:', err)
    const isPrismaUniqueViolation =
      typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'
    if (isPrismaUniqueViolation) {
      res.status(409).json({ success: false, error: 'Currency code already exists' })
      return
    }
    res.status(500).json({ success: false, error: 'Failed to create currency' })
  }
}

export const updateCurrency = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const existing = await prisma.currency.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ success: false, error: 'Currency not found' })
      return
    }

    // Validate only the fields that are updatable (name, symbol, isActive)
    const parsed = UpdateCurrencySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.errors })
      return
    }

    const { name, symbol, isActive } = parsed.data as { name?: string; symbol?: string; isActive?: boolean }

    // Cannot deactivate the base currency
    if (isActive === false && existing.isBaseCurrency) {
      res.status(400).json({ success: false, error: 'Cannot deactivate the base currency' })
      return
    }

    const updated = await prisma.currency.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(symbol !== undefined && { symbol }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    audit({
      userId: req.user.sub,
      action: 'UPDATE',
      entityType: 'Currency',
      entityId: updated.id,
      oldValue: existing,
      newValue: updated,
    })

    res.json({ success: true, data: updated })
  } catch (err) {
    console.error('[settings] updateCurrency error:', err)
    res.status(500).json({ success: false, error: 'Failed to update currency' })
  }
}

// ─── Exchange Rates ───────────────────────────────────────────────────────────

export const listExchangeRates = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rates = await prisma.exchangeRate.findMany({
      orderBy: { effectiveDate: 'desc' },
      include: {
        currency: true,
      },
    })

    res.json({ success: true, data: rates })
  } catch (err) {
    console.error('[settings] listExchangeRates error:', err)
    res.status(500).json({ success: false, error: 'Failed to retrieve exchange rates' })
  }
}

export const createExchangeRate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = CreateExchangeRateSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.errors })
      return
    }

    const { currencyId, rate, effectiveDate } = parsed.data

    const currency = await prisma.currency.findUnique({ where: { id: currencyId } })
    if (!currency) {
      res.status(404).json({ success: false, error: 'Currency not found' })
      return
    }

    const exchangeRate = await prisma.exchangeRate.create({
      data: {
        currencyId,
        rate,
        effectiveDate: new Date(effectiveDate),
      },
      include: { currency: true },
    })

    audit({
      userId: req.user.sub,
      action: 'CREATE',
      entityType: 'ExchangeRate',
      entityId: exchangeRate.id,
      newValue: exchangeRate,
    })

    res.status(201).json({ success: true, data: exchangeRate })
  } catch (err: unknown) {
    console.error('[settings] createExchangeRate error:', err)
    const isPrismaUniqueViolation =
      typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'
    if (isPrismaUniqueViolation) {
      res.status(409).json({ success: false, error: 'Exchange rate for this currency and date already exists' })
      return
    }
    res.status(500).json({ success: false, error: 'Failed to create exchange rate' })
  }
}

// ─── Fee Categories ───────────────────────────────────────────────────────────

export const listFeeCategories = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { active } = req.query as { active?: string }

    const where: Record<string, unknown> = {}
    if (active === 'true') where.isActive = true

    const categories = await prisma.feeCategory.findMany({
      where,
      orderBy: { name: 'asc' },
    })

    res.json({ success: true, data: categories })
  } catch (err) {
    console.error('[settings] listFeeCategories error:', err)
    res.status(500).json({ success: false, error: 'Failed to retrieve fee categories' })
  }
}

export const createFeeCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = CreateFeeCategorySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.errors })
      return
    }

    const category = await prisma.feeCategory.create({ data: parsed.data })

    audit({
      userId: req.user.sub,
      action: 'CREATE',
      entityType: 'FeeCategory',
      entityId: category.id,
      newValue: category,
    })

    res.status(201).json({ success: true, data: category })
  } catch (err: unknown) {
    console.error('[settings] createFeeCategory error:', err)
    const isPrismaUniqueViolation =
      typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'
    if (isPrismaUniqueViolation) {
      res.status(409).json({ success: false, error: 'Fee category name already exists' })
      return
    }
    res.status(500).json({ success: false, error: 'Failed to create fee category' })
  }
}

export const updateFeeCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const existing = await prisma.feeCategory.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ success: false, error: 'Fee category not found' })
      return
    }

    const parsed = UpdateFeeCategorySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.errors })
      return
    }

    const updated = await prisma.feeCategory.update({
      where: { id },
      data: parsed.data,
    })

    audit({
      userId: req.user.sub,
      action: 'UPDATE',
      entityType: 'FeeCategory',
      entityId: updated.id,
      oldValue: existing,
      newValue: updated,
    })

    res.json({ success: true, data: updated })
  } catch (err: unknown) {
    console.error('[settings] updateFeeCategory error:', err)
    const isPrismaUniqueViolation =
      typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'
    if (isPrismaUniqueViolation) {
      res.status(409).json({ success: false, error: 'Fee category name already exists' })
      return
    }
    res.status(500).json({ success: false, error: 'Failed to update fee category' })
  }
}

// ─── Expense Categories ───────────────────────────────────────────────────────

export const listExpenseCategories = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categories = await prisma.expenseCategory.findMany({
      orderBy: { name: 'asc' },
      include: {
        parent: true,
      },
    })

    res.json({ success: true, data: categories })
  } catch (err) {
    console.error('[settings] listExpenseCategories error:', err)
    res.status(500).json({ success: false, error: 'Failed to retrieve expense categories' })
  }
}

export const createExpenseCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = CreateExpenseCategorySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.errors })
      return
    }

    const { name, parentId, description } = parsed.data

    // Validate parent exists if provided
    if (parentId) {
      const parent = await prisma.expenseCategory.findUnique({ where: { id: parentId } })
      if (!parent) {
        res.status(404).json({ success: false, error: 'Parent expense category not found' })
        return
      }
    }

    const category = await prisma.expenseCategory.create({
      data: { name, parentId, description },
      include: { parent: true },
    })

    audit({
      userId: req.user.sub,
      action: 'CREATE',
      entityType: 'ExpenseCategory',
      entityId: category.id,
      newValue: category,
    })

    res.status(201).json({ success: true, data: category })
  } catch (err: unknown) {
    console.error('[settings] createExpenseCategory error:', err)
    const isPrismaUniqueViolation =
      typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'
    if (isPrismaUniqueViolation) {
      res.status(409).json({ success: false, error: 'Expense category name already exists' })
      return
    }
    res.status(500).json({ success: false, error: 'Failed to create expense category' })
  }
}

export const updateExpenseCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const existing = await prisma.expenseCategory.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ success: false, error: 'Expense category not found' })
      return
    }

    const parsed = UpdateExpenseCategorySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.errors })
      return
    }

    const updated = await prisma.expenseCategory.update({
      where: { id },
      data: parsed.data,
      include: { parent: true },
    })

    audit({
      userId: req.user.sub,
      action: 'UPDATE',
      entityType: 'ExpenseCategory',
      entityId: updated.id,
      oldValue: existing,
      newValue: updated,
    })

    res.json({ success: true, data: updated })
  } catch (err: unknown) {
    console.error('[settings] updateExpenseCategory error:', err)
    const isPrismaUniqueViolation =
      typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'
    if (isPrismaUniqueViolation) {
      res.status(409).json({ success: false, error: 'Expense category name already exists' })
      return
    }
    res.status(500).json({ success: false, error: 'Failed to update expense category' })
  }
}
