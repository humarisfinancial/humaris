import { createHash } from 'crypto'
import { DocumentRepository } from '@/lib/db/repositories/document-repository'
import type { DuplicateConfidence, Document } from '@/types'

export interface DuplicateMatch {
  document: Document
  confidence: DuplicateConfidence
}

/**
 * Computes SHA-256 hash of file contents.
 * Used for exact duplicate detection.
 */
export function computeFileHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * Detects duplicates for an uploaded file against existing documents in the org.
 *
 * Exact match: same SHA-256 hash
 * Near-match: Sprint 3 will add AI content comparison (same vendor + date + amount).
 *             For now we detect by similar filename patterns.
 */
export async function detectDuplicates(
  orgId: string,
  fileBuffer: Buffer,
  filename: string
): Promise<DuplicateMatch[]> {
  const hash = computeFileHash(fileBuffer)
  const matches: DuplicateMatch[] = []

  // Exact match by hash
  const exactMatches = await DocumentRepository.findByHash(orgId, hash)
  for (const doc of exactMatches) {
    matches.push({ document: doc, confidence: 'exact' })
  }

  if (matches.length > 0) return matches

  // Near-match: same base filename (ignoring extension + date prefix)
  // Sprint 3 upgrades this to AI content comparison
  const baseName = stripDateAndExtension(filename).toLowerCase()
  if (baseName.length < 4) return matches

  const allDocs = await DocumentRepository.list(orgId, {}, { per_page: 1000 })
  for (const doc of allDocs.items) {
    const existingBase = stripDateAndExtension(doc.renamed_name ?? doc.original_name).toLowerCase()
    if (existingBase === baseName) {
      matches.push({ document: doc, confidence: 'likely' })
    }
  }

  return matches
}

function stripDateAndExtension(filename: string): string {
  return filename
    .replace(/\.\w+$/, '')                        // remove extension
    .replace(/^\d{4}[.\-_]\d{2}[.\-_]\d{2}\s*/, '') // remove date prefix
    .trim()
}
