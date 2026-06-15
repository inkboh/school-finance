import { Request, Response } from 'express'
import { prisma } from '../services/prisma.service'
import { audit } from '../services/audit.service'
import { AuthRequest, paginate } from '../types'
import { z } from 'zod'
import { StudentStatus } from '@prisma/client'

const CreateStudentSchema = z.object({
  firstName:     z.string().min(1),
  lastName:      z.string().min(1),
  grade:         z.string().min(1),
  section:       z.string().optional(),
  dateOfBirth:   z.string().optional(),
  enrollmentDate: z.string().optional(),
  parentName:    z.string().optional(),
  parentPhone:   z.string().optional(),
  parentEmail:   z.string().email().optional().or(z.literal('')),
  parentAddress: z.string().optional(),
  notes:         z.string().optional(),
})

const UpdateStudentSchema = CreateStudentSchema.partial().extend({
  status: z.nativeEnum(StudentStatus).optional(),
})

async function nextStudentId(): Promise<string> {
  const year = new Date().getFullYear()
  const last = await prisma.student.findFirst({
    where: { studentId: { startsWith: `RA-${year}-` } },
    orderBy: { studentId: 'desc' },
    select: { studentId: true },
  })
  const seq = last ? parseInt(last.studentId.split('-')[2] ?? '0', 10) + 1 : 1
  return `RA-${year}-${String(seq).padStart(4, '0')}`
}

export const listStudents = async (req: Request, res: Response): Promise<void> => {
  try {
    const page  = Math.max(1, parseInt(req.query.page as string ?? '1', 10) || 1)
    const limit = Math.max(1, parseInt(req.query.limit as string ?? '25', 10) || 25)
    const { skip, take } = paginate(page, limit)

    const where: Record<string, unknown> = {}
    if (req.query.status) where.status = req.query.status as StudentStatus
    if (req.query.grade)  where.grade  = req.query.grade as string
    if (req.query.search) {
      const term = req.query.search as string
      where.OR = [
        { firstName:  { contains: term, mode: 'insensitive' } },
        { lastName:   { contains: term, mode: 'insensitive' } },
        { studentId:  { contains: term, mode: 'insensitive' } },
        { parentName: { contains: term, mode: 'insensitive' } },
        { parentPhone:{ contains: term, mode: 'insensitive' } },
      ]
    }

    const [total, students] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where, skip, take,
        orderBy: [{ grade: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
      }),
    ])

    res.json({
      success: true,
      data: students,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('[students] listStudents:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const getStudent = async (req: Request, res: Response): Promise<void> => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: {
        feeReceipts: {
          orderBy: { paymentDate: 'desc' },
          take: 20,
          include: { currency: { select: { code: true, symbol: true } }, category: { select: { name: true } } },
        },
      },
    })
    if (!student) { res.status(404).json({ success: false, error: 'Student not found' }); return }
    res.json({ success: true, data: student })
  } catch (err) {
    console.error('[students] getStudent:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const createStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = CreateStudentSchema.parse(req.body)
    const studentId = await nextStudentId()

    const student = await prisma.student.create({
      data: {
        studentId,
        firstName:      data.firstName,
        lastName:       data.lastName,
        grade:          data.grade,
        section:        data.section,
        dateOfBirth:    data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        enrollmentDate: data.enrollmentDate ? new Date(data.enrollmentDate) : new Date(),
        parentName:     data.parentName,
        parentPhone:    data.parentPhone,
        parentEmail:    data.parentEmail || undefined,
        parentAddress:  data.parentAddress,
        notes:          data.notes,
      },
    })

    audit({ userId: req.user.sub, action: 'CREATE', entityType: 'Student', entityId: student.id, newValue: student, ipAddress: req.ip ?? undefined })
    res.status(201).json({ success: true, data: student })
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ success: false, error: err.errors[0]?.message ?? 'Validation error' }); return }
    console.error('[students] createStudent:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const updateStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await prisma.student.findUnique({ where: { id: req.params.id } })
    if (!existing) { res.status(404).json({ success: false, error: 'Student not found' }); return }

    const data = UpdateStudentSchema.parse(req.body)
    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: {
        ...data,
        dateOfBirth:    data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        enrollmentDate: data.enrollmentDate ? new Date(data.enrollmentDate) : undefined,
        parentEmail:    data.parentEmail || undefined,
      },
    })

    audit({ userId: req.user.sub, action: 'UPDATE', entityType: 'Student', entityId: student.id, oldValue: existing, newValue: student, ipAddress: req.ip ?? undefined })
    res.json({ success: true, data: student })
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ success: false, error: err.errors[0]?.message ?? 'Validation error' }); return }
    console.error('[students] updateStudent:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const getStudentStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [total, active, graduated, withdrawn] = await Promise.all([
      prisma.student.count(),
      prisma.student.count({ where: { status: 'ACTIVE' } }),
      prisma.student.count({ where: { status: 'GRADUATED' } }),
      prisma.student.count({ where: { status: 'WITHDRAWN' } }),
    ])

    const byGrade = await prisma.student.groupBy({
      by: ['grade'],
      where: { status: 'ACTIVE' },
      _count: { id: true },
      orderBy: { grade: 'asc' },
    })

    res.json({ success: true, data: { total, active, graduated, withdrawn, byGrade } })
  } catch (err) {
    console.error('[students] getStudentStats:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
