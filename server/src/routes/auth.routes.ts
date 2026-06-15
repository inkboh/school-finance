import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate.middleware'
import { LoginSchema, ChangePasswordSchema } from '../schemas/auth.schemas'
import * as authCtrl from '../controllers/auth.controller'

const router = Router()

// GET /api/auth/config — public, returns Cognito pool/client IDs for frontend
router.get('/config', authCtrl.getConfig)

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
