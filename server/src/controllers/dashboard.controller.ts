import { Response } from 'express';
import { prisma } from '../services/prisma.service';
import { AuthRequest } from '../types';

// ─── getSummary ───────────────────────────────────────────────────────────────

export const getSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // ── All-time income & expenses ────────────────────────────────────────────
    const [incomeAgg, expenseAgg] = await Promise.all([
      prisma.feeReceipt.aggregate({
        _sum: { amountBase: true },
        where: { status: 'APPROVED' },
      }),
      prisma.expense.aggregate({
        _sum: { amountBase: true },
        where: { status: 'APPROVED' },
      }),
    ]);

    const totalIncome = Number(incomeAgg._sum.amountBase ?? 0);
    const totalExpenses = Number(expenseAgg._sum.amountBase ?? 0);
    const netBalance = totalIncome - totalExpenses;

    // ── Pending approval counts ───────────────────────────────────────────────
    const [pendingReceipts, pendingExpenses, pendingLoanPayments] = await Promise.all([
      prisma.feeReceipt.count({ where: { status: 'PENDING_APPROVAL' } }),
      prisma.expense.count({ where: { status: 'PENDING_APPROVAL' } }),
      prisma.loanPayment.count({ where: { status: 'PENDING_APPROVAL' } }),
    ]);

    // ── Current month ─────────────────────────────────────────────────────────
    const [monthIncomeAgg, monthExpenseAgg] = await Promise.all([
      prisma.feeReceipt.aggregate({
        _sum: { amountBase: true },
        where: {
          status: 'APPROVED',
          paymentDate: { gte: monthStart, lt: monthEnd },
        },
      }),
      prisma.expense.aggregate({
        _sum: { amountBase: true },
        where: {
          status: 'APPROVED',
          expenseDate: { gte: monthStart, lt: monthEnd },
        },
      }),
    ]);

    const monthIncome = Number(monthIncomeAgg._sum.amountBase ?? 0);
    const monthExpenses = Number(monthExpenseAgg._sum.amountBase ?? 0);

    // ── Loans ─────────────────────────────────────────────────────────────────
    // Fetch all loans with currency info so we can compute principalBase in JS.
    // For each loan we use its currency's latest exchange rate; if the currency
    // is the base currency we treat the rate as 1.
    const [borrowedLoans, lentLoans] = await Promise.all([
      prisma.loan.findMany({
        where: { loanType: 'BORROWED' },
        select: {
          id: true,
          principal: true,
          currency: {
            select: {
              isBaseCurrency: true,
              exchangeRates: {
                orderBy: { effectiveDate: 'desc' },
                take: 1,
                select: { rate: true },
              },
            },
          },
          payments: {
            where: { status: 'APPROVED' },
            select: { amountBase: true },
          },
        },
      }),
      prisma.loan.findMany({
        where: { loanType: 'LENT' },
        select: {
          id: true,
          principal: true,
          currency: {
            select: {
              isBaseCurrency: true,
              exchangeRates: {
                orderBy: { effectiveDate: 'desc' },
                take: 1,
                select: { rate: true },
              },
            },
          },
          payments: {
            where: { status: 'APPROVED' },
            select: { amountBase: true },
          },
        },
      }),
    ]);

    const loanPrincipalBase = (loans: typeof borrowedLoans): number =>
      loans.reduce((sum, loan) => {
        const rate = loan.currency.isBaseCurrency
          ? 1
          : Number(loan.currency.exchangeRates[0]?.rate ?? 1);
        return sum + Number(loan.principal) * rate;
      }, 0);

    const loanPaymentsBase = (loans: typeof borrowedLoans): number =>
      loans.reduce((sum, loan) => {
        const paid = loan.payments.reduce((s, p) => s + Number(p.amountBase), 0);
        return sum + paid;
      }, 0);

    const totalBorrowed = loanPrincipalBase(borrowedLoans);
    const totalLent = loanPrincipalBase(lentLoans);
    const paidBorrowed = loanPaymentsBase(borrowedLoans);
    const paidLent = loanPaymentsBase(lentLoans);

    res.json({
      success: true,
      data: {
        totalIncome,
        totalExpenses,
        netBalance,
        pendingApprovals: {
          receipts: pendingReceipts,
          expenses: pendingExpenses,
          loanPayments: pendingLoanPayments,
        },
        currentMonth: {
          income: monthIncome,
          expenses: monthExpenses,
          net: monthIncome - monthExpenses,
        },
        loans: {
          totalBorrowed,
          totalLent,
          outstandingBorrowed: totalBorrowed - paidBorrowed,
          outstandingLent: totalLent - paidLent,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load summary', details: err });
  }
};

// ─── getCashFlow ──────────────────────────────────────────────────────────────

export const getCashFlow = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    // Start of the calendar month 11 months ago (so we cover 12 months total
    // including the current month).
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [receipts, expenses] = await Promise.all([
      prisma.feeReceipt.findMany({
        where: {
          status: 'APPROVED',
          paymentDate: { gte: rangeStart },
        },
        select: { paymentDate: true, amountBase: true },
      }),
      prisma.expense.findMany({
        where: {
          status: 'APPROVED',
          expenseDate: { gte: rangeStart },
        },
        select: { expenseDate: true, amountBase: true },
      }),
    ]);

    // Build a map keyed by "YYYY-MM" for the 12 months window.
    const months: Record<string, { month: string; income: number; expenses: number }> = {};

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[key] = { month: key, income: 0, expenses: 0 };
    }

    for (const r of receipts) {
      const d = new Date(r.paymentDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (months[key]) {
        months[key].income += Number(r.amountBase);
      }
    }

    for (const e of expenses) {
      const d = new Date(e.expenseDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (months[key]) {
        months[key].expenses += Number(e.amountBase);
      }
    }

    res.json({
      success: true,
      data: Object.values(months),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load cash flow', details: err });
  }
};

// ─── getRecentActivity ────────────────────────────────────────────────────────

export const getRecentActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [receipts, expenses, loanPayments] = await Promise.all([
      prisma.feeReceipt.findMany({
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          receiptNumber: true,
          studentName: true,
          amountBase: true,
          status: true,
          paymentDate: true,
          createdAt: true,
          currency: { select: { code: true } },
          createdBy: { select: { name: true } },
        },
      }),
      prisma.expense.findMany({
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          expenseNumber: true,
          description: true,
          amountBase: true,
          status: true,
          expenseDate: true,
          createdAt: true,
          currency: { select: { code: true } },
          createdBy: { select: { name: true } },
        },
      }),
      prisma.loanPayment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          paymentNumber: true,
          amountBase: true,
          status: true,
          paymentDate: true,
          createdAt: true,
          currency: { select: { code: true } },
          createdBy: { select: { name: true } },
          loan: { select: { partyName: true, loanType: true } },
        },
      }),
    ]);

    type ActivityItem = {
      type: 'receipt' | 'expense' | 'loanPayment';
      number: string;
      description: string;
      amountBase: number;
      currencyCode: string;
      status: string;
      date: Date;
      createdByName: string;
    };

    const items: ActivityItem[] = [
      ...receipts.map((r) => ({
        type: 'receipt' as const,
        number: r.receiptNumber,
        description: r.studentName,
        amountBase: Number(r.amountBase),
        currencyCode: r.currency.code,
        status: r.status,
        date: r.paymentDate,
        createdByName: r.createdBy.name,
      })),
      ...expenses.map((e) => ({
        type: 'expense' as const,
        number: e.expenseNumber,
        description: e.description,
        amountBase: Number(e.amountBase),
        currencyCode: e.currency.code,
        status: e.status,
        date: e.expenseDate,
        createdByName: e.createdBy.name,
      })),
      ...loanPayments.map((p) => ({
        type: 'loanPayment' as const,
        number: p.paymentNumber,
        description: `${p.loan.loanType === 'BORROWED' ? 'Repayment to' : 'Receipt from'} ${p.loan.partyName}`,
        amountBase: Number(p.amountBase),
        currencyCode: p.currency.code,
        status: p.status,
        date: p.paymentDate,
        createdByName: p.createdBy.name,
      })),
    ];

    items.sort((a, b) => b.date.getTime() - a.date.getTime());

    res.json({
      success: true,
      data: items.slice(0, 15),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load recent activity', details: err });
  }
};
