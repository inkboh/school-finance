import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import {
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  getStudentStats,
} from '../controllers/students.controller'

const router = Router()

router.use(authenticate)

router.get('/stats',  getStudentStats)
router.get('/',       listStudents)
router.get('/:id',    getStudent)
router.post('/',      requireRole('CASHIER', 'FINANCE_MANAGER', 'SUPER_ADMIN'), createStudent)
router.patch('/:id',  requireRole('CASHIER', 'FINANCE_MANAGER', 'SUPER_ADMIN'), updateStudent)

export default router
