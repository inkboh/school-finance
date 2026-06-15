import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import serverlessHttp from 'serverless-http'
import { execSync } from 'child_process'
import app from './app'

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

  // Fetch DB credentials and construct DATABASE_URL
  if (process.env.DB_SECRET_ARN) {
    const raw = await getSecret(process.env.DB_SECRET_ARN)
    const creds = JSON.parse(raw) as {
      username: string; password: string; host: string; port: number; dbname: string
    }
    process.env.DATABASE_URL = `postgresql://${creds.username}:${encodeURIComponent(creds.password)}@${creds.host}:${creds.port}/${creds.dbname}?schema=public`
  }

  // Fetch JWT secrets
  if (process.env.JWT_SECRET_ARN) {
    process.env.JWT_SECRET = await getSecret(process.env.JWT_SECRET_ARN)
  }
  if (process.env.REFRESH_SECRET_ARN) {
    process.env.REFRESH_SECRET = await getSecret(process.env.REFRESH_SECRET_ARN)
  }

  httpHandler = serverlessHttp(app)
  initialized = true
}

export async function handler(event: unknown, context: unknown): Promise<unknown> {
  await initialize()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return httpHandler(event as any, context as any)
}

// Invoked manually via AWS CLI to push the Prisma schema to RDS on first deploy
// Usage: aws lambda invoke --function-name <name> --payload '{"action":"dbpush"}' out.json
export async function dbPushHandler(event: { action?: string }): Promise<{ success: boolean; output?: string; error?: string }> {
  if (event.action !== 'dbpush') return { success: false, error: 'Unknown action' }
  await initialize()
  try {
    const schemaPath = `${process.env.LAMBDA_TASK_ROOT ?? '.'}/prisma/schema.prisma`
    const output = execSync(
      `node node_modules/.bin/prisma db push --schema="${schemaPath}" --accept-data-loss`,
      { encoding: 'utf8', env: { ...process.env }, stdio: 'pipe' },
    )
    return { success: true, output }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string }
    return { success: false, error: (e.stderr ?? e.message ?? 'Unknown error').slice(0, 4096) }
  }
}
