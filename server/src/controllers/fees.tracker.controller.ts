import { Response } from 'express'
import { prisma } from '../services/prisma.service'
import { AuthRequest } from '../types'

type MonthStatus = 'PAID' | 'PENDING' | 'UNPAID' | 'NOT_ENROLLED' | 'UPCOMING'

interface MonthPayment {
  status: MonthStatus
  receiptId?: string
  receiptNumber?: string
  amount?: number
}

interface TrackerRow {
  studentDbId: string
  studentId: string
  firstName: string
  lastName: string
  grade: string
  studentStatus: string
  enrolledFrom: string
  payments: Record<string, MonthPayment>
}

interface MonthSummary {
  paid: number
  pending: number
  unpaid: number
  upcoming: number
  totalCollected: number
}

// Define school-year month sequences.
// 2024-2025 ran Jan–Aug 2025 based on imported spreadsheet data.
// 2025-2026 runs Sep 2025–Aug 2026.
const SCHOOL_YEARS: Record<string, { months: string[] }> = {
  '2024-2025': {
    months: [
      '2025-01', '2025-02', '2025-03', '2025-04',
      '2025-05', '2025-06', '2025-07', '2025-08',
    ],
  },
  '2025-2026': {
    months: [
      '2025-09', '2025-10', '2025-11', '2025-12',
      '2026-01', '2026-02', '2026-03', '2026-04',
      '2026-05', '2026-06', '2026-07', '2026-08',
    ],
  },
}

function toMonthStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function currentSchoolYear(): string {
  const now = new Date()
  const month = now.getMonth() + 1 // 1-12
  const year = now.getFullYear()
  // Sep–Dec → new academic year starts this calendar year
  return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`
}

export const getFeeTracker = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const year = (req.query['year'] as string | undefined) ?? currentSchoolYear()
    const yearDef = SCHOOL_YEARS[year]

    if (!yearDef) {
      res.status(400).json({
        success: false,
        error: `Invalid school year. Valid values: ${Object.keys(SCHOOL_YEARS).join(', ')}`,
      })
      return
    }

    const { months } = yearDef
    const firstMonth = months[0]
    const lastMonth = months[months.length - 1]

    if (!firstMonth || !lastMonth) {
      res.status(500).json({ success: false, error: 'School year configuration error' })
      return
    }

    const yearStart = new Date(`${firstMonth}-01T00:00:00.000Z`)
    const yearEnd = new Date(`${lastMonth}-01T00:00:00.000Z`)
    yearEnd.setUTCMonth(yearEnd.getUTCMonth() + 1)

    const currentMonthStr = toMonthStr(new Date())

    // All students, active first then alphabetical
    const students = await prisma.student.findMany({
      orderBy: [{ status: 'asc' }, { firstName: 'asc' }, { lastName: 'asc' }],
    })

    // All non-rejected receipts with a studentRef link for this year window
    const receipts = await prisma.feeReceipt.findMany({
      where: {
        studentRef: { not: null },
        paymentDate: { gte: yearStart, lt: yearEnd },
        status: { not: 'REJECTED' },
      },
      select: {
        id: true,
        receiptNumber: true,
        studentRef: true,
        amount: true,
        paymentDate: true,
        status: true,
      },
    })

    // Group: studentRef → month → most-authoritative receipt
    // APPROVED beats PENDING_APPROVAL for the same student+month
    type ReceiptRow = (typeof receipts)[number]
    const receiptMap = new Map<string, Map<string, ReceiptRow>>()
    for (const r of receipts) {
      if (!r.studentRef) continue
      const month = toMonthStr(r.paymentDate)
      if (!receiptMap.has(r.studentRef)) receiptMap.set(r.studentRef, new Map())
      const existing = receiptMap.get(r.studentRef)!.get(month)
      if (!existing || r.status === 'APPROVED') {
        receiptMap.get(r.studentRef)!.set(month, r)
      }
    }

    // Build per-student rows
    const rows: TrackerRow[] = students.map((student) => {
      const enrolledFrom = toMonthStr(student.enrollmentDate)
      const studentReceipts = receiptMap.get(student.id)
      const payments: Record<string, MonthPayment> = {}

      for (const month of months) {
        if (month < enrolledFrom) {
          payments[month] = { status: 'NOT_ENROLLED' }
        } else if (month > currentMonthStr) {
          payments[month] = { status: 'UPCOMING' }
        } else {
          const receipt = studentReceipts?.get(month)
          if (receipt) {
            payments[month] = {
              status: receipt.status === 'APPROVED' ? 'PAID' : 'PENDING',
              receiptId: receipt.id,
              receiptNumber: receipt.receiptNumber,
              amount: Number(receipt.amount),
            }
          } else {
            payments[month] = { status: 'UNPAID' }
          }
        }
      }

      return {
        studentDbId: student.id,
        studentId: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        grade: student.grade,
        studentStatus: student.status,
        enrolledFrom,
        payments,
      }
    })

    // Per-month summary (exclude WITHDRAWN students from unpaid count)
    const summary: Record<string, MonthSummary> = {}
    for (const month of months) {
      let paid = 0, pending = 0, unpaid = 0, upcoming = 0, totalCollected = 0
      for (const row of rows) {
        const p = row.payments[month]
        if (!p) continue
        if (p.status === 'PAID') {
          paid++
          totalCollected += p.amount ?? 0
        } else if (p.status === 'PENDING') {
          pending++
        } else if (p.status === 'UNPAID' && row.studentStatus !== 'WITHDRAWN') {
          unpaid++
        } else if (p.status === 'UPCOMING') {
          upcoming++
        }
      }
      summary[month] = { paid, pending, unpaid, upcoming, totalCollected }
    }

    res.json({
      success: true,
      data: {
        year,
        months,
        currentMonth: currentMonthStr,
        rows,
        summary,
      },
    })
  } catch (err: unknown) {
    console.error('[fees.tracker]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch fee tracker' })
  }
}
