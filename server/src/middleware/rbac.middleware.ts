import { Request, Response, NextFunction } from 'express'
import { Role } from '@prisma/client'
import { AuthRequest } from '../types'

export const requireRole = (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest
    if (!roles.includes(authReq.user.role)) {
      res.status(403).json({ success: false, error: `Access denied. Required role: ${roles.join(' or ')}` })
      return
    }
    next()
  }

export const requireNotCreator = (getCreatorId: (req: AuthRequest) => string | undefined) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest
    const creatorId = getCreatorId(authReq)
    if (creatorId && creatorId === authReq.user.sub) {
      res.status(403).json({ success: false, error: 'Separation of duties: you cannot approve your own entry' })
      return
    }
    next()
  }
