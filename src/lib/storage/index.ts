/**
 * Storage abstraction — Supabase Storage today, S3/R2 tomorrow.
 * All file operations go through this module.
 */

import { createServerSupabaseClient } from '@/lib/db/server'

const BUCKET = 'financial-documents'
const ORIGINALS_BUCKET = 'original-uploads'

export interface UploadResult {
  path: string
  publicUrl?: string
}

export async function uploadDocument(
  orgId: string,
  file: Buffer | File,
  fileName: string,
  mimeType: string
): Promise<UploadResult> {
  const supabase = await createServerSupabaseClient()
  const path = `${orgId}/${Date.now()}_${fileName}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: mimeType, upsert: false })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  return { path }
}

export async function uploadOriginal(
  orgId: string,
  file: Buffer | File,
  fileName: string,
  mimeType: string
): Promise<UploadResult> {
  const supabase = await createServerSupabaseClient()
  const path = `${orgId}/${Date.now()}_${fileName}`

  const { error } = await supabase.storage
    .from(ORIGINALS_BUCKET)
    .upload(path, file, { contentType: mimeType, upsert: false })

  if (error) throw new Error(`Original upload failed: ${error.message}`)

  return { path }
}

export async function getSignedUrl(
  bucket: 'financial-documents' | 'original-uploads',
  path: string,
  expiresInSeconds = 3600
): Promise<string> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds)

  if (error) throw new Error(`Failed to create signed URL: ${error.message}`)
  return data.signedUrl
}

export async function deleteDocument(path: string): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw new Error(`Storage delete failed: ${error.message}`)
}
