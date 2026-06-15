import { Request, Response, NextFunction } from 'express'
import { CognitoJwtVerifier } from 'aws-jwt-verify'
import { verifyAccessToken } from '../services/auth.service'
import { prisma } from '../services/prisma.service'
import { AuthRequest } from '../types'
import { Role } from '@prisma/client'

type CognitoVerifier = ReturnType<typeof CognitoJwtVerifier.create>
let cognitoVerifier: CognitoVerifier | null = null

function getCognitoVerifier(): CognitoVerifier | null {
  const poolId = process.env.COGNITO_USER_POOL_ID
  const clientId = process.env.COGNITO_USER_POOL_CLIENT_ID
  if (!poolId || !clientId) return null
  if (!cognitoVerifier) {
    cognitoVerifier = CognitoJwtVerifier.create({
      userPoolId: poolId,
      clientId,
      tokenUse: 'id',
    })
  }
  return cognitoVerifier
}

function peekIssuer(token: string): string | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payloadB64 = parts[1]
    if (!payloadB64) return null
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as Record<string, unknown>
    return (payload['iss'] as string) ?? null
  } catch {
    return null
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'No token provided' })
    return
  }

  const token = authHeader.slice(7)
  const verifier = getCognitoVerifier()

  if (verifier) {
    const iss = peekIssuer(token)
    if (iss?.includes('cognito-idp')) {
      try {
        const claims = await verifier.verify(token)
        const email = claims['email'] as string

        // Upsert DB user — ensures first-login users are created from Cognito claims
        const user = await prisma.user.upsert({
          where: { email },
          update: { name: (claims['name'] as string | undefined) ?? undefined },
          create: {
            email,
            name: (claims['name'] as string) ?? email,
            passwordHash: '[cognito]',
            role: ((claims['custom:role'] as string) ?? 'CASHIER') as Role,
            isActive: true,
          },
        })

        if (!user.isActive) {
          res.status(403).json({ success: false, error: 'Account is deactivated' })
          return
        }

        ;(req as AuthRequest).user = { sub: user.id, email: user.email, role: user.role, name: user.name }
        next()
        return
      } catch {
        res.status(401).json({ success: false, error: 'Invalid or expired token' })
        return
      }
    }
  }

  // Local JWT fallback — used in development when COGNITO_USER_POOL_ID is not set
  try {
    const payload = verifyAccessToken(token)
    ;(req as AuthRequest).user = payload
    next()
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' })
  }
}
