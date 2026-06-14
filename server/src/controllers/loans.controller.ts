import { Response } from 'express'
import { prisma } from '../services/prisma.service'
import { audit } from '../services/audit.service'
import { nextLoanNumber, nextPaymentNumber } from '../services/sequence.service'
import { AuthRequest, paginate } from '../types'
import { CreateLoanSchema, UpdateLoanStatusSchema, CreateLoanPaymentSchema, LoanListQuerySchema } from '../schemas/loans.schemas'

// ─── listLoans ────────────────────────────────────────────────────────────────

export const listLoans = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const query = LoanListQuerySchema.safeParse(req.query)
    if (!query.success) {
      res.status(400).json({ success: false, error: 'Invalid query parameters', details: query.error.errors })
      return
    }

    const { page: pageStr, limit: limitStr, loanType, status } = query.data
    const page = pageStr ? parseInt(pageStr, 10) : 1
    const limit = limitStr ? parseInt(limitStr, 10) : 20

    const where = {
      ...(loanType ? { loanType } : {}),
      ...(status ? { status } : {}),
    }

    const [loans, total] = await Promise.all([
      prisma.loan.findMany({
        where,
        include: {
          currency: { select: { code: true, symbol: true } },
          createdBy: { select: { name: true } },
          payments: {
            select: {
              id: true,
              amount: true,
              status: true,
              paymentDate: true,
              amountBase: true,
            },
          },
        },
        orderBy: { loanDate: 'desc' },
        ...paginate(page, limit),
      }),
      prisma.loan.count({ where }),
    ])

    const data = loans.map((loan) => {
      // totalPaid: sum of APPROVED payment amountBase values (already in base currency)
      const totalPaid = loan.payments
        .filter((p) => p.status === 'APPROVED')
        .reduce((sum, p) => sum + Number(p.amountBase), 0)

      // outstanding: principal (in loan currency) minus total paid (in base currency).
      // The Loan model does not carry an exchangeRate field, so principal is kept in
      // loan-currency units here. Callers pair this with currency.code/symbol for display.
      const outstanding = Number(loan.principal) - totalPaid

      return {
        ...loan,
        totalPaid,
        outstanding,
      }
    })

    res.json({
      success: true,
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    console.error('[listLoans]', err)
    res.status(500).json({ success: false, error: 'Failed to list loans' })
  }
}

// ─── createLoan ───────────────────────────────────────────────────────────────

export const createLoan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = CreateLoanSchema.safeParse(req.body)
    if (!body.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: body.error.errors })
      return
    }

    const loanNumber = await nextLoanNumber()

    const loan = await prisma.loan.create({
      data: {
        loanNumber,
        loanType: body.data.loanType,
        partyName: body.data.partyName,
        partyContact: body.data.partyContact,
        purpose: body.data.purpose,
        principal: body.data.principal,
        currencyId: body.data.currencyId,
        interestRate: body.data.interestRate,
        loanDate: new Date(body.data.loanDate),
        dueDate: body.data.dueDate ? new Date(body.data.dueDate) : undefined,
        notes: body.data.notes,
        createdById: req.user.sub,
      },
      include: {
        currency: { select: { code: true, symbol: true } },
        createdBy: { select: { name: true } },
      },
    })

    audit({
      userId: req.user.sub,
      action: 'CREATE',
      entityType: 'Loan',
      entityId: loan.id,
      newValue: loan,
    })

    res.status(201).json({ success: true, data: loan })
  } catch (err) {
    console.error('[createLoan]', err)
    res.status(500).json({ success: false, error: 'Failed to create loan' })
  }
}

// ─── getLoan ──────────────────────────────────────────────────────────────────

export const getLoan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const loan = await prisma.loan.findUnique({
      where: { id },
      include: {
        currency: { select: { code: true, symbol: true } },
        createdBy: { select: { name: true } },
        payments: {
          include: {
            currency: { select: { code: true, symbol: true } },
            createdBy: { select: { name: true } },
            approvedBy: { select: { name: true } },
          },
          orderBy: { paymentDate: 'desc' },
        },
      },
    })

    if (!loan) {
      res.status(404).json({ success: false, error: 'Loan not found' })
      return
    }

    // totalPaid: sum of APPROVED payment amountBase values (already in base currency)
    const totalPaid = loan.payments
      .filter((p) => p.status === 'APPROVED')
      .reduce((sum, p) => sum + Number(p.amountBase), 0)

    // principalBase: the Loan model has no exchangeRate field, so we surface principal
    // in loan-currency units. Callers use currency.code/symbol for context.
    const principalBase = Number(loan.principal)
    const outstanding = principalBase - totalPaid

    res.json({
      success: true,
      data: {
        ...loan,
        principalBase,
        totalPaid,
        outstanding,
      },
    })
  } catch (err) {
    console.error('[getLoan]', err)
    res.status(500).json({ success: false, error: 'Failed to retrieve loan' })
  }
}

// ─── updateLoanStatus ─────────────────────────────────────────────────────────

export const updateLoanStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const body = UpdateLoanStatusSchema.safeParse(req.body)
    if (!body.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: body.error.errors })
      return
    }

    const existing = await prisma.loan.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ success: false, error: 'Loan not found' })
      return
    }

    const updated = await prisma.loan.update({
      where: { id },
      data: {
        status: body.data.status,
        ...(body.data.notes !== undefined ? { notes: body.data.notes } : {}),
      },
      include: {
        currency: { select: { code: true, symbol: true } },
        createdBy: { select: { name: true } },
      },
    })

    audit({
      userId: req.user.sub,
      action: 'UPDATE',
      entityType: 'Loan',
      entityId: id,
      oldValue: { status: existing.status, notes: existing.notes },
      newValue: { status: updated.status, notes: updated.notes },
    })

    res.json({ success: true, data: updated })
  } catch (err) {
    console.error('[updateLoanStatus]', err)
    res.status(500).json({ success: false, error: 'Failed to update loan status' })
  }
}

// ─── createPayment ────────────────────────────────────────────────────────────

export const createPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const loan = await prisma.loan.findUnique({ where: { id } })
    if (!loan) {
      res.status(404).json({ success: false, error: 'Loan not found' })
      return
    }

    const body = CreateLoanPaymentSchema.safeParse(req.body)
    if (!body.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: body.error.errors })
      return
    }

    const paymentNumber = await nextPaymentNumber()
    const amountBase = Number(body.data.amount) * Number(body.data.exchangeRate)

    const payment = await prisma.loanPayment.create({
      data: {
        paymentNumber,
        loanId: id,
        amount: body.data.amount,
        currencyId: body.data.currencyId,
        exchangeRate: body.data.exchangeRate,
        amountBase,
        paymentDate: new Date(body.data.paymentDate),
        paymentMethod: body.data.paymentMethod,
        reference: body.data.reference,
        notes: body.data.notes,
        status: 'PENDING_APPROVAL',
        createdById: req.user.sub,
      },
      include: {
        currency: { select: { code: true, symbol: true } },
        createdBy: { select: { name: true } },
      },
    })

    audit({
      userId: req.user.sub,
      action: 'CREATE',
      entityType: 'LoanPayment',
      entityId: payment.id,
      newValue: payment,
    })

    res.status(201).json({ success: true, data: payment })
  } catch (err) {
    console.error('[createPayment]', err)
    res.status(500).json({ success: false, error: 'Failed to create loan payment' })
  }
}

// ─── approvePayment ───────────────────────────────────────────────────────────

export const approvePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, paymentId } = req.params

    const payment = await prisma.loanPayment.findUnique({
      where: { id: paymentId },
    })

    if (!payment) {
      res.status(404).json({ success: false, error: 'Payment not found' })
      return
    }

    if (payment.loanId !== id) {
      res.status(404).json({ success: false, error: 'Payment does not belong to this loan' })
      return
    }

    // Separation of duties: approver cannot be the creator
    if (payment.createdById === req.user.sub) {
      res.status(403).json({
        success: false,
        error: 'Separation of duties: you cannot approve your own payment',
      })
      return
    }

    if (payment.status !== 'PENDING_APPROVAL') {
      res.status(409).json({
        success: false,
        error: `Payment is already ${payment.status.toLowerCase().replace('_', ' ')}`,
      })
      return
    }

    const approved = await prisma.loanPayment.update({
      where: { id: paymentId },
      data: {
        status: 'APPROVED',
        approvedById: req.user.sub,
        approvedAt: new Date(),
      },
      include: {
        currency: { select: { code: true, symbol: true } },
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
      },
    })

    audit({
      userId: req.user.sub,
      action: 'APPROVE',
      entityType: 'LoanPayment',
      entityId: paymentId,
      oldValue: { status: payment.status },
      newValue: { status: approved.status, approvedAt: approved.approvedAt },
    })

    res.json({ success: true, data: approved })
  } catch (err) {
    console.error('[approvePayment]', err)
    res.status(500).json({ success: false, error: 'Failed to approve payment' })
  }
}
