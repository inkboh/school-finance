import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate.middleware'
import { LoginSchema, ChangePasswordSchema } from '../schemas/auth.schemas'
import * as authCtrl from '../controllers/auth.controller'

const router = Router()

// POST /api/auth/login
router.post('/login', validate(LoginSchema), authCtrl.login)

// POST /api/auth/refresh
router.post('/refresh', authCtrl.refreshToken)

// POST /api/auth/logout
router.post('/logout', authCtrl.logout)

// GET /api/auth/me
router.get('/me', authenticate, authCtrl.getMe)

// PUT /api/auth/change-password
router.put('/change-password', authenticate, validate(ChangePasswordSchema), authCtrl.changePassword)

export default router
