import { z } from 'zod'
import { LoanType, LoanStatus, PaymentMethod } from '@prisma/client'

export const CreateLoanSchema = z.object({
  loanType: z.nativeEnum(LoanType),
  partyName: z.string().min(1),
  partyContact: z.string().optional(),
  purpose: z.string().optional(),
  principal: z.number().positive(),
  currencyId: z.string().cuid(),
  interestRate: z.number().min(0).max(100).optional(),
  loanDate: z.string().datetime(),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
})

export const UpdateLoanStatusSchema = z.object({
  status: z.nativeEnum(LoanStatus),
  notes: z.string().optional(),
})

export const CreateLoanPaymentSchema = z.object({
  amount: z.number().positive(),
  currencyId: z.string().cuid(),
  exchangeRate: z.number().positive().default(1),
  paymentDate: z.string().datetime(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

export const LoanListQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  loanType: z.enum(['BORROWED','LENT']).optional(),
  status: z.enum(['ACTIVE','PAID','DEFAULTED','WRITTEN_OFF']).optional(),
})
