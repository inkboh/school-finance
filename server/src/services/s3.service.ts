import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import * as path from 'path'
import * as crypto from 'crypto'

const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' })

export function getBucket(): string {
  const bucket = process.env.UPLOADS_BUCKET
  if (!bucket) throw new Error('UPLOADS_BUCKET environment variable is not set')
  return bucket
}

export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<{ key: string; size: number }> {
  const ext = path.extname(originalName)
  const id  = crypto.randomUUID()
  const key = `documents/${Date.now()}-${id}${ext}`

  await s3.send(new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    ContentDisposition: `attachment; filename="${originalName}"`,
  }))

  return { key, size: buffer.length }
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }))
}

export async function getPresignedUrl(key: string, fileName: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
      ResponseContentDisposition: `attachment; filename="${fileName}"`,
    }),
    { expiresIn: 3600 },
  )
}
