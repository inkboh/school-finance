import { Request, Response } from 'express'
import { prisma } from '../services/prisma.service'
import { audit } from '../services/audit.service'
import { nextReceiptNumber } from '../services/sequence.service'
import { AuthRequest, paginate } from '../types'
import { CreateFeeReceiptSchema, RejectSchema, ListQuerySchema } from '../schemas/fees.schemas'
import { PaymentMethod, TxStatus } from '@prisma/client'

const RECEIPT_INCLUDE = {
  category: { select: { name: true } },
  currency: { select: { code: true, symbol: true } },
  createdBy: { select: { name: true } },
  approvedBy: { select: { name: true } },
} as const

export const listReceipts = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = ListQuerySchema.parse(req.query)

    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1)
    const limit = Math.max(1, parseInt(query.limit ?? '20', 10) || 20)
    const { skip, take } = paginate(page, limit)

    const where: Record<string, unknown> = {}

    if (query.status) {
      where.status = query.status as TxStatus
    }

    if (query.from || query.to) {
      where.paymentDate = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      }
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId
    }

    if (query.search) {
      const term = query.search
      where.OR = [
        { studentName: { contains: term, mode: 'insensitive' } },
        { receiptNumber: { contains: term, mode: 'insensitive' } },
        { reference: { contains: term, mode: 'insensitive' } },
      ]
    }

    const [total, receipts] = await Promise.all([
      prisma.feeReceipt.count({ where }),
      prisma.feeReceipt.findMany({
        where,
        include: RECEIPT_INCLUDE,
        orderBy: { paymentDate: 'desc' },
        skip,
        take,
      }),
    ])

    res.json({
      success: true,
      data: receipts,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err: unknown) {
    res.status(400).json({ success: false, error: 'Invalid query parameters', details: err })
  }
}

export const createReceipt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = CreateFeeReceiptSchema.parse(req.body)

    const receiptNumber = await nextReceiptNumber()
    const amountBase = Number(body.amount) * Number(body.exchangeRate)

    const receipt = await prisma.feeReceipt.create({
      data: {
        receiptNumber,
        studentName: body.studentName,
        studentId: body.studentId,
        grade: body.grade,
        categoryId: body.categoryId,
        amount: body.amount,
        currencyId: body.currencyId,
        exchangeRate: body.exchangeRate,
        amountBase,
        paymentDate: new Date(body.paymentDate),
        paymentMethod: body.paymentMethod as PaymentMethod,
        reference: body.reference,
        notes: body.notes,
        status: TxStatus.PENDING_APPROVAL,
        createdById: req.user.sub,
      },
      include: RECEIPT_INCLUDE,
    })

    audit({
      userId: req.user.sub,
      action: 'CREATE',
      entityType: 'FeeReceipt',
      entityId: receipt.id,
      newValue: { receiptNumber: receipt.receiptNumber, amount: receipt.amount, status: receipt.status },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    })

    res.status(201).json({ success: true, data: receipt })
  } catch (err: unknown) {
    res.status(400).json({ success: false, error: 'Failed to create receipt', details: err })
  }
}

export const getReceipt = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const receipt = await prisma.feeReceipt.findUnique({
      where: { id },
      include: RECEIPT_INCLUDE,
    })

    if (!receipt) {
      res.status(404).json({ success: false, error: 'Receipt not found' })
      return
    }

    res.json({ success: true, data: receipt })
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: 'Failed to fetch receipt', details: err })
  }
}

export const approveReceipt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const receipt = await prisma.feeReceipt.findUnique({ where: { id } })

    if (!receipt) {
      res.status(404).json({ success: false, error: 'Receipt not found' })
      return
    }

    if (receipt.createdById === req.user.sub) {
      res.status(403).json({ success: false, error: 'You cannot approve a receipt you created' })
      return
    }

    if (receipt.status !== TxStatus.PENDING_APPROVAL) {
      res.status(400).json({
        success: false,
        error: `Receipt is already ${receipt.status.toLowerCase().replace('_', ' ')}`,
      })
      return
    }

    const updated = await prisma.feeReceipt.update({
      where: { id },
      data: {
        status: TxStatus.APPROVED,
        approvedById: req.user.sub,
        approvedAt: new Date(),
      },
      include: RECEIPT_INCLUDE,
    })

    audit({
      userId: req.user.sub,
      action: 'APPROVE',
      entityType: 'FeeReceipt',
      entityId: id,
      newValue: { status: TxStatus.APPROVED, approvedById: req.user.sub, approvedAt: updated.approvedAt },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    })

    res.json({ success: true, data: updated })
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: 'Failed to approve receipt', details: err })
  }
}

export const rejectReceipt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const body = RejectSchema.parse(req.body)

    const receipt = await prisma.feeReceipt.findUnique({ where: { id } })

    if (!receipt) {
      res.status(404).json({ success: false, error: 'Receipt not found' })
      return
    }

    if (receipt.createdById === req.user.sub) {
      res.status(403).json({ success: false, error: 'You cannot reject a receipt you created' })
      return
    }

    if (receipt.status !== TxStatus.PENDING_APPROVAL) {
      res.status(400).json({
        success: false,
        error: `Receipt is already ${receipt.status.toLowerCase().replace('_', ' ')}`,
      })
      return
    }

    const updated = await prisma.feeReceipt.update({
      where: { id },
      data: {
        status: TxStatus.REJECTED,
        rejectedReason: body.reason,
      },
      include: RECEIPT_INCLUDE,
    })

    audit({
      userId: req.user.sub,
      action: 'REJECT',
      entityType: 'FeeReceipt',
      entityId: id,
      newValue: { status: TxStatus.REJECTED, rejectedReason: body.reason },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    })

    res.json({ success: true, data: updated })
  } catch (err: unknown) {
    res.status(400).json({ success: false, error: 'Failed to reject receipt', details: err })
  }
}
