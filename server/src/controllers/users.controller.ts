import { Response } from 'express'
import { Role } from '@prisma/client'
import { prisma } from '../services/prisma.service'
import { hashPassword } from '../services/auth.service'
import { audit } from '../services/audit.service'
import { AuthRequest, paginate } from '../types'
import { CreateUserSchema, UpdateUserSchema } from '../schemas/auth.schemas'

// Fields returned for every user — never expose passwordHash
const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const

// GET /users
export const listUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt((req.query['limit'] as string) ?? '20', 10) || 20))

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        select: USER_SELECT,
        orderBy: { createdAt: 'desc' },
        ...paginate(page, limit),
      }),
      prisma.user.count(),
    ])

    res.json({
      success: true,
      data: users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch users', details: err })
  }
}

// POST /users
export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = CreateUserSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      })
      return
    }

    const { email, name, password, role } = parsed.data

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      res.status(409).json({ success: false, error: 'A user with that email already exists' })
      return
    }

    const passwordHash = await hashPassword(password)

    const user = await prisma.user.create({
      data: { email, name, passwordHash, role },
      select: USER_SELECT,
    })

    audit({
      userId: req.user.sub,
      action: 'CREATE',
      entityType: 'User',
      entityId: user.id,
      newValue: { email: user.email, name: user.name, role: user.role },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    })

    res.status(201).json({ success: true, data: user })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create user', details: err })
  }
}

// PUT /users/:id
export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string }

    const parsed = UpdateUserSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      })
      return
    }

    const { name, email, role } = parsed.data

    const existing = await prisma.user.findUnique({ where: { id }, select: USER_SELECT })
    if (!existing) {
      res.status(404).json({ success: false, error: 'User not found' })
      return
    }

    // If changing email, check it is not taken by another user
    if (email && email !== existing.email) {
      const taken = await prisma.user.findUnique({ where: { email } })
      if (taken) {
        res.status(409).json({ success: false, error: 'That email address is already in use' })
        return
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(role !== undefined && { role }),
      },
      select: USER_SELECT,
    })

    audit({
      userId: req.user.sub,
      action: 'UPDATE',
      entityType: 'User',
      entityId: id,
      oldValue: { name: existing.name, email: existing.email, role: existing.role },
      newValue: { name: updated.name, email: updated.email, role: updated.role },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    })

    res.json({ success: true, data: updated })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update user', details: err })
  }
}

// PATCH /users/:id/status
export const toggleUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string }

    // Cannot toggle your own account
    if (req.user.sub === id) {
      res.status(400).json({ success: false, error: 'You cannot change the status of your own account' })
      return
    }

    const target = await prisma.user.findUnique({ where: { id }, select: USER_SELECT })
    if (!target) {
      res.status(404).json({ success: false, error: 'User not found' })
      return
    }

    // Guard: cannot deactivate the last active SUPER_ADMIN
    if (target.isActive && target.role === Role.SUPER_ADMIN) {
      const activeSuperAdminCount = await prisma.user.count({
        where: { role: Role.SUPER_ADMIN, isActive: true },
      })
      if (activeSuperAdminCount <= 1) {
        res.status(400).json({
          success: false,
          error: 'Cannot deactivate the last active SUPER_ADMIN',
        })
        return
      }
    }

    const newIsActive = !target.isActive
    const action = newIsActive ? 'ACTIVATE' : 'DEACTIVATE'

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: newIsActive },
      select: USER_SELECT,
    })

    audit({
      userId: req.user.sub,
      action,
      entityType: 'User',
      entityId: id,
      oldValue: { isActive: target.isActive },
      newValue: { isActive: newIsActive },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    })

    res.json({ success: true, data: updated })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to toggle user status', details: err })
  }
}
