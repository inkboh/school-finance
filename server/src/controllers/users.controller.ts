import { Response } from 'express'
import { Role } from '@prisma/client'
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminEnableUserCommand,
  AdminDisableUserCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider'
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

let cognitoClient: CognitoIdentityProviderClient | null = null

function getCognito(): { client: CognitoIdentityProviderClient; poolId: string } | null {
  const poolId = process.env.COGNITO_USER_POOL_ID
  if (!poolId) return null
  if (!cognitoClient) {
    cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION ?? 'us-east-1' })
  }
  return { client: cognitoClient, poolId }
}

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

    let cognitoStatuses: Record<string, string> = {}
    const cog = getCognito()
    if (cog) {
      try {
        const result = await cog.client.send(new ListUsersCommand({ UserPoolId: cog.poolId }))
        cognitoStatuses = Object.fromEntries(
          (result.Users ?? []).map(u => [u.Username ?? '', u.UserStatus ?? 'UNKNOWN'])
        )
      } catch (err) {
        console.error('[users.listUsers] Cognito status fetch failed:', err)
      }
    }

    const enriched = users.map(u => ({ ...u, cognitoStatus: cognitoStatuses[u.email] ?? null }))

    res.json({
      success: true,
      data: enriched,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
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
        details: parsed.error!.errors.map((e) => ({ field: e.path.join('.'), message: e.message ?? '' })),
      })
      return
    }

    const { email, name, password, role } = parsed.data
    const cog = getCognito()

    if (!cog && !password) {
      res.status(400).json({ success: false, error: 'Password is required' })
      return
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      res.status(409).json({ success: false, error: 'A user with that email already exists' })
      return
    }

    // Create in Cognito first — sends invite email to the user
    if (cog) {
      try {
        await cog.client.send(new AdminCreateUserCommand({
          UserPoolId: cog.poolId,
          Username: email,
          UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'name', Value: name },
            { Name: 'custom:role', Value: String(role) },
          ],
          DesiredDeliveryMediums: ['EMAIL'],
        }))
      } catch (err: unknown) {
        const e = err as { name?: string }
        if (e.name !== 'UsernameExistsException') {
          console.error('[users.createUser] Cognito error:', err)
          res.status(500).json({ success: false, error: 'Failed to create user in Cognito' })
          return
        }
        // Username already exists in Cognito — still create/sync the DB record
      }
    }

    const passwordHash = (password !== undefined) ? await hashPassword(password) : '[cognito]'

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
        details: parsed.error!.errors.map((e) => ({ field: e.path.join('.'), message: e.message ?? '' })),
      })
      return
    }

    const { name, email, role } = parsed.data

    const existing = await prisma.user.findUnique({ where: { id }, select: USER_SELECT })
    if (!existing) {
      res.status(404).json({ success: false, error: 'User not found' })
      return
    }

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

    // Best-effort Cognito sync — DB update already succeeded
    const cog = getCognito()
    if (cog) {
      const attrs = []
      if (name !== undefined) attrs.push({ Name: 'name', Value: name })
      if (role !== undefined) attrs.push({ Name: 'custom:role', Value: role })
      if (email !== undefined && email !== existing.email) attrs.push({ Name: 'email', Value: email })
      if (attrs.length > 0) {
        cog.client.send(new AdminUpdateUserAttributesCommand({
          UserPoolId: cog.poolId,
          Username: existing.email,
          UserAttributes: attrs,
        })).catch((err: unknown) => console.error('[users.updateUser] Cognito sync failed:', err))
      }
    }

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

    if (req.user.sub === id) {
      res.status(400).json({ success: false, error: 'You cannot change the status of your own account' })
      return
    }

    const target = await prisma.user.findUnique({ where: { id }, select: USER_SELECT })
    if (!target) {
      res.status(404).json({ success: false, error: 'User not found' })
      return
    }

    if (target.isActive && target.role === Role.SUPER_ADMIN) {
      const activeSuperAdminCount = await prisma.user.count({
        where: { role: Role.SUPER_ADMIN, isActive: true },
      })
      if (activeSuperAdminCount <= 1) {
        res.status(400).json({ success: false, error: 'Cannot deactivate the last active SUPER_ADMIN' })
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

    // Best-effort Cognito sync
    const cog = getCognito()
    if (cog) {
      const Command = newIsActive ? AdminEnableUserCommand : AdminDisableUserCommand
      cog.client.send(new Command({ UserPoolId: cog.poolId, Username: target.email }))
        .catch((err: unknown) => console.error('[users.toggleUserStatus] Cognito sync failed:', err))
    }

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
