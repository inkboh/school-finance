import { Response } from 'express'
import { prisma } from '../services/prisma.service'
import { AuthRequest, paginate } from '../types'

export const listAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      page: pageStr,
      limit: limitStr,
      entityType,
      action,
      userId,
      from,
      to,
    } = req.query as Record<string, string | undefined>

    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1)
    const limit = Math.max(1, parseInt(limitStr ?? '50', 10) || 50)

    const where: Record<string, unknown> = {}

    if (entityType) where.entityType = entityType
    if (action) where.action = action
    if (userId) where.userId = userId

    if (from || to) {
      const createdAt: Record<string, Date> = {}
      if (from) createdAt.gte = new Date(from)
      if (to) createdAt.lte = new Date(to)
      where.createdAt = createdAt
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        ...paginate(page, limit),
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { name: true, email: true },
          },
        },
      }),
    ])

    res.json({
      success: true,
      data: logs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    console.error('[audit] listAuditLogs error:', err)
    res.status(500).json({ success: false, error: 'Failed to retrieve audit logs' })
  }
}
