import { Request, Response } from 'express'
import { prisma } from '../services/prisma.service'
import { audit } from '../services/audit.service'
import { AuthRequest, paginate } from '../types'
import { z } from 'zod'
import { ProjectStatus, FundingType, FundingStatus } from '@prisma/client'

const CreateProjectSchema = z.object({
  name:        z.string().min(1),
  description: z.string().optional(),
  scope:       z.string().optional(),
  status:      z.nativeEnum(ProjectStatus).default('PLANNING'),
  startDate:   z.string().optional(),
  endDate:     z.string().optional(),
  budget:      z.number().positive(),
  currencyId:  z.string().min(1),
  notes:       z.string().optional(),
})

const AddFundingSchema = z.object({
  source:     z.string().min(1),
  type:       z.nativeEnum(FundingType),
  amount:     z.number().positive(),
  currencyId: z.string().min(1),
  date:       z.string(),
  status:     z.nativeEnum(FundingStatus).default('PLEDGED'),
  notes:      z.string().optional(),
})

const PROJECT_INCLUDE = {
  currency:  { select: { code: true, symbol: true } },
  createdBy: { select: { name: true } },
  funding: {
    orderBy: { date: 'desc' as const },
    include: { currency: { select: { code: true, symbol: true } } },
  },
} as const

async function nextProjectNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const last = await prisma.project.findFirst({
    where: { projectNumber: { startsWith: `PRJ-${year}-` } },
    orderBy: { projectNumber: 'desc' },
    select: { projectNumber: true },
  })
  const seq = last ? parseInt(last.projectNumber.split('-')[2] ?? '0', 10) + 1 : 1
  return `PRJ-${year}-${String(seq).padStart(3, '0')}`
}

export const listProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const page  = Math.max(1, parseInt(req.query.page as string ?? '1', 10) || 1)
    const limit = Math.max(1, parseInt(req.query.limit as string ?? '20', 10) || 20)
    const { skip, take } = paginate(page, limit)

    const where: Record<string, unknown> = {}
    if (req.query.status) where.status = req.query.status as ProjectStatus
    if (req.query.search) {
      where.OR = [
        { name: { contains: req.query.search as string, mode: 'insensitive' } },
        { projectNumber: { contains: req.query.search as string, mode: 'insensitive' } },
      ]
    }

    const [total, projects] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: {
          currency: { select: { code: true, symbol: true } },
          createdBy: { select: { name: true } },
          funding: { select: { amount: true, status: true } },
        },
      }),
    ])

    res.json({
      success: true,
      data: projects,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('[projects] list:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const getProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: PROJECT_INCLUDE,
    })
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' }); return }
    res.json({ success: true, data: project })
  } catch (err) {
    console.error('[projects] get:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = CreateProjectSchema.parse(req.body)
    const projectNumber = await nextProjectNumber()

    const project = await prisma.project.create({
      data: {
        projectNumber,
        name:        data.name,
        description: data.description,
        scope:       data.scope,
        status:      data.status,
        startDate:   data.startDate ? new Date(data.startDate) : undefined,
        endDate:     data.endDate   ? new Date(data.endDate)   : undefined,
        budget:      data.budget,
        currencyId:  data.currencyId,
        notes:       data.notes,
        createdById: req.user.sub,
      },
      include: PROJECT_INCLUDE,
    })

    audit({ userId: req.user.sub, action: 'CREATE', entityType: 'Project', entityId: project.id, newValue: project, ipAddress: req.ip ?? undefined })
    res.status(201).json({ success: true, data: project })
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ success: false, error: err.errors[0]?.message ?? 'Validation error' }); return }
    console.error('[projects] create:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const updateProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await prisma.project.findUnique({ where: { id: req.params.id } })
    if (!existing) { res.status(404).json({ success: false, error: 'Project not found' }); return }

    const data = CreateProjectSchema.partial().parse(req.body)
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate:   data.endDate   ? new Date(data.endDate)   : undefined,
      },
      include: PROJECT_INCLUDE,
    })

    audit({ userId: req.user.sub, action: 'UPDATE', entityType: 'Project', entityId: project.id, oldValue: existing, newValue: project, ipAddress: req.ip ?? undefined })
    res.json({ success: true, data: project })
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ success: false, error: err.errors[0]?.message ?? 'Validation error' }); return }
    console.error('[projects] update:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const addFunding = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } })
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' }); return }

    const data = AddFundingSchema.parse(req.body)
    const funding = await prisma.projectFunding.create({
      data: {
        projectId:  project.id,
        source:     data.source,
        type:       data.type,
        amount:     data.amount,
        currencyId: data.currencyId,
        date:       new Date(data.date),
        status:     data.status,
        notes:      data.notes,
      },
      include: { currency: { select: { code: true, symbol: true } } },
    })

    audit({ userId: req.user.sub, action: 'CREATE', entityType: 'ProjectFunding', entityId: funding.id, newValue: funding, ipAddress: req.ip ?? undefined })
    res.status(201).json({ success: true, data: funding })
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ success: false, error: err.errors[0]?.message ?? 'Validation error' }); return }
    console.error('[projects] addFunding:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const updateFunding = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = AddFundingSchema.partial().parse(req.body)
    const funding = await prisma.projectFunding.update({
      where: { id: req.params.fundingId },
      data: { ...data, date: data.date ? new Date(data.date) : undefined },
      include: { currency: { select: { code: true, symbol: true } } },
    })
    audit({ userId: req.user.sub, action: 'UPDATE', entityType: 'ProjectFunding', entityId: funding.id, newValue: funding, ipAddress: req.ip ?? undefined })
    res.json({ success: true, data: funding })
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ success: false, error: err.errors[0]?.message ?? 'Validation error' }); return }
    console.error('[projects] updateFunding:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const deleteFunding = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.projectFunding.delete({ where: { id: req.params.fundingId } })
    audit({ userId: req.user.sub, action: 'DELETE', entityType: 'ProjectFunding', entityId: req.params.fundingId, ipAddress: req.ip ?? undefined })
    res.json({ success: true })
  } catch (err) {
    console.error('[projects] deleteFunding:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
