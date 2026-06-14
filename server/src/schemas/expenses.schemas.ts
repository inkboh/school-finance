import { z } from 'zod'
import { PaymentMethod } from '@prisma/client'

export const CreateExpenseSchema = z.object({
  categoryId: z.string().cuid(),
  description: z.string().min(1),
  vendor: z.string().optional(),
  amount: z.number().positive(),
  currencyId: z.string().cuid(),
  exchangeRate: z.number().positive().default(1),
  expenseDate: z.string().datetime(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

export const RejectExpenseSchema = z.object({
  reason: z.string().min(5),
})

export const ExpenseListQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.enum(['PENDING_APPROVAL','APPROVED','REJECTED']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
  categoryId: z.string().optional(),
})
