import { prisma } from './prisma.service';

interface AuditParams {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: object | null;
  newValue?: object | null;
  ipAddress?: string;
  userAgent?: string;
}

export const logAudit = (params: AuditParams) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma.auditLog.create({ data: params as any });

// Fire-and-forget audit log — never throws, never blocks response
export const audit = (params: AuditParams) => {
  logAudit(params).catch((err) => {
    console.error('[audit] failed to write log:', err);
  });
};
