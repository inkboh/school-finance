import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import { validate } from '../middleware/validate.middleware'
import { CreateUserSchema, UpdateUserSchema } from '../schemas/auth.schemas'
import {
  listUsers,
  createUser,
  updateUser,
  toggleUserStatus,
} from '../controllers/users.controller'

const router = Router()

// All users routes require authentication and SUPER_ADMIN role
router.use(authenticate, requireRole('SUPER_ADMIN'))

// GET /api/users
router.get('/', listUsers)

// POST /api/users
router.post('/', validate(CreateUserSchema), createUser)

// PUT /api/users/:id
router.put('/:id', validate(UpdateUserSchema), updateUser)

// PATCH /api/users/:id/status
router.patch('/:id/status', toggleUserStatus)

export default router
