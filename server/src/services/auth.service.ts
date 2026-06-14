import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma.service';
import { JwtPayload } from '../types';
import { Role } from '@prisma/client';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev-secret-change-me';
const JWT_REFRESH_SECRET = process.env['JWT_REFRESH_SECRET'] ?? 'dev-refresh-secret';
const JWT_EXPIRES_IN = process.env['JWT_EXPIRES_IN'] ?? '15m';
const JWT_REFRESH_EXPIRES_IN = process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d';

export const hashPassword = (password: string) => bcrypt.hash(password, 12);

export const verifyPassword = (password: string, hash: string) =>
  bcrypt.compare(password, hash);

export const signAccessToken = (payload: JwtPayload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);

export const signRefreshToken = (payload: JwtPayload) =>
  jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions);

export const verifyAccessToken = (token: string): JwtPayload =>
  jwt.verify(token, JWT_SECRET) as JwtPayload;

export const verifyRefreshToken = (token: string): JwtPayload =>
  jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;

export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const storeRefreshToken = (userId: string, token: string) =>
  prisma.refreshToken.create({
    data: {
      userId,
      token,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

export const revokeRefreshToken = (token: string) =>
  prisma.refreshToken.deleteMany({ where: { token } });

export const revokeAllUserTokens = (userId: string) =>
  prisma.refreshToken.deleteMany({ where: { userId } });

// Roles that can approve transactions (but NOT their own)
export const APPROVER_ROLES: Role[] = ['FINANCE_MANAGER', 'PRINCIPAL'];

// Roles that can enter fee receipts
export const FEE_ENTRY_ROLES: Role[] = ['CASHIER', 'FINANCE_MANAGER'];

// Roles that can view financial data
export const VIEWER_ROLES: Role[] = ['SUPER_ADMIN', 'CASHIER', 'FINANCE_MANAGER', 'PRINCIPAL', 'AUDITOR'];
