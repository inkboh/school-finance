import { PrismaClient } from '@prisma/client'

// The Aug-2024 loan was Dad's contribution (not Isaac's).
// Rename partyName to "Dad" so he appears as a separate party in the loans view.
export async function fixDadLoanHandler(): Promise<{
  success: boolean
  result?: { updated: string }
  error?: string
}> {
  const db = new PrismaClient()
  try {
    const loan = await db.loan.update({
      where: { loanNumber: 'DIR-202408-ISAAC' },
      data: { partyName: 'Dad' },
    })
    return {
      success: true,
      result: { updated: `Loan ${loan.loanNumber} partyName changed to "Dad"` },
    }
  } catch (err) {
    console.error('[fixDadLoan]', err)
    return { success: false, error: String(err) }
  } finally {
    await db.$disconnect()
  }
}
