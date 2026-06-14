import { z } from 'zod'

export const CreateCurrencySchema = z.object({
  code: z.string().length(3).toUpperCase(),
  name: z.string().min(1),
  symbol: z.string().min(1),
  isBaseCurrency: z.boolean().default(false),
})

export const CreateExchangeRateSchema = z.object({
  currencyId: z.string().cuid(),
  rate: z.number().positive(),
  effectiveDate: z.string().datetime(),
})

export const CreateFeeCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

export const UpdateFeeCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
})

export const CreateExpenseCategorySchema = z.object({
  name: z.string().min(1),
  parentId: z.string().cuid().optional(),
  description: z.string().optional(),
})

export const UpdateExpenseCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
})
