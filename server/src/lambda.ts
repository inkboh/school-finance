import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import serverlessHttp from 'serverless-http'
import { execSync } from 'child_process'
import * as bcrypt from 'bcryptjs'
import { importDataHandler } from './handlers/import-data.handler'
// app and prisma are NOT imported at module level — PrismaClient must be
// constructed after DATABASE_URL is set by initialize(), not at cold-start.

let httpHandler: ReturnType<typeof serverlessHttp>
let initialized = false

const sm = new SecretsManagerClient({ region: process.env.AWS_REGION ?? 'us-east-1' })

async function getSecret(arn: string): Promise<string> {
  const { SecretString } = await sm.send(new GetSecretValueCommand({ SecretId: arn }))
  if (!SecretString) throw new Error(`Secret ${arn} has no string value`)
  return SecretString
}

async function initialize(): Promise<void> {
  if (initialized) return

  // Set all env vars BEFORE any module that creates PrismaClient is imported
  if (process.env.DB_SECRET_ARN) {
    const raw = await getSecret(process.env.DB_SECRET_ARN)
    const creds = JSON.parse(raw) as {
      username: string; password: string; host: string; port: number; dbname: string
    }
    process.env.DATABASE_URL =
      `postgresql://${creds.username}:${encodeURIComponent(creds.password)}` +
      `@${creds.host}:${creds.port}/${creds.dbname}?schema=public`
  }

  if (process.env.JWT_SECRET_ARN) {
    process.env.JWT_SECRET = await getSecret(process.env.JWT_SECRET_ARN)
  }
  if (process.env.REFRESH_SECRET_ARN) {
    process.env.REFRESH_SECRET = await getSecret(process.env.REFRESH_SECRET_ARN)
  }

  // Dynamic import so prisma.service.ts runs (and calls new PrismaClient()) only
  // after DATABASE_URL is set above — not at Lambda cold-start.
  const { default: app } = await import('./app')
  httpHandler = serverlessHttp(app)
  initialized = true
}

export async function handler(event: unknown, context: unknown): Promise<unknown> {
  await initialize()
  const ev = event as Record<string, unknown> | null
  if (ev && typeof ev === 'object') {
    if (ev['action'] === 'dbpush')           return dbPushHandler(ev as { action: string })
    if (ev['action'] === 'seed')             return seedHandler()
    if (ev['action'] === 'import')           return importDataHandler()
    if (ev['action'] === 'cognitoBootstrap') return cognitoBootstrapHandler()
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return httpHandler(event as any, context as any)
}

export async function seedHandler(): Promise<{ success: boolean; seeded?: string[]; error?: string }> {
  await initialize()
  // Create a fresh Prisma client here — DATABASE_URL is guaranteed to be set
  // by initialize() before this point.
  const { PrismaClient } = await import('@prisma/client')
  const db = new PrismaClient()
  try {
    const seeded: string[] = []

    await db.currency.upsert({
      where: { code: 'USD' },
      update: { isBaseCurrency: false },
      create: { code: 'USD', name: 'US Dollar', symbol: '$', isBaseCurrency: false, isActive: true },
    })
    await db.currency.upsert({
      where: { code: 'GHS' },
      update: { isBaseCurrency: true },
      create: { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵', isBaseCurrency: true, isActive: true },
    })
    const ngn = await db.currency.upsert({
      where: { code: 'NGN' },
      update: {},
      create: { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', isBaseCurrency: false, isActive: true },
    })
    await db.exchangeRate.upsert({
      where: { currencyId_effectiveDate: { currencyId: ngn.id, effectiveDate: new Date('2026-01-01T00:00:00.000Z') } },
      update: {},
      create: { currencyId: ngn.id, rate: 0.00065, effectiveDate: new Date('2026-01-01T00:00:00.000Z') },
    })
    seeded.push('currencies')

    for (const cat of [
      { name: 'Tuition',             description: 'Term tuition fees' },
      { name: 'Registration Fee',    description: 'New student registration fee' },
      { name: 'PTA Levy',            description: 'Parent-Teacher Association levy' },
      { name: 'Exam Fee',            description: 'Examination fees' },
      { name: 'Development Levy',    description: 'School development fund contribution' },
      { name: 'Uniform',             description: 'School uniform fees' },
      { name: 'Books & Stationery',  description: 'Books and stationery fees' },
    ]) {
      await db.feeCategory.upsert({ where: { name: cat.name }, update: {}, create: { ...cat, isActive: true } })
    }
    seeded.push('feeCategories')

    const salaries    = await db.expenseCategory.upsert({ where: { name: 'Salaries' },    update: {}, create: { name: 'Salaries',    description: 'Staff salary payments',           isActive: true } })
    const utilities   = await db.expenseCategory.upsert({ where: { name: 'Utilities' },   update: {}, create: { name: 'Utilities',   description: 'Utility bills and subscriptions', isActive: true } })
    const maintenance = await db.expenseCategory.upsert({ where: { name: 'Maintenance' }, update: {}, create: { name: 'Maintenance', description: 'Maintenance and repair expenses',  isActive: true } })

    for (const cat of [
      { name: 'Office Supplies',      description: 'Office and administrative supplies' },
      { name: 'Transport',            description: 'Transportation and logistics expenses' },
      { name: 'Marketing & Outreach', description: 'Marketing and community outreach expenses' },
    ]) {
      await db.expenseCategory.upsert({ where: { name: cat.name }, update: {}, create: { ...cat, isActive: true } })
    }
    for (const cat of [
      { name: 'Teaching Staff Salaries', description: 'Salaries for teaching staff',                   parentId: salaries.id },
      { name: 'Support Staff Salaries',  description: 'Salaries for support and administrative staff', parentId: salaries.id },
    ]) {
      await db.expenseCategory.upsert({ where: { name: cat.name }, update: { parentId: cat.parentId }, create: { ...cat, isActive: true } })
    }
    for (const cat of [
      { name: 'Electricity', description: 'Electricity bills',              parentId: utilities.id },
      { name: 'Water',       description: 'Water bills',                    parentId: utilities.id },
      { name: 'Internet',    description: 'Internet and connectivity bills', parentId: utilities.id },
    ]) {
      await db.expenseCategory.upsert({ where: { name: cat.name }, update: { parentId: cat.parentId }, create: { ...cat, isActive: true } })
    }
    for (const cat of [
      { name: 'Building Repairs',      description: 'Repairs and renovation of school buildings',     parentId: maintenance.id },
      { name: 'Equipment Maintenance', description: 'Maintenance of school equipment and machinery',  parentId: maintenance.id },
    ]) {
      await db.expenseCategory.upsert({ where: { name: cat.name }, update: { parentId: cat.parentId }, create: { ...cat, isActive: true } })
    }
    seeded.push('expenseCategories')

    for (const u of [
      { email: 'admin@school.edu',     name: 'System Administrator', password: 'Admin@1234',     role: 'SUPER_ADMIN'     as const },
      { email: 'finance@school.edu',   name: 'Finance Manager',      password: 'Finance@1234',   role: 'FINANCE_MANAGER' as const },
      { email: 'cashier@school.edu',   name: 'Front Desk Cashier',   password: 'Cashier@1234',   role: 'CASHIER'         as const },
      { email: 'principal@school.edu', name: 'School Principal',     password: 'Principal@1234', role: 'PRINCIPAL'       as const },
      { email: 'auditor@school.edu',   name: 'Internal Auditor',     password: 'Auditor@1234',   role: 'AUDITOR'         as const },
    ]) {
      const passwordHash = await bcrypt.hash(u.password, 12)
      await db.user.upsert({
        where: { email: u.email },
        update: {},
        create: { email: u.email, name: u.name, passwordHash, role: u.role, isActive: true },
      })
    }
    seeded.push('users')

    return { success: true, seeded }
  } catch (err: unknown) {
    const e = err as { message?: string }
    return { success: false, error: e.message ?? 'Unknown error' }
  } finally {
    await db.$disconnect()
  }
}

export async function cognitoBootstrapHandler(): Promise<{
  success: boolean
  users?: Array<{ email: string; status: string }>
  tempPassword?: string
  error?: string
}> {
  await initialize()
  const poolId = process.env.COGNITO_USER_POOL_ID
  if (!poolId) return { success: false, error: 'COGNITO_USER_POOL_ID not set — deploy with Cognito first' }

  const { PrismaClient } = await import('@prisma/client')
  const {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminSetUserPasswordCommand,
  } = await import('@aws-sdk/client-cognito-identity-provider')

  const db = new PrismaClient()
  const cog = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION ?? 'us-east-1' })
  const TEMP_PASSWORD = 'School.Finance2025!'

  try {
    const users = await db.user.findMany({ where: { isActive: true } })
    const results: Array<{ email: string; status: string }> = []

    for (const user of users) {
      try {
        await cog.send(new AdminCreateUserCommand({
          UserPoolId: poolId,
          Username: user.email,
          MessageAction: 'SUPPRESS',
          UserAttributes: [
            { Name: 'email', Value: user.email },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'name', Value: user.name },
            { Name: 'custom:role', Value: user.role },
          ],
        }))
        await cog.send(new AdminSetUserPasswordCommand({
          UserPoolId: poolId,
          Username: user.email,
          Password: TEMP_PASSWORD,
          Permanent: false,
        }))
        results.push({ email: user.email, status: 'created' })
      } catch (err: unknown) {
        const e = err as { name?: string; message?: string }
        if (e.name === 'UsernameExistsException') {
          results.push({ email: user.email, status: 'already_exists' })
        } else {
          results.push({ email: user.email, status: `error: ${e.message ?? 'unknown'}` })
        }
      }
    }

    return { success: true, users: results, tempPassword: TEMP_PASSWORD }
  } catch (err: unknown) {
    const e = err as { message?: string }
    return { success: false, error: e.message ?? 'Unknown error' }
  } finally {
    await db.$disconnect()
  }
}

export async function dbPushHandler(event: { action?: string }): Promise<{ success: boolean; output?: string; error?: string }> {
  if (event.action !== 'dbpush') return { success: false, error: 'Unknown action' }
  await initialize()
  try {
    const schemaPath = `${process.env.LAMBDA_TASK_ROOT ?? '.'}/prisma/schema.prisma`
    const output = execSync(
      `node node_modules/.bin/prisma db push --schema="${schemaPath}" --accept-data-loss --skip-generate`,
      { encoding: 'utf8', env: { ...process.env }, stdio: 'pipe' },
    )
    return { success: true, output }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string }
    return { success: false, error: (e.stderr ?? e.message ?? 'Unknown error').slice(0, 4096) }
  }
}
