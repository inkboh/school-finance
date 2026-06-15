import { Request, Response } from 'express'
import { prisma } from '../services/prisma.service'
import { audit } from '../services/audit.service'
import { AuthRequest, paginate } from '../types'
import { z } from 'zod'
import { DocumentCategory } from '@prisma/client'
import * as s3 from '../services/s3.service'

const CreateDocumentSchema = z.object({
  title:         z.string().min(1),
  category:      z.nativeEnum(DocumentCategory),
  description:   z.string().optional(),
  content:       z.string().optional(),
  version:       z.string().default('1.0'),
  issuedDate:    z.string(),
  effectiveDate: z.string(),
  expiryDate:    z.string().optional(),
  notes:         z.string().optional(),
})

const DOC_INCLUDE = {
  createdBy: { select: { name: true } },
} as const

async function nextDocNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const last = await prisma.policyDocument.findFirst({
    where: { docNumber: { startsWith: `DOC-${year}-` } },
    orderBy: { docNumber: 'desc' },
    select: { docNumber: true },
  })
  const seq = last ? parseInt(last.docNumber.split('-')[2] ?? '0', 10) + 1 : 1
  return `DOC-${year}-${String(seq).padStart(3, '0')}`
}

export const listDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const page  = Math.max(1, parseInt(req.query.page as string ?? '1', 10) || 1)
    const limit = Math.max(1, parseInt(req.query.limit as string ?? '20', 10) || 20)
    const { skip, take } = paginate(page, limit)

    const where: Record<string, unknown> = {}
    if (req.query.category) where.category = req.query.category as DocumentCategory
    if (req.query.isActive !== undefined) where.isActive = req.query.isActive === 'true'
    if (req.query.search) {
      const term = req.query.search as string
      where.OR = [
        { title:       { contains: term, mode: 'insensitive' } },
        { docNumber:   { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ]
    }

    const [total, docs] = await Promise.all([
      prisma.policyDocument.count({ where }),
      prisma.policyDocument.findMany({ where, skip, take, orderBy: { effectiveDate: 'desc' }, include: DOC_INCLUDE }),
    ])

    const data = docs.map(({ content: _c, ...d }) => d)
    res.json({ success: true, data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } })
  } catch (err) {
    console.error('[documents] list:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const getDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await prisma.policyDocument.findUnique({ where: { id: req.params.id }, include: DOC_INCLUDE })
    if (!doc) { res.status(404).json({ success: false, error: 'Document not found' }); return }
    res.json({ success: true, data: doc })
  } catch (err) {
    console.error('[documents] get:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const createDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const bodyData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const data = CreateDocumentSchema.parse(bodyData)
    const docNumber = await nextDocNumber()
    const file = (req as Request & { file?: Express.Multer.File }).file

    let fileUrl: string | undefined
    let fileName: string | undefined
    let fileSize: number | undefined

    if (file) {
      if (process.env.UPLOADS_BUCKET) {
        const result = await s3.uploadFile(file.buffer, file.originalname, file.mimetype)
        fileUrl  = result.key
        fileSize = result.size
      }
      fileName = file.originalname
    }

    const doc = await prisma.policyDocument.create({
      data: {
        docNumber,
        title:         data.title,
        category:      data.category,
        description:   data.description,
        content:       data.content,
        version:       data.version,
        issuedDate:    new Date(data.issuedDate),
        effectiveDate: new Date(data.effectiveDate),
        expiryDate:    data.expiryDate ? new Date(data.expiryDate) : undefined,
        notes:         data.notes,
        createdById:   req.user.sub,
        fileUrl,
        fileName,
        fileSize,
      },
      include: DOC_INCLUDE,
    })

    audit({ userId: req.user.sub, action: 'CREATE', entityType: 'PolicyDocument', entityId: doc.id, newValue: { ...doc, content: '[omitted]' }, ipAddress: req.ip ?? undefined })
    res.status(201).json({ success: true, data: doc })
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ success: false, error: err.errors[0]?.message ?? 'Validation error' }); return }
    console.error('[documents] create:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const updateDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await prisma.policyDocument.findUnique({ where: { id: req.params.id } })
    if (!existing) { res.status(404).json({ success: false, error: 'Document not found' }); return }

    const bodyData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const data = CreateDocumentSchema.partial().extend({ isActive: z.boolean().optional() }).parse(bodyData)
    const file = (req as Request & { file?: Express.Multer.File }).file

    let fileUpdate: { fileUrl: string; fileName: string; fileSize: number } | undefined

    if (file && process.env.UPLOADS_BUCKET) {
      const result = await s3.uploadFile(file.buffer, file.originalname, file.mimetype)
      fileUpdate = { fileUrl: result.key, fileName: file.originalname, fileSize: result.size }

      // Delete old S3 object
      if (existing.fileUrl) {
        await s3.deleteFile(existing.fileUrl).catch((e) => console.error('[documents] delete old S3 object:', e))
      }
    }

    const doc = await prisma.policyDocument.update({
      where: { id: req.params.id },
      data: {
        ...data,
        issuedDate:    data.issuedDate    ? new Date(data.issuedDate)    : undefined,
        effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : undefined,
        expiryDate:    data.expiryDate    ? new Date(data.expiryDate)    : undefined,
        ...(fileUpdate ?? {}),
      },
      include: DOC_INCLUDE,
    })

    audit({ userId: req.user.sub, action: 'UPDATE', entityType: 'PolicyDocument', entityId: doc.id, ipAddress: req.ip ?? undefined })
    res.json({ success: true, data: doc })
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ success: false, error: err.errors[0]?.message ?? 'Validation error' }); return }
    console.error('[documents] update:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const downloadDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await prisma.policyDocument.findUnique({
      where: { id: req.params.id },
      select: { fileUrl: true, fileName: true },
    })
    if (!doc?.fileUrl) { res.status(404).json({ success: false, error: 'No file attached' }); return }

    // Production: redirect to S3 presigned URL (1-hour expiry)
    const url = await s3.getPresignedUrl(doc.fileUrl, doc.fileName ?? 'document')
    res.redirect(302, url)
  } catch (err) {
    console.error('[documents] download:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
