/**
 * Imports historical cash flow data from historical-data.json into the database.
 * All records are pre-approved (historical — cannot run the approval workflow retroactively).
 *
 * Run: cd server && npm run db:import
 */

import { PrismaClient, PaymentMethod, TxStatus } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

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

async function main() {
  const dataPath = path.join(__dirname, 'historical-data.json')
  const raw = fs.readFileSync(dataPath, 'utf-8')
  const data: HistoricalData = JSON.parse(raw)

  // ── Resolve required IDs ────────────────────────────────────────────────────

  // Base currency (GHS should be set as base; fall back to whatever is base)
  const baseCurrency = await prisma.currency.findFirst({ where: { isBaseCurrency: true } })
  if (!baseCurrency) throw new Error('No base currency set. Run seed first and set a base currency in Settings.')

  // Fee category: Tuition
  const tuitionCat = await prisma.feeCategory.findFirst({ where: { name: 'Tuition' } })
  if (!tuitionCat) throw new Error('Tuition fee category not found. Run seed first.')

  // Expense categories — build a lookup map
  const expenseCats = await prisma.expenseCategory.findMany()
  const catMap = new Map(expenseCats.map(c => [c.name, c.id]))

  // Use Finance Manager as the creator and approver for historical records
  const financeManager = await prisma.user.findFirst({ where: { role: 'FINANCE_MANAGER' } })
  const principal = await prisma.user.findFirst({ where: { role: 'PRINCIPAL' } })
  if (!financeManager || !principal) throw new Error('Finance Manager and Principal users required. Run seed first.')

  console.log(`\nImporting into database...`)
  console.log(`  Base currency: ${baseCurrency.code} (${baseCurrency.symbol})`)
  console.log(`  Created by:    ${financeManager.name}`)
  console.log(`  Approved by:   ${principal.name}\n`)

  // ── Fee Receipts ────────────────────────────────────────────────────────────

  let receiptCount = 0
  let receiptSkipped = 0

  for (const r of data.feeReceipts) {
    const payDate = new Date(r.date)
    // Generate a deterministic receipt number so re-runs are idempotent
    const tag = `${r.studentName.slice(0, 8).replace(/\s/g, '')}-${payDate.getFullYear()}${(payDate.getMonth()+1).toString().padStart(2,'0')}`
    const receiptNumber = `HIST-${tag}-${r.amount}`

    const exists = await prisma.feeReceipt.findFirst({ where: { receiptNumber } })
    if (exists) { receiptSkipped++; continue }

    await prisma.feeReceipt.create({
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
    receiptCount++
  }

  console.log(`Fee receipts: ${receiptCount} imported, ${receiptSkipped} already exist`)

  // ── Expenses ────────────────────────────────────────────────────────────────

  let expenseCount = 0
  let expenseSkipped = 0
  const unmatchedCats = new Set<string>()

  for (const e of data.expenses) {
    const catId = catMap.get(e.category)
    if (!catId) {
      unmatchedCats.add(e.category)
      expenseSkipped++
      continue
    }

    const expDate = new Date(e.date)
    const expenseNumber = `HIST-EXP-${e.category.slice(0,6).replace(/\s/g,'')}-${expDate.getFullYear()}${(expDate.getMonth()+1).toString().padStart(2,'0')}-${e.amount}`

    const exists = await prisma.expense.findFirst({ where: { expenseNumber } })
    if (exists) { expenseSkipped++; continue }

    await prisma.expense.create({
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
    expenseCount++
  }

  console.log(`Expenses:     ${expenseCount} imported, ${expenseSkipped} already exist / unmatched`)

  if (unmatchedCats.size > 0) {
    console.log(`\nWarning — unmatched expense categories (add these in Settings to import them):`)
    unmatchedCats.forEach(c => console.log(`  - ${c}`))
  }

  console.log(`\nDone. Historical data is now in the database.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
