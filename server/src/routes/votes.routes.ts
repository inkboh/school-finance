import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import { getVotes, castVote, deleteVote } from '../controllers/votes.controller'

const router = Router()

router.use(authenticate)

// Any authenticated user can read votes
router.get('/', getVotes)

// Only DIRECTORs can cast or retract votes
router.post('/',   requireRole('DIRECTOR'), castVote)
router.delete('/', requireRole('DIRECTOR'), deleteVote)

export default router
