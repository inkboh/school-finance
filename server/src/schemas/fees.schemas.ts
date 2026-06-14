import { z } from 'zod'
import { PaymentMethod } from '@prisma/client'

export const CreateFeeReceiptSchema = z.object({
  studentName: z.string().min(1),
  studentId: z.string().optional(),
  grade: z.string().optional(),
  categoryId: z.string().cuid(),
  amount: z.number().positive(),
  currencyId: z.string().cuid(),
  exchangeRate: z.number().positive().default(1),
  paymentDate: z.string().datetime(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

export const RejectSchema = z.object({
  reason: z.string().min(5),
})

export const ListQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.enum(['PENDING_APPROVAL','APPROVED','REJECTED']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
  categoryId: z.string().optional(),
})
