import { Response } from 'express'
import { TxStatus } from '@prisma/client'
import { prisma } from '../services/prisma.service'
import { audit } from '../services/audit.service'
import { nextExpenseNumber } from '../services/sequence.service'
import { AuthRequest, paginate } from '../types'
import { CreateExpenseSchema, RejectExpenseSchema, ExpenseListQuerySchema } from '../schemas/expenses.schemas'

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

    const where: Parameters<typeof prisma.expense.findMany>[0]['where'] = {}

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
