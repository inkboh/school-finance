import { z } from 'zod'
import { Role } from '@prisma/client'

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
})

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: z.nativeEnum(Role),
  // password only required in local-dev mode; Cognito manages credentials in production
  password: z.string().min(8).optional(),
})

export const UpdateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.nativeEnum(Role).optional(),
})
