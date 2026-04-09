# Sprint 2 — File Upload + Document Management: Context & Decisions

> Completed: 2026-04-08
> Commit: 14f74f9

---

## What Was Built

### Migrations
| File | Purpose |
|------|---------|
| `004_storage_buckets.sql` | Creates `financial-documents` + `original-uploads` buckets with RLS policies |
| `005_notifications.sql` | Notifications table for duplicate review reminders (used in Sprint 8) |

### Business Logic (`src/lib/documents/`)
| File | Purpose |
|------|---------|
| `classification.ts` | Filename-based doc type detection (stub — Sprint 3 replaces with AI content-based) |
| `renaming.ts` | `generateRenamedFilename()` — produces `YYYY.MM.DD DocType Vendor.ext` |
| `duplicate-detection.ts` | SHA-256 exact match + filename similarity near-match |

### Repositories (`src/lib/db/repositories/`)
| File | Key Methods |
|------|------------|
| `document-repository.ts` | `create`, `findById`, `list`, `update`, `delete`, `countPendingDuplicates`, `findByHash` |
| `duplicate-repository.ts` | `create`, `listPending`, `resolve` |

### API Routes
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/documents` | GET | List documents (filterable by folder/status/type/search) |
| `/api/documents/upload` | POST | multipart/form-data upload handler |
| `/api/documents/[id]` | GET | Fetch single doc + signed download URL |
| `/api/documents/[id]` | PATCH | Update document metadata |
| `/api/documents/[id]` | DELETE | Delete doc + remove from storage |
| `/api/documents/duplicates` | GET | List pending (unresolved) duplicate flags |
| `/api/documents/duplicates` | POST | Resolve a duplicate flag with chosen action |

### Components
| Component | Location | Purpose |
|-----------|----------|---------|
| `Dropzone` | `src/components/upload/dropzone.tsx` | Drag & drop + file browser, with file list preview |
| `DuplicateReviewModal` | `src/components/upload/duplicate-review-modal.tsx` | Step-through review of flagged duplicates |
| `DuplicateBanner` | `src/components/shared/duplicate-banner.tsx` | Persistent top banner (dismisses when resolved) |
| `DocumentTable` | `src/components/documents/document-table.tsx` | Sortable file list with status badges |
| `FolderNav` | `src/components/documents/folder-nav.tsx` | Folder sidebar with duplicate count badge |

### Pages
| Route | Component | Description |
|-------|-----------|-------------|
| `/upload` | `UploadPage` | Full upload flow: dropzone → upload → duplicate review → confirmation |
| `/documents` | `DocumentsPage` | Document library with folder nav + search |
| `/documents/[id]` | `DocumentDetailPage` | Metadata view + download + delete |

### Hooks (`src/hooks/use-documents.ts`)
- `useDocuments(options)` — paginated document list
- `usePendingDuplicatesCount()` — auto-refreshes every 60s
- `usePendingDuplicates()` — full flag list
- `useResolveDuplicate()` — resolves a flag, invalidates queries
- `useUpload()` — multipart upload mutation
- `useDeleteDocument()` — delete with query invalidation

---

## Upload Flow (Step by Step)

1. User selects files via drag & drop or browser
2. Rename notice shown: files will be standardized
3. User clicks "Upload N Files"
4. API route processes each file:
   - Computes SHA-256 hash
   - Saves original to `original-uploads` bucket
   - Classifies doc type from filename (Sprint 3: AI content-based)
   - Generates standardized name: `YYYY.MM.DD DocType Vendor.ext`
   - Runs duplicate detection (exact hash + filename similarity)
   - If duplicates found → routes to `duplicates_review` folder with `is_duplicate: true`
   - Otherwise → routes to correct folder
5. If any duplicates → `DuplicateReviewModal` opens automatically
6. User steps through each duplicate, picks: Keep New / Keep Existing / Keep Both / Decide Later
7. Confirmation shown with counts

---

## Duplicate Resolution Logic

| Resolution | What happens |
|-----------|-------------|
| `keep_new` | Deletes existing matched doc, moves new doc to its correct folder |
| `keep_existing` | Deletes the newly uploaded doc |
| `keep_both` | Appends `(v2)` to new doc's name, moves both to correct folder |
| `decide_later` | Doc stays in `duplicates_review`, flag marked as decided-later |

---

## Known Limitations / Sprint 3 Upgrades

1. **Classification is filename-based** — `classification.ts` uses keywords in the filename. Sprint 3 replaces this with Google Document AI content analysis so even files named `scan001.pdf` get correctly classified.

2. **Near-match detection is filename similarity only** — not content-based. Sprint 3 will add AI-powered near-match detection comparing vendor name + date + amount from extracted text.

3. **Vendor name not yet available at upload time** — the rename format omits vendor until Sprint 3 extraction runs. Documents will be renamed again after extraction completes.

4. **48hr email reminder not implemented** — `005_notifications.sql` creates the notifications table. The reminder cron job + email sending is Sprint 8.

5. **`/onboarding` route** — still not built. Users who sign up and have no org will hit a redirect loop. Build in Sprint 8.

---

## File Naming Format

```
YYYY.MM.DD [Document Type] [Vendor Name].ext

Examples:
  2026.04.08 Invoice.pdf              ← vendor unknown at upload time
  2026.04.08 Bank Statement.pdf
  2026.04.08 Invoice ABC Supply.pdf   ← vendor populated after extraction (Sprint 3)
  2026.04.08 Invoice ABC Supply (v2).pdf  ← "Keep Both" duplicate
```

---

## Folder Structure

```
/invoices          → invoice docs
/expenses          → receipt + expense_report
/revenue           → revenue_report
/inventory         → (future)
/bank_statements   → bank_statement + bank_check
/payroll           → payroll_report
/finance_accounting → financial_statement + spreadsheet
/original_uploads  → unmodified originals (always preserved)
/duplicates_review → flagged files pending resolution
/other             → unclassified
```

---

## Next: Sprint 3 — Data Extraction Engine

Picks up from here. Needs:
- Google Document AI integration behind `ExtractionProvider` interface
- OCR pipeline: classify → extract fields → validate → confidence score
- Review Queue UI for low-confidence extractions
- After approval: update document `renamed_name` with vendor from extraction
- Write approved records to `extracted_records` table
- Trigger ledger entry creation (Sprint 4)
