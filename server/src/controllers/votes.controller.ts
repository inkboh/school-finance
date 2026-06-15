import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../services/prisma.service'

const VALID_ENTITY_TYPES = ['Project', 'Obligation', 'Document'] as const

const CastVoteSchema = z.object({
  entityType: z.enum(VALID_ENTITY_TYPES),
  entityId:   z.string().min(1),
  vote:       z.enum(['FOR', 'AGAINST', 'ABSTAIN']),
  comment:    z.string().optional(),
})

export async function getVotes(req: Request, res: Response): Promise<void> {
  const { entityType, entityId } = req.query as { entityType?: string; entityId?: string }

  if (!entityType || !entityId) {
    res.status(400).json({ success: false, error: 'entityType and entityId are required' })
    return
  }

  if (!VALID_ENTITY_TYPES.includes(entityType as (typeof VALID_ENTITY_TYPES)[number])) {
    res.status(400).json({ success: false, error: 'Invalid entityType' })
    return
  }

  const votes = await prisma.directorVote.findMany({
    where: { entityType, entityId },
    include: { voter: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  })

  res.json({ success: true, data: votes })
}

export async function castVote(req: Request, res: Response): Promise<void> {
  const parsed = CastVoteSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Invalid request', details: parsed.error.flatten() })
    return
  }

  const { entityType, entityId, vote, comment } = parsed.data
  const voterId = (req as Request & { userId?: string }).userId!

  const result = await prisma.directorVote.upsert({
    where:  { voterId_entityType_entityId: { voterId, entityType, entityId } },
    update: { vote, comment: comment ?? null },
    create: { voterId, entityType, entityId, vote, comment },
    include: { voter: { select: { id: true, name: true, role: true } } },
  })

  res.json({ success: true, data: result })
}

export async function deleteVote(req: Request, res: Response): Promise<void> {
  const { entityType, entityId } = req.query as { entityType?: string; entityId?: string }

  if (!entityType || !entityId) {
    res.status(400).json({ success: false, error: 'entityType and entityId are required' })
    return
  }

  const voterId = (req as Request & { userId?: string }).userId!

  const existing = await prisma.directorVote.findUnique({
    where: { voterId_entityType_entityId: { voterId, entityType, entityId } },
  })

  if (!existing) {
    res.status(404).json({ success: false, error: 'Vote not found' })
    return
  }

  await prisma.directorVote.delete({
    where: { voterId_entityType_entityId: { voterId, entityType, entityId } },
  })

  res.json({ success: true, data: null })
}
