import { PrismaClient, PaymentMethod, TxStatus } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

interface FeeReceiptRecord {
  studentName: string
  amount: number
  date: string
  academicYear: string
  paymentMethod: string
}

interface ExpenseRecord {
  category: string
  description: string
  amount: number
  date: string
  academicYear: string
  paymentMethod: string
}

interface HistoricalData {
  feeReceipts: FeeReceiptRecord[]
  expenses: ExpenseRecord[]
}

export async function importHistoricalHandler(): Promise<{
  success: boolean
  result?: { receipts: number; expenses: number; skipped: number }
  error?: string
}> {
  const db = new PrismaClient()
  try {
    // In Lambda, LAMBDA_TASK_ROOT points to /var/task where the image is unpacked.
    // Locally (prisma/ scripts), __dirname resolves to the handler directory.
    const dataPath = path.join(
      process.env.LAMBDA_TASK_ROOT ?? path.join(__dirname, '../../..'),
      'prisma',
      'historical-data.json',
    )

    if (!fs.existsSync(dataPath)) {
      return { success: false, error: `historical-data.json not found at ${dataPath}` }
    }

    const raw = fs.readFileSync(dataPath, 'utf-8')
    const data: HistoricalData = JSON.parse(raw)

    const baseCurrency = await db.currency.findFirst({ where: { isBaseCurrency: true } })
    if (!baseCurrency) return { success: false, error: 'No base currency. Run seed first.' }

    const tuitionCat = await db.feeCategory.findFirst({ where: { name: 'Tuition' } })
    if (!tuitionCat) return { success: false, error: 'Tuition fee category not found. Run seed first.' }

    const expenseCats = await db.expenseCategory.findMany()
    const catMap = new Map(expenseCats.map((c) => [c.name, c.id]))

    const financeManager = await db.user.findFirst({ where: { role: 'FINANCE_MANAGER' } })
    const principal = await db.user.findFirst({ where: { role: 'PRINCIPAL' } })
    if (!financeManager || !principal) {
      return { success: false, error: 'Finance Manager and Principal users required. Run seed first.' }
    }

    let receipts = 0, expenses = 0, skipped = 0

    // Fee receipts
    for (const r of data.feeReceipts) {
      const payDate = new Date(r.date)
      const tag = `${r.studentName.slice(0, 8).replace(/\s/g, '')}-${payDate.getFullYear()}${String(payDate.getMonth() + 1).padStart(2, '0')}`
      const receiptNumber = `HIST-${tag}-${r.amount}`
      const exists = await db.feeReceipt.findFirst({ where: { receiptNumber } })
      if (exists) { skipped++; continue }
      await db.feeReceipt.create({
        data: {
          receiptNumber,
          studentName: r.studentName,
          amount: r.amount,
          currencyId: baseCurrency.id,
          exchangeRate: 1,
          amountBase: r.amount,
          paymentDate: payDate,
          paymentMethod: r.paymentMethod as PaymentMethod,
          categoryId: tuitionCat.id,
          notes: `Historical import — ${r.academicYear}`,
          status: TxStatus.APPROVED,
          createdById: financeManager.id,
          approvedById: principal.id,
          approvedAt: payDate,
        },
      })
      receipts++
    }

    // Expenses
    for (const e of data.expenses) {
      const catId = catMap.get(e.category)
      if (!catId) { skipped++; continue }

      const expDate = new Date(e.date)
      const expenseNumber = `HIST-EXP-${e.category.slice(0, 6).replace(/\s/g, '')}-${expDate.getFullYear()}${String(expDate.getMonth() + 1).padStart(2, '0')}-${e.amount}`
      const exists = await db.expense.findFirst({ where: { expenseNumber } })
      if (exists) { skipped++; continue }

      await db.expense.create({
        data: {
          expenseNumber,
          categoryId: catId,
          description: e.description,
          amount: e.amount,
          currencyId: baseCurrency.id,
          exchangeRate: 1,
          amountBase: e.amount,
          expenseDate: expDate,
          paymentMethod: e.paymentMethod as PaymentMethod,
          notes: `Historical import — ${e.academicYear}`,
          status: TxStatus.APPROVED,
          createdById: financeManager.id,
          approvedById: principal.id,
          approvedAt: expDate,
        },
      })
      expenses++
    }

    return { success: true, result: { receipts, expenses, skipped } }
  } catch (err: unknown) {
    const e = err as { message?: string }
    return { success: false, error: e.message ?? 'Unknown error' }
  } finally {
    await db.$disconnect()
  }
}
