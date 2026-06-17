import { PrismaClient } from '@prisma/client'

// Director contributions extracted from both cashflow sheets
// Each entry is [director, YYYY-MM, amount]
const CONTRIBUTIONS: [string, string, number][] = [
  // Barbara
  ['Barbara', '2024-05', 2000],
  ['Barbara', '2024-06', 1000],
  ['Barbara', '2024-07', 1000],
  ['Barbara', '2024-08', 1000],
  ['Barbara', '2024-09',  300],
  ['Barbara', '2024-10', 3000],
  // Genny
  ['Genny', '2024-05', 3700],
  ['Genny', '2024-06',  600],
  ['Genny', '2024-09', 1000],
  ['Genny', '2024-10', 1000],
  // Isaac
  ['Isaac', '2024-05',  7147],
  ['Isaac', '2024-06',  5950],
  ['Isaac', '2024-08', 25000],
  ['Isaac', '2024-09',  1600],
  ['Isaac', '2024-10',  5800],
  ['Isaac', '2024-12',  3600],
  ['Isaac', '2025-07',  3500],
  // Regina
  ['Regina', '2024-05', 3000],
  ['Regina', '2024-06', 2000],
  ['Regina', '2024-09', 1000],
  ['Regina', '2024-10', 2500],
  ['Regina', '2024-12', 1000],
]

export async function importDirectorContributionsHandler(): Promise<{
  success: boolean
  result?: { created: number; skipped: number }
  error?: string
}> {
  const db = new PrismaClient()
  try {
    const finance = await db.user.findUniqueOrThrow({ where: { email: 'finance@school.edu' } })
    const ghs     = await db.currency.findUniqueOrThrow({ where: { code: 'GHS' } })

    let created = 0
    let skipped = 0

    for (const [director, month, amount] of CONTRIBUTIONS) {
      const loanNumber = `DIR-${month.replace('-', '')}-${director.toUpperCase()}`
      const loanDate   = new Date(`${month}-01T00:00:00.000Z`)

      const existing = await db.loan.findUnique({ where: { loanNumber } })
      if (existing) {
        skipped++
        continue
      }

      await db.loan.create({
        data: {
          loanNumber,
          loanType:    'BORROWED',
          partyName:   director,
          purpose:     'Director contribution',
          principal:   amount,
          currencyId:  ghs.id,
          loanDate,
          status:      'ACTIVE',
          createdById: finance.id,
        },
      })
      created++
    }

    return { success: true, result: { created, skipped } }
  } catch (err) {
    console.error('[importDirectorContributions]', err)
    return { success: false, error: String(err) }
  } finally {
    await db.$disconnect()
  }
}
