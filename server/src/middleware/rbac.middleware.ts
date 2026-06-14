import { Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { AuthRequest } from '../types';

export const requireRole = (...roles: Role[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `Access denied. Required role: ${roles.join(' or ')}`,
      });
      return;
    }
    next();
  };

// Enforces separation of duties: the approver cannot be the creator
export const requireNotCreator = (getCreatorId: (req: AuthRequest) => string | undefined) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    const creatorId = getCreatorId(req);
    if (creatorId && creatorId === req.user.sub) {
      res.status(403).json({
        success: false,
        error: 'Separation of duties: you cannot approve your own entry',
      });
      return;
    }
    next();
  };
