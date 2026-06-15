import { Router } from 'express'
import type { RequestHandler } from 'express'
import multer from 'multer'
import * as path from 'path'
import { authenticate } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import {
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  downloadDocument,
} from '../controllers/documents.controller'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg']
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, allowed.includes(ext))
  },
})

const router = Router()

router.use(authenticate)

router.get('/',                listDocuments)
router.get('/:id',             getDocument)
router.get('/:id/download',    downloadDocument)
router.post('/',               requireRole('FINANCE_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN'), upload.single('file'), createDocument as unknown as RequestHandler)
router.patch('/:id',           requireRole('FINANCE_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN'), upload.single('file'), updateDocument as unknown as RequestHandler)

export default router
