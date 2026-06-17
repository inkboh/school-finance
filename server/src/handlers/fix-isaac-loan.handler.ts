import { PrismaClient } from '@prisma/client'

export async function fixIsaacLoanHandler(): Promise<{
  success: boolean
  result?: { updated: string; paymentCreated: string }
  error?: string
}> {
  const db = new PrismaClient()
  try {
    const finance = await db.user.findUniqueOrThrow({ where: { email: 'finance@school.edu' } })
    const ghs     = await db.currency.findUniqueOrThrow({ where: { code: 'GHS' } })

    // Fix principal: 25000 → 50000
    const loan = await db.loan.update({
      where: { loanNumber: 'DIR-202408-ISAAC' },
      data: { principal: 50000 },
    })

    // Record the 25000 repayment in April 2025
    const payment = await db.loanPayment.upsert({
      where: { paymentNumber: 'DIRPAY-202504-ISAAC' },
      update: {},
      create: {
        paymentNumber: 'DIRPAY-202504-ISAAC',
        loanId:        loan.id,
        amount:        25000,
        currencyId:    ghs.id,
        exchangeRate:  1,
        amountBase:    25000,
        paymentDate:   new Date('2025-04-15T00:00:00.000Z'),
        paymentMethod: 'CASH',
        status:        'APPROVED',
        createdById:   finance.id,
      },
    })

    return {
      success: true,
      result: {
        updated:        `Loan ${loan.loanNumber} principal updated to ₵50,000`,
        paymentCreated: `Payment ${payment.paymentNumber} of ₵25,000 created for Apr 2025`,
      },
    }
  } catch (err) {
    console.error('[fixIsaacLoan]', err)
    return { success: false, error: String(err) }
  } finally {
    await db.$disconnect()
  }
}
