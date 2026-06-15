import { Request, Response } from 'express'
import { prisma } from '../services/prisma.service'
import { audit } from '../services/audit.service'
import { AuthRequest, paginate } from '../types'
import { z } from 'zod'
import { ObligationCategory, ObligationFrequency, TxStatus, PaymentMethod } from '@prisma/client'

const CreateObligationSchema = z.object({
  name:          z.string().min(1),
  description:   z.string().optional(),
  category:      z.nativeEnum(ObligationCategory),
  amount:        z.number().positive(),
  currencyId:    z.string().min(1),
  frequency:     z.nativeEnum(ObligationFrequency),
  nextDueDate:   z.string(),
  vendorName:    z.string().optional(),
  vendorContact: z.string().optional(),
  notes:         z.string().optional(),
})

const RecordPaymentSchema = z.object({
  amount:        z.number().positive(),
  currencyId:    z.string().min(1),
  exchangeRate:  z.number().positive().default(1),
  amountBase:    z.number().positive(),
  paidDate:      z.string(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  reference:     z.string().optional(),
  notes:         z.string().optional(),
})

const OBLIGATION_INCLUDE = {
  currency: { select: { code: true, symbol: true } },
  payments: {
    orderBy: { paidDate: 'desc' as const },
    take: 5,
    include: {
      currency: { select: { code: true, symbol: true } },
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
    },
  },
} as const

function nextDueAfter(current: Date, frequency: ObligationFrequency): Date {
  const d = new Date(current)
  switch (frequency) {
    case 'WEEKLY':      d.setDate(d.getDate() + 7);      break
    case 'MONTHLY':     d.setMonth(d.getMonth() + 1);    break
    case 'QUARTERLY':   d.setMonth(d.getMonth() + 3);    break
    case 'BIANNUALLY':  d.setMonth(d.getMonth() + 6);    break
    case 'ANNUALLY':    d.setFullYear(d.getFullYear()+1); break
    case 'ONCE':        break
  }
  return d
}

export const listObligations = async (req: Request, res: Response): Promise<void> => {
  try {
    const page  = Math.max(1, parseInt(req.query.page as string ?? '1', 10) || 1)
    const limit = Math.max(1, parseInt(req.query.limit as string ?? '20', 10) || 20)
    const { skip, take } = paginate(page, limit)

    const where: Record<string, unknown> = {}
    if (req.query.category) where.category = req.query.category as ObligationCategory
    if (req.query.isActive !== undefined) where.isActive = req.query.isActive === 'true'
    if (req.query.overdue === 'true') where.nextDueDate = { lte: new Date() }

    const [total, obligations] = await Promise.all([
      prisma.recurringObligation.count({ where }),
      prisma.recurringObligation.findMany({
        where, skip, take,
        orderBy: { nextDueDate: 'asc' },
        include: { currency: { select: { code: true, symbol: true } } },
      }),
    ])

    res.json({
      success: true,
      data: obligations,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('[obligations] list:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const getObligation = async (req: Request, res: Response): Promise<void> => {
  try {
    const obl = await prisma.recurringObligation.findUnique({
      where: { id: req.params.id },
      include: OBLIGATION_INCLUDE,
    })
    if (!obl) { res.status(404).json({ success: false, error: 'Obligation not found' }); return }
    res.json({ success: true, data: obl })
  } catch (err) {
    console.error('[obligations] get:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const createObligation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = CreateObligationSchema.parse(req.body)
    const obl = await prisma.recurringObligation.create({
      data: {
        ...data,
        nextDueDate: new Date(data.nextDueDate),
        amount: data.amount,
      },
      include: { currency: { select: { code: true, symbol: true } } },
    })
    audit({ userId: req.user.sub, action: 'CREATE', entityType: 'RecurringObligation', entityId: obl.id, newValue: obl, ipAddress: req.ip ?? undefined })
    res.status(201).json({ success: true, data: obl })
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ success: false, error: err.errors[0]?.message ?? 'Validation error' }); return }
    console.error('[obligations] create:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const updateObligation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await prisma.recurringObligation.findUnique({ where: { id: req.params.id } })
    if (!existing) { res.status(404).json({ success: false, error: 'Obligation not found' }); return }

    const data = CreateObligationSchema.partial().extend({ isActive: z.boolean().optional() }).parse(req.body)
    const obl = await prisma.recurringObligation.update({
      where: { id: req.params.id },
      data: { ...data, nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : undefined },
      include: { currency: { select: { code: true, symbol: true } } },
    })
    audit({ userId: req.user.sub, action: 'UPDATE', entityType: 'RecurringObligation', entityId: obl.id, oldValue: existing, newValue: obl, ipAddress: req.ip ?? undefined })
    res.json({ success: true, data: obl })
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ success: false, error: err.errors[0]?.message ?? 'Validation error' }); return }
    console.error('[obligations] update:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const recordPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const obl = await prisma.recurringObligation.findUnique({ where: { id: req.params.id } })
    if (!obl) { res.status(404).json({ success: false, error: 'Obligation not found' }); return }

    const data = RecordPaymentSchema.parse(req.body)

    const payment = await prisma.obligationPayment.create({
      data: {
        obligationId: obl.id,
        amount:       data.amount,
        currencyId:   data.currencyId,
        exchangeRate: data.exchangeRate,
        amountBase:   data.amountBase,
        paidDate:     new Date(data.paidDate),
        paymentMethod: data.paymentMethod,
        reference:    data.reference,
        notes:        data.notes,
        status:       TxStatus.PENDING_APPROVAL,
        createdById:  req.user.sub,
      },
    })

    audit({ userId: req.user.sub, action: 'CREATE', entityType: 'ObligationPayment', entityId: payment.id, newValue: payment, ipAddress: req.ip ?? undefined })
    res.status(201).json({ success: true, data: payment })
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ success: false, error: err.errors[0]?.message ?? 'Validation error' }); return }
    console.error('[obligations] recordPayment:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const approvePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payment = await prisma.obligationPayment.findUnique({
      where: { id: req.params.paymentId },
      include: { obligation: true },
    })
    if (!payment) { res.status(404).json({ success: false, error: 'Payment not found' }); return }
    if (payment.createdById === req.user.sub) {
      res.status(403).json({ success: false, error: 'Separation of duties: you cannot approve your own payment' }); return
    }
    if (payment.status !== TxStatus.PENDING_APPROVAL) {
      res.status(400).json({ success: false, error: 'Payment is not pending approval' }); return
    }

    const [updated] = await prisma.$transaction([
      prisma.obligationPayment.update({
        where: { id: payment.id },
        data: { status: TxStatus.APPROVED, approvedById: req.user.sub, approvedAt: new Date() },
      }),
      prisma.recurringObligation.update({
        where: { id: payment.obligationId },
        data: {
          lastPaidDate: payment.paidDate,
          nextDueDate: payment.obligation.frequency !== 'ONCE'
            ? nextDueAfter(payment.obligation.nextDueDate, payment.obligation.frequency)
            : payment.obligation.nextDueDate,
        },
      }),
    ])

    audit({ userId: req.user.sub, action: 'APPROVE', entityType: 'ObligationPayment', entityId: payment.id, ipAddress: req.ip ?? undefined })
    res.json({ success: true, data: updated })
  } catch (err) {
    console.error('[obligations] approvePayment:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const getObligationSummary = async (_req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date()
    const in30  = new Date(); in30.setDate(in30.getDate() + 30)

    const [total, overdue, dueSoon, active] = await Promise.all([
      prisma.recurringObligation.count({ where: { isActive: true } }),
      prisma.recurringObligation.count({ where: { isActive: true, nextDueDate: { lt: today } } }),
      prisma.recurringObligation.count({ where: { isActive: true, nextDueDate: { gte: today, lte: in30 } } }),
      prisma.recurringObligation.findMany({
        where: { isActive: true },
        orderBy: { nextDueDate: 'asc' },
        take: 10,
        include: { currency: { select: { code: true, symbol: true } } },
      }),
    ])

    res.json({ success: true, data: { total, overdue, dueSoon, upcoming: active } })
  } catch (err) {
    console.error('[obligations] summary:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
