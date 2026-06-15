import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  addFunding,
  updateFunding,
  deleteFunding,
} from '../controllers/projects.controller'

const router = Router()

router.use(authenticate)

router.get('/',                          listProjects)
router.get('/:id',                       getProject)
router.post('/',                         requireRole('FINANCE_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN'), createProject)
router.patch('/:id',                     requireRole('FINANCE_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN'), updateProject)
router.post('/:id/funding',              requireRole('FINANCE_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN'), addFunding)
router.patch('/:id/funding/:fundingId',  requireRole('FINANCE_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN'), updateFunding)
router.delete('/:id/funding/:fundingId', requireRole('FINANCE_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN'), deleteFunding)

export default router
