import { Response } from 'express'
import { TxStatus } from '@prisma/client'
import { prisma } from '../services/prisma.service'
import { audit } from '../services/audit.service'
import { nextExpenseNumber } from '../services/sequence.service'
import { AuthRequest, paginate } from '../types'
import { CreateExpenseSchema, RejectExpenseSchema, ExpenseListQuerySchema } from '../schemas/expenses.schemas'

// ─── School year definitions (shared with fee tracker) ────────────────────────

const EXPENSE_SCHOOL_YEARS: Record<string, string[]> = {
  '2024-2025': [
    '2025-01', '2025-02', '2025-03', '2025-04',
    '2025-05', '2025-06', '2025-07', '2025-08',
  ],
  '2025-2026': [
    '2025-09', '2025-10', '2025-11', '2025-12',
    '2026-01', '2026-02', '2026-03', '2026-04',
    '2026-05', '2026-06', '2026-07', '2026-08',
  ],
}

function currentExpenseSchoolYear(): string {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`
}

function toMonthStr(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

// ─── Shared relation include ───────────────────────────────────────────────────

const expenseInclude = {
  category: {
    select: {
      name: true,
      parent: { select: { name: true } },
    },
  },
  currency: { select: { code: true, symbol: true } },
  createdBy:  { select: { name: true } },
  approvedBy: { select: { name: true } },
} as const

// ─── listExpenses ──────────────────────────────────────────────────────────────

export const listExpenses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const query = ExpenseListQuerySchema.safeParse(req.query)
    if (!query.success) {
      res.status(400).json({ success: false, error: 'Invalid query parameters', details: query.error.errors })
      return
    }

    const { page: pageStr, limit: limitStr, status, from, to, search, categoryId } = query.data
    const page  = parseInt(pageStr  ?? '1',  10)
    const limit = parseInt(limitStr ?? '20', 10)

    const where: NonNullable<Parameters<typeof prisma.expense.findMany>[0]>['where'] = {}

    if (status)     where.status     = status as TxStatus
    if (categoryId) where.categoryId = categoryId
    if (from || to) {
      where.expenseDate = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to   ? { lte: new Date(to)   } : {}),
      }
    }
    if (search) {
      where.OR = [
        { description:   { contains: search, mode: 'insensitive' } },
        { vendor:        { contains: search, mode: 'insensitive' } },
        { expenseNumber: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: expenseInclude,
        orderBy: { expenseDate: 'desc' },
        ...paginate(page, limit),
      }),
      prisma.expense.count({ where }),
    ])

    res.json({
      success: true,
      data: expenses,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    console.error('[listExpenses]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch expenses' })
  }
}

// ─── createExpense ─────────────────────────────────────────────────────────────

export const createExpense = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = CreateExpenseSchema.safeParse(req.body)
    if (!body.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: body.error.errors })
      return
    }

    const {
      categoryId, description, vendor, amount, currencyId,
      exchangeRate, expenseDate, paymentMethod, reference, notes,
    } = body.data

    const expenseNumber = await nextExpenseNumber()
    const amountBase    = Number(amount) * Number(exchangeRate)

    const expense = await prisma.expense.create({
      data: {
        expenseNumber,
        categoryId,
        description,
        vendor,
        amount,
        currencyId,
        exchangeRate,
        amountBase,
        expenseDate: new Date(expenseDate),
        paymentMethod,
        reference,
        notes,
        status:      'PENDING_APPROVAL',
        createdById: req.user.sub,
      },
      include: expenseInclude,
    })

    audit({
      userId:     req.user.sub,
      action:     'CREATE',
      entityType: 'Expense',
      entityId:   expense.id,
      newValue:   expense as object,
      ipAddress:  req.ip,
      userAgent:  req.headers['user-agent'],
    })

    res.status(201).json({ success: true, data: expense })
  } catch (err) {
    console.error('[createExpense]', err)
    res.status(500).json({ success: false, error: 'Failed to create expense' })
  }
}

// ─── getExpense ────────────────────────────────────────────────────────────────

export const getExpense = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const expense = await prisma.expense.findUnique({
      where: { id },
      include: expenseInclude,
    })

    if (!expense) {
      res.status(404).json({ success: false, error: 'Expense not found' })
      return
    }

    res.json({ success: true, data: expense })
  } catch (err) {
    console.error('[getExpense]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch expense' })
  }
}

// ─── approveExpense ────────────────────────────────────────────────────────────

export const approveExpense = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const existing = await prisma.expense.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ success: false, error: 'Expense not found' })
      return
    }

    // Separation of duties
    if (existing.createdById === req.user.sub) {
      res.status(403).json({ success: false, error: 'Separation of duties: you cannot approve your own expense' })
      return
    }

    if (existing.status !== 'PENDING_APPROVAL') {
      res.status(409).json({ success: false, error: `Expense is already ${existing.status.toLowerCase().replace('_', ' ')}` })
      return
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        status:      'APPROVED',
        approvedById: req.user.sub,
        approvedAt:  new Date(),
      },
      include: expenseInclude,
    })

    audit({
      userId:     req.user.sub,
      action:     'APPROVE',
      entityType: 'Expense',
      entityId:   expense.id,
      oldValue:   existing as object,
      newValue:   expense as object,
      ipAddress:  req.ip,
      userAgent:  req.headers['user-agent'],
    })

    res.json({ success: true, data: expense })
  } catch (err) {
    console.error('[approveExpense]', err)
    res.status(500).json({ success: false, error: 'Failed to approve expense' })
  }
}

// ─── rejectExpense ─────────────────────────────────────────────────────────────

export const rejectExpense = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const body = RejectExpenseSchema.safeParse(req.body)
    if (!body.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: body.error.errors })
      return
    }

    const { reason } = body.data

    const existing = await prisma.expense.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ success: false, error: 'Expense not found' })
      return
    }

    // Separation of duties
    if (existing.createdById === req.user.sub) {
      res.status(403).json({ success: false, error: 'Separation of duties: you cannot reject your own expense' })
      return
    }

    if (existing.status !== 'PENDING_APPROVAL') {
      res.status(409).json({ success: false, error: `Expense is already ${existing.status.toLowerCase().replace('_', ' ')}` })
      return
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        status:         'REJECTED',
        rejectedReason: reason,
        approvedById:   req.user.sub,
        approvedAt:     new Date(),
      },
      include: expenseInclude,
    })

    audit({
      userId:     req.user.sub,
      action:     'REJECT',
      entityType: 'Expense',
      entityId:   expense.id,
      oldValue:   existing as object,
      newValue:   expense as object,
      ipAddress:  req.ip,
      userAgent:  req.headers['user-agent'],
    })

    res.json({ success: true, data: expense })
  } catch (err) {
    console.error('[rejectExpense]', err)
    res.status(500).json({ success: false, error: 'Failed to reject expense' })
  }
}

// ─── getExpenseMonthlySummary ──────────────────────────────────────────────────

export const getExpenseMonthlySummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const year = (req.query['year'] as string | undefined) ?? currentExpenseSchoolYear()
    const months = EXPENSE_SCHOOL_YEARS[year]
    if (!months || months.length === 0) {
      res.status(400).json({ success: false, error: `Invalid year. Valid: ${Object.keys(EXPENSE_SCHOOL_YEARS).join(', ')}` })
      return
    }

    const firstMonth = months[0]!
    const lastMonth  = months[months.length - 1]!
    const yearStart  = new Date(`${firstMonth}-01T00:00:00.000Z`)
    const yearEnd    = new Date(`${lastMonth}-01T00:00:00.000Z`)
    yearEnd.setUTCMonth(yearEnd.getUTCMonth() + 1)

    const [expenses, allCategories] = await Promise.all([
      prisma.expense.findMany({
        where: { status: 'APPROVED', expenseDate: { gte: yearStart, lt: yearEnd } },
        select: { categoryId: true, amountBase: true, expenseDate: true },
      }),
      prisma.expenseCategory.findMany({
        where: { isActive: true },
        select: { id: true, name: true, parentId: true },
        orderBy: { name: 'asc' },
      }),
    ])

    // Raw totals: categoryId → month → total
    const rawTotals = new Map<string, Map<string, number>>()
    for (const e of expenses) {
      const month = toMonthStr(e.expenseDate)
      if (!rawTotals.has(e.categoryId)) rawTotals.set(e.categoryId, new Map())
      const m = rawTotals.get(e.categoryId)!
      m.set(month, (m.get(month) ?? 0) + Number(e.amountBase))
    }

    // Build children map
    const childrenOf = new Map<string, typeof allCategories>()
    for (const c of allCategories) {
      if (c.parentId) {
        if (!childrenOf.has(c.parentId)) childrenOf.set(c.parentId, [])
        childrenOf.get(c.parentId)!.push(c)
      }
    }

    const monthList = months // already narrowed above; alias to satisfy strict null checks
    function computeTotals(catId: string): Record<string, number> {
      const direct = rawTotals.get(catId) ?? new Map<string, number>()
      const result: Record<string, number> = {}
      for (const m of monthList) {
        result[m] = direct.get(m) ?? 0
      }
      for (const child of (childrenOf.get(catId) ?? [])) {
        const childTotals = computeTotals(child.id)
        for (const m of monthList) result[m] = (result[m] ?? 0) + (childTotals[m] ?? 0)
      }
      return result
    }

    interface SummaryRow {
      id: string; name: string; parentId: string | null; level: number
      totals: Record<string, number>; rowTotal: number
    }

    const rows: SummaryRow[] = []
    const parents = allCategories.filter((c) => !c.parentId)

    for (const parent of parents) {
      const parentTotals = computeTotals(parent.id)
      const parentRowTotal = Object.values(parentTotals).reduce((a, b) => a + b, 0)
      rows.push({ id: parent.id, name: parent.name, parentId: null, level: 0, totals: parentTotals, rowTotal: parentRowTotal })

      for (const child of (childrenOf.get(parent.id) ?? [])) {
        const childTotals = computeTotals(child.id)
        const childRowTotal = Object.values(childTotals).reduce((a, b) => a + b, 0)
        rows.push({ id: child.id, name: child.name, parentId: child.parentId, level: 1, totals: childTotals, rowTotal: childRowTotal })
      }
    }

    // Month totals = sum of all parent-level rows (avoids double-counting children)
    const monthTotals: Record<string, number> = {}
    for (const m of months) {
      monthTotals[m] = rows.filter((r) => r.level === 0).reduce((sum, r) => sum + (r.totals[m] ?? 0), 0)
    }
    const grandTotal = Object.values(monthTotals).reduce((a, b) => a + b, 0)

    res.json({ success: true, data: { year, months, rows, monthTotals, grandTotal } })
  } catch (err) {
    console.error('[getExpenseMonthlySummary]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch expense summary' })
  }
}
