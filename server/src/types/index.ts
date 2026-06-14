import { Role } from '@prisma/client';
import { Request } from 'express';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: Role;
  name: string;
}

export interface AuthRequest extends Request {
  user: JwtPayload;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export interface DateRangeQuery {
  from?: string;
  to?: string;
}

export type ApiResponse<T = unknown> = {
  success: true;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
} | {
  success: false;
  error: string;
  details?: unknown;
};

export const paginate = (page = 1, limit = 20) => ({
  skip: (page - 1) * limit,
  take: limit,
});
