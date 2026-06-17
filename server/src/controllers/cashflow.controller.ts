import { Response } from 'express'
import { prisma } from '../services/prisma.service'
import { AuthRequest } from '../types'

// ─── School year definitions ───────────────────────────────────────────────────

const SCHOOL_YEARS: Record<string, string[]> = {
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

function currentSchoolYear(): string {
  const now = new Date()
  const m = now.getMonth() + 1
  const y = now.getFullYear()
  return m >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

function toMonthStr(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function zeroTotals(months: string[]): Record<string, number> {
  return Object.fromEntries(months.map((m) => [m, 0]))
}

// ─── getCashFlowSummary ────────────────────────────────────────────────────────

export const getCashFlowSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const year = (req.query['year'] as string | undefined) ?? currentSchoolYear()
    const months = SCHOOL_YEARS[year]
    if (!months || months.length === 0) {
      res.status(400).json({
        success: false,
        error: `Invalid year. Valid: ${Object.keys(SCHOOL_YEARS).join(', ')}`,
      })
      return
    }

    const firstMonth = months[0]!
    const lastMonth  = months[months.length - 1]!
    const yearStart  = new Date(`${firstMonth}-01T00:00:00.000Z`)
    const yearEnd    = new Date(`${lastMonth}-01T00:00:00.000Z`)
    yearEnd.setUTCMonth(yearEnd.getUTCMonth() + 1)

    // ── Fetch all data in parallel ───────────────────────────────────────────
    const [feeReceipts, loans, loanRepayments, expenses, expenseCategories] = await Promise.all([
      // Approved fee receipts with category name
      prisma.feeReceipt.findMany({
        where: { status: 'APPROVED', paymentDate: { gte: yearStart, lt: yearEnd } },
        select: {
          amountBase: true,
          paymentDate: true,
          category: { select: { name: true } },
        },
      }),

      // All BORROWED loans (director contributions) — the loan record = money received
      prisma.loan.findMany({
        where: { loanType: 'BORROWED', loanDate: { gte: yearStart, lt: yearEnd } },
        select: { partyName: true, principal: true, loanDate: true },
      }),

      // Approved repayments on BORROWED loans (cash going back OUT to directors)
      prisma.loanPayment.findMany({
        where: {
          status: 'APPROVED',
          paymentDate: { gte: yearStart, lt: yearEnd },
          loan: { loanType: 'BORROWED' },
        },
        select: {
          amountBase: true,
          paymentDate: true,
          loan: { select: { partyName: true } },
        },
      }),

      // Approved expenses
      prisma.expense.findMany({
        where: { status: 'APPROVED', expenseDate: { gte: yearStart, lt: yearEnd } },
        select: { categoryId: true, amountBase: true, expenseDate: true },
      }),

      // All active expense categories (for hierarchy)
      prisma.expenseCategory.findMany({
        where: { isActive: true },
        select: { id: true, name: true, parentId: true },
        orderBy: { name: 'asc' },
      }),
    ])

    // ── CASH IN: Fees by category ────────────────────────────────────────────
    const feeCatTotals = new Map<string, Record<string, number>>() // catName → month → total

    for (const r of feeReceipts) {
      const catName = r.category?.name ?? 'Other'
      const month   = toMonthStr(r.paymentDate)
      if (!feeCatTotals.has(catName)) feeCatTotals.set(catName, zeroTotals(months))
      feeCatTotals.get(catName)![month] = (feeCatTotals.get(catName)![month] ?? 0) + Number(r.amountBase)
    }

    const feeRows = Array.from(feeCatTotals.entries()).map(([name, totals]) => ({
      name,
      totals,
      rowTotal: Object.values(totals).reduce((a, b) => a + b, 0),
    }))

    // ── CASH IN: Director contributions ─────────────────────────────────────
    const directorTotals = new Map<string, Record<string, number>>() // partyName → month → total

    for (const loan of loans) {
      const month = toMonthStr(loan.loanDate)
      const name  = loan.partyName
      if (!directorTotals.has(name)) directorTotals.set(name, zeroTotals(months))
      directorTotals.get(name)![month] = (directorTotals.get(name)![month] ?? 0) + Number(loan.principal)
    }

    const directorRows = Array.from(directorTotals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, totals]) => ({
        name,
        totals,
        rowTotal: Object.values(totals).reduce((a, b) => a + b, 0),
      }))

    // Cash In month totals
    const cashInByMonth: Record<string, number> = zeroTotals(months)
    for (const row of [...feeRows, ...directorRows]) {
      for (const m of months) cashInByMonth[m] = (cashInByMonth[m] ?? 0) + (row.totals[m] ?? 0)
    }
    const cashInTotal = Object.values(cashInByMonth).reduce((a, b) => a + b, 0)

    // ── CASH OUT: Loan repayments to directors ───────────────────────────────
    const repayTotals = new Map<string, Record<string, number>>() // partyName → month → total
    for (const p of loanRepayments) {
      const month = toMonthStr(p.paymentDate)
      const name  = p.loan.partyName
      if (!repayTotals.has(name)) repayTotals.set(name, zeroTotals(months))
      repayTotals.get(name)![month] = (repayTotals.get(name)![month] ?? 0) + Number(p.amountBase)
    }
    const repaymentRows = Array.from(repayTotals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, totals]) => ({
        name,
        totals,
        rowTotal: Object.values(totals).reduce((a, b) => a + b, 0),
      }))

    // ── CASH OUT: Expenses by category hierarchy ─────────────────────────────
    const rawExpTotals = new Map<string, Map<string, number>>() // catId → month → total
    for (const e of expenses) {
      const month = toMonthStr(e.expenseDate)
      if (!rawExpTotals.has(e.categoryId)) rawExpTotals.set(e.categoryId, new Map())
      const m = rawExpTotals.get(e.categoryId)!
      m.set(month, (m.get(month) ?? 0) + Number(e.amountBase))
    }

    const childrenOf = new Map<string, typeof expenseCategories>()
    for (const c of expenseCategories) {
      if (c.parentId) {
        if (!childrenOf.has(c.parentId)) childrenOf.set(c.parentId, [])
        childrenOf.get(c.parentId)!.push(c)
      }
    }

    const monthList = months
    function computeExpTotals(catId: string): Record<string, number> {
      const direct = rawExpTotals.get(catId) ?? new Map<string, number>()
      const result: Record<string, number> = {}
      for (const m of monthList) result[m] = direct.get(m) ?? 0
      for (const child of childrenOf.get(catId) ?? []) {
        const ct = computeExpTotals(child.id)
        for (const m of monthList) result[m] = (result[m] ?? 0) + (ct[m] ?? 0)
      }
      return result
    }

    interface ExpRow { id: string; name: string; parentId: string | null; level: number; totals: Record<string, number>; rowTotal: number }
    const expRows: ExpRow[] = []
    for (const parent of expenseCategories.filter((c) => !c.parentId)) {
      const pt = computeExpTotals(parent.id)
      expRows.push({ id: parent.id, name: parent.name, parentId: null, level: 0, totals: pt, rowTotal: Object.values(pt).reduce((a, b) => a + b, 0) })
      for (const child of childrenOf.get(parent.id) ?? []) {
        const ct = computeExpTotals(child.id)
        expRows.push({ id: child.id, name: child.name, parentId: child.parentId, level: 1, totals: ct, rowTotal: Object.values(ct).reduce((a, b) => a + b, 0) })
      }
    }

    const cashOutByMonth: Record<string, number> = zeroTotals(months)
    for (const row of expRows.filter((r) => r.level === 0)) {
      for (const m of months) cashOutByMonth[m] = (cashOutByMonth[m] ?? 0) + (row.totals[m] ?? 0)
    }
    for (const row of repaymentRows) {
      for (const m of months) cashOutByMonth[m] = (cashOutByMonth[m] ?? 0) + (row.totals[m] ?? 0)
    }
    const cashOutTotal = Object.values(cashOutByMonth).reduce((a, b) => a + b, 0)

    // ── Net & Running Balance ────────────────────────────────────────────────
    const netByMonth: Record<string, number> = zeroTotals(months)
    for (const m of months) netByMonth[m] = (cashInByMonth[m] ?? 0) - (cashOutByMonth[m] ?? 0)

    const runningBalance: Record<string, number> = {}
    let cumulative = 0
    for (const m of months) {
      cumulative += netByMonth[m] ?? 0
      runningBalance[m] = cumulative
    }

    res.json({
      success: true,
      data: {
        year,
        months,
        cashIn: { feeRows, directorRows, byMonth: cashInByMonth, total: cashInTotal },
        cashOut: { rows: expRows, repaymentRows, byMonth: cashOutByMonth, total: cashOutTotal },
        net: { byMonth: netByMonth, total: cashInTotal - cashOutTotal },
        runningBalance,
      },
    })
  } catch (err) {
    console.error('[getCashFlowSummary]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch cash flow summary' })
  }
}
