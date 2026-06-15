import { PrismaClient } from '@prisma/client'

// Payment values: null = absent/not enrolled, 0 = enrolled but did not pay, >0 = amount paid
// We only create receipts for payments > 0.
type MonthlyPayment = number | null

// 2024–2025 school year: columns = Jan–Aug 2025
const DATES_2425: Date[] = [
  new Date('2025-01-15'), new Date('2025-02-15'), new Date('2025-03-15'),
  new Date('2025-04-15'), new Date('2025-05-15'), new Date('2025-06-15'),
  new Date('2025-07-15'), new Date('2025-08-15'),
]

const DATA_2425: [string, MonthlyPayment[]][] = [
  ['Tua Atuahene Poku Obrempong',        [400,400,400,400,400,400,400,400]],
  ['Jantuah Asare Michael',               [400,400,400,400,400,400,400,400]],
  ['Nana Akosua Nti Afriyie',             [400,400,400,400,400,400,400,null]],
  ['Ackah Esi Zoya',                      [400,400,400,400,400,400,400,400]],
  ['Katakyie Adubofuor Barima',           [400,400,400,400,400,400,400,400]],
  ['Agyemang Ohemaa Gyamfua',             [null,null,null,null,null,null,400,400]],
  ['Kendra Nana Yaa Konadu',              [null,null,null,null,null,400,400,400]],
  ['Attah Mensah Nana Boateng',           [400,400,400,400,400,400,400,400]],
  ['Arthur Forson Jayla',                 [400,400,400,400,400,400,400,400]],
  ['Nyametease Annin Yeboah',             [300,300,300,300,300,300,300,300]],
  ['Nyamedome Annin Yeboah',              [300,300,300,300,300,300,300,300]],
  ['Devine Ryker',                        [400,400,400,400,400,400,400,400]],
  ['Frimpong Abena Serwaa',               [400,400,400,400,400,400,400,350]],
  ['Boakye Agyemang Spencer Nana Eshun',  [400,400,400,400,400,400,400,400]],
  ['Ayama Elizabeth',                     [400,400,400,400,250,0,0,null]],
  ['Antwi Bosiako Raphael',               [400,400,400,400,400,400,400,400]],
  ['Apenten Kofi Elisha',                 [null,400,400,400,400,400,400,400]],
  ['Anim Yeboah Beatrice',                [null,400,400,null,null,400,400,200]],
  ['Oppong Fosu Eric',                    [null,null,null,null,400,400,400,null]],
]

// 2025–2026 school year: columns = Sep 2025–Feb 2026
// (Mar–Jul are all 'A' / future — omitted)
const DATES_2526: Date[] = [
  new Date('2025-09-15'), new Date('2025-10-15'), new Date('2025-11-15'),
  new Date('2025-12-15'), new Date('2026-01-15'), new Date('2026-02-15'),
]

const DATA_2526: [string, MonthlyPayment[]][] = [
  ['Tua Atuahene Poku Obrempong',        [400,400,  0,400,400,400]],
  ['Jantuah Asare Michael',               [400,400,400,400,400,400]],
  ['Ackah Esi Zoya',                      [400,400,400,400,400,400]],
  ['Katakyie Adubofuor Barima',           [400,400,400,400,400,400]],
  ['Agyemang Ohemaa Gyamfua',             [400,400,400,400,400,400]],
  ['Attah Mensah Nana Boateng',           [400,400,400,  0,400,400]],
  ['Arthur Forson Jayla',                 [400,400,400,400,400,400]],
  ['Nyametease Annin Yeboah',             [300,300,300,300,300,300]],
  ['Nyamedome Annin Yeboah',              [300,300,300,300,300,300]],
  ['Devine Ryker',                        [400,400,400,400,400,400]],
  ['Frimpong Abena Serwaa',               [400,100,  0,  0,  0,  0]],
  ['Boakye Agyemang Spencer Nana Eshun',  [400,400,400,400,400,400]],
  ['Ayama Elizabeth',                     [null,null,200,  0,  0,  0]],
  ['Antwi Bosiako Raphael',               [400,400,400,400,400,400]],
  ['Apenten Kofi Elisha',                 [400,400,400,400,400,400]],
  ['Anim Yeboah Beatrice',                [400,400,400,  0,  0,null]],
  ['Oppong Fosu Eric',                    [null,null,350,  0,  0,  0]],
  ['Benjamin Kweku',                      [null,400,400,400,400,400]],
  ['Samuel Asare',                        [null,400,400,400,400,400]],
  ['Sharif Mujaheed',                     [null,400,400,400,400,400]],
  ['Lilibeth',                            [null,null,400,400,400,400]],
  ['Annin Yeboah',                        [null,null,300,300,300,300]],
  ['Mark Marshall',                       [null,null,null,null,null,  0]],
  ['Jayden kekeli Kpodo',                 [null,null,null,null,null,400]],
  ['Kiara manu',                          [null,null,null,null,null,400]],
  ['Carysel Kwarteng',                    [null,null,null,null,400,400]],
  ['Ciara',                               [null,null,null,null,null,  0]],
  ['Boatemaa',                            [null,null,null,null,null,400]],
  ['Liana',                               [null,null,null,null,400,400]],
]

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/)
  const first = parts[0] ?? full.trim()
  if (parts.length <= 1) return { firstName: first, lastName: first }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] ?? first }
}

export async function importDataHandler(): Promise<{
  success: boolean
  result?: { students: number; receipts: number }
  error?: string
}> {
  const db = new PrismaClient()
  try {
    const cashier = await db.user.findUniqueOrThrow({ where: { email: 'cashier@school.edu' } })
    const finance  = await db.user.findUniqueOrThrow({ where: { email: 'finance@school.edu' } })
    const ghs      = await db.currency.findUniqueOrThrow({ where: { code: 'GHS' } })
    const tuition  = await db.feeCategory.findUniqueOrThrow({ where: { name: 'Tuition' } })

    const names2425 = new Set(DATA_2425.map(([n]) => n))
    const names2526 = new Set(DATA_2526.map(([n]) => n))
    const allNames  = [...new Set([...names2425, ...names2526])]

    // Create students
    const studentMap = new Map<string, string>() // name → db Student.id
    let idx = 1
    for (const name of allNames) {
      const { firstName, lastName } = splitName(name)
      const inBoth     = names2425.has(name) && names2526.has(name)
      const only2526   = !names2425.has(name) && names2526.has(name)
      const enrollYear = only2526 ? '2026' : '2025'
      const studentId  = `RA-${enrollYear}-${String(idx++).padStart(4, '0')}`
      const status     = (inBoth || only2526) ? 'ACTIVE' : 'WITHDRAWN'
      const enrollmentDate = only2526 ? new Date('2025-09-01') : new Date('2025-01-01')

      const s = await db.student.upsert({
        where: { studentId },
        update: {},
        create: { studentId, firstName, lastName, grade: 'Unknown', status: status as 'ACTIVE' | 'WITHDRAWN', enrollmentDate },
      })
      studentMap.set(name, s.id)
    }

    // Create fee receipts
    let receiptIdx = 1
    let receipts   = 0

    async function createReceipt(name: string, amount: number, date: Date, term: string) {
      const receiptNumber = `HIST-${term.replace('/', '')}-${String(receiptIdx++).padStart(4, '0')}`
      await db.feeReceipt.upsert({
        where: { receiptNumber },
        update: {},
        create: {
          receiptNumber,
          studentName:   name,
          studentRef:    studentMap.get(name),
          categoryId:    tuition.id,
          amount,
          currencyId:    ghs.id,
          exchangeRate:  1,
          amountBase:    amount,
          paymentDate:   date,
          paymentMethod: 'CASH',
          status:        'APPROVED',
          createdById:   cashier.id,
          approvedById:  finance.id,
          approvedAt:    date,
          termId:        term,
          notes:         'Historical import from cashflow spreadsheet',
        },
      })
      receipts++
    }

    for (const [name, pmts] of DATA_2425) {
      for (const [i, amt] of pmts.entries()) {
        const date = DATES_2425[i]
        if (amt !== null && amt > 0 && date !== undefined) {
          await createReceipt(name, amt, date, '2024/2025')
        }
      }
    }
    for (const [name, pmts] of DATA_2526) {
      for (const [i, amt] of pmts.entries()) {
        const date = DATES_2526[i]
        if (amt !== null && amt > 0 && date !== undefined) {
          await createReceipt(name, amt, date, '2025/2026')
        }
      }
    }

    return { success: true, result: { students: allNames.length, receipts } }
  } catch (err: unknown) {
    const e = err as { message?: string }
    return { success: false, error: e.message ?? 'Unknown error' }
  } finally {
    await db.$disconnect()
  }
}
