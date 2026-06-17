import { PrismaClient } from '@prisma/client'

// Isaac personally paid Dad GHS 25,000 on behalf of the school in April 2025.
// The school now owes Isaac that amount — record it as a BORROWED loan.
export async function addIsaacReimbursementHandler(): Promise<{
  success: boolean
  result?: { created: string }
  error?: string
}> {
  const db = new PrismaClient()
  try {
    const finance = await db.user.findUniqueOrThrow({ where: { email: 'finance@school.edu' } })
    const ghs     = await db.currency.findUniqueOrThrow({ where: { code: 'GHS' } })

    const loan = await db.loan.upsert({
      where: { loanNumber: 'DIR-202504-ISAAC-REIMB' },
      update: {},
      create: {
        loanNumber:  'DIR-202504-ISAAC-REIMB',
        loanType:    'BORROWED',
        partyName:   'Isaac',
        purpose:     'Reimbursement — paid Dad on behalf of school',
        principal:   25000,
        currencyId:  ghs.id,
        loanDate:    new Date('2025-04-15T00:00:00.000Z'),
        status:      'ACTIVE',
        createdById: finance.id,
      },
    })

    return {
      success: true,
      result: { created: `Loan ${loan.loanNumber}: school owes Isaac ₵25,000` },
    }
  } catch (err) {
    console.error('[addIsaacReimbursement]', err)
    return { success: false, error: String(err) }
  } finally {
    await db.$disconnect()
  }
}
