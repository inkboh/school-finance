import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import { listAuditLogs } from '../controllers/audit.controller'

const router = Router()

// All audit routes require authentication and one of the permitted roles
router.use(authenticate, requireRole('AUDITOR', 'SUPER_ADMIN', 'PRINCIPAL', 'FINANCE_MANAGER'))

// GET /api/audit
router.get('/', listAuditLogs)

export default router
