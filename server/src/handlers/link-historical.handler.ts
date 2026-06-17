import { PrismaClient } from '@prisma/client'

export async function linkHistoricalHandler(): Promise<{
  success: boolean
  result?: { linked: number; unmatched: number; alreadyLinked: number }
  error?: string
}> {
  const db = new PrismaClient()
  try {
    const students = await db.student.findMany()
    const nameMap = new Map<string, string>() // lower-case full name → student.id
    for (const s of students) {
      const full = `${s.firstName} ${s.lastName}`.toLowerCase()
      nameMap.set(full, s.id)
    }

    const receipts = await db.feeReceipt.findMany({
      where: { studentRef: null },
      select: { id: true, studentName: true },
    })

    let linked = 0, unmatched = 0, alreadyLinked = 0

    for (const r of receipts) {
      const key = r.studentName.toLowerCase()
      const studentId = nameMap.get(key)
      if (!studentId) {
        unmatched++
        continue
      }
      await db.feeReceipt.update({
        where: { id: r.id },
        data: { studentRef: studentId },
      })
      linked++
    }

    alreadyLinked = (await db.feeReceipt.count({ where: { studentRef: { not: null } } }))

    return { success: true, result: { linked, unmatched, alreadyLinked } }
  } catch (err: unknown) {
    const e = err as { message?: string }
    return { success: false, error: e.message ?? 'Unknown error' }
  } finally {
    await db.$disconnect()
  }
}
