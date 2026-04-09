# Sprint 3 — Data Extraction Engine: Context & Decisions

> Completed: 2026-04-08
> Commit: 5f038d8

---

## What Was Built

### Pipeline (`src/lib/extraction/pipeline.ts`)
`runExtractionPipeline(document, orgId)` — full orchestration:
1. Sets document status → `processing`
2. Downloads file buffer from Supabase Storage
3. Calls `provider.classify()` — AI-based doc type (overrides Sprint 2 filename-based)
4. Calls `provider.extract()` — returns structured financial fields + confidence score
5. Validates extracted fields (`validators.ts`)
6. If confidence < 0.75 OR validation errors → status = `review`, routed to review queue
7. If confidence ≥ 0.75 AND valid → status = `approved`, auto-approved
8. Stores record in `extracted_records`
9. Updates document: status, doc_type, folder, renamed_name (with vendor if available)

### AI Providers

| Provider | File | When Used |
|----------|------|-----------|
| Google Document AI | `src/lib/ai/providers/google-doc-ai.ts` | Default (`EXTRACTION_PROVIDER=google`) |
| GPT-4o Vision | `src/lib/ai/providers/gpt4o-vision.ts` | Set `EXTRACTION_PROVIDER=gpt4o` |
| Mock | inline in `google-doc-ai.ts` | Auto-fallback when Google credentials not set |

**Mock behavior**: Returns `confidence_score: 0.5` — forces all records into review queue. Raw fields include `{ mock: true }` so the UI can show a warning.

**Google Document AI**: Needs `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_DOCUMENT_AI_PROCESSOR_ID`, and `GOOGLE_APPLICATION_CREDENTIALS`.

**Provider switching**: Change `EXTRACTION_PROVIDER` env var. No code changes.

### Validators (`src/lib/extraction/validators.ts`)
- `validateExtractedFields()` — checks amount, date, tax, line item totals
- `CONFIDENCE_THRESHOLD = 0.75` — records below this go to review queue
- `requiresReview(score)` — checks confidence threshold

### Repository (`src/lib/db/repositories/extraction-repository.ts`)
Key methods: `create`, `findById`, `findByDocumentId`, `listForReview`, `update`, `countPendingReview`

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/extraction/process/[documentId]` | POST | Trigger extraction pipeline |
| `/api/extraction/review` | GET | List review queue (status=review) |
| `/api/extraction/[id]` | GET | Get single record |
| `/api/extraction/[id]` | PATCH | Edit extracted fields |
| `/api/extraction/[id]/approve` | POST | Approve → updates doc renamed_name with vendor |
| `/api/extraction/[id]/reject` | POST | Reject → resets document to pending |

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `ExtractionForm` | `src/components/extraction/extraction-form.tsx` | Edit fields, show confidence, approve/reject |
| `ReviewQueueTable` | `src/components/extraction/review-queue-table.tsx` | List all pending review items |

### Pages & Nav
- `/extraction` — Review Queue page (accessible from sidebar "Review Queue")
- Document detail `/documents/[id]` — now shows "Extract Data" button + inline ExtractionForm
- `?review=[id]` query param — direct link from Review Queue table to document + extraction record

### Hooks (`src/hooks/use-extraction.ts`)
`useExtractionRecord`, `useExtractionByDocument`, `useReviewQueue`, `useReviewQueueCount`, `useProcessDocument`, `useUpdateExtraction`, `useApproveExtraction`, `useRejectExtraction`

---

## Extraction Flow (End-to-End)

```
Upload → runExtractionPipeline() auto-triggered
    ↓
confidence ≥ 0.75 AND valid → status: approved → document updated + renamed
    ↓
confidence < 0.75 OR validation error → status: review → appears in Review Queue
    ↓
User opens Review Queue → clicks "Review" → goes to /documents/[id]?review=[recordId]
    ↓
User edits fields → clicks Approve
    ↓
document.status → approved, document.renamed_name → updated with vendor
```

---

## Approve Side Effects

When an extraction is approved:
1. `extracted_records.status` → `approved`
2. `extracted_records.reviewed_by` + `reviewed_at` set
3. `documents.status` → `approved`
4. `documents.renamed_name` → regenerated with vendor name + date from extracted data

---

## Known Gaps / Sprint 4 Handoff

1. **Ledger entry creation not yet triggered on approval** — Sprint 4 will add a call to `LedgerRepository.createFromExtraction()` inside the approve route.

2. **`useExtractionByDocument` is inefficient** — fetches the full review queue and filters client-side. Sprint 4 should add a `GET /api/extraction/by-document/[documentId]` route backed by `ExtractionRepository.findByDocumentId()`.

3. **Review Queue shows document ID only** — table shows `record.document_id.slice(0,8)`. Sprint 4+ should join the document name for a better UX.

4. **No pagination on Review Queue UI** — `ReviewQueueTable` doesn't page. Add pagination controls when queue grows.

5. **Upload `maxDuration` raised to 60s** — because extraction now runs synchronously inline with upload. For production, move to a background job queue (e.g. Inngest, Trigger.dev).

---

## Environment Variables Added (Sprint 3)

```bash
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
OPENAI_API_KEY=                    # For GPT-4o fallback
EXTRACTION_PROVIDER=google         # 'google' | 'gpt4o'
```

---

## Next: Sprint 4 — Internal Ledger Engine

Picks up from here. Needs:
- `LedgerRepository` — createFromExtraction, list, update, delete
- Chart of accounts UI — view and customize
- Auto-ledger entry creation when extraction is approved
- Manual transaction entry + edit interface
- Ledger page: filterable, sortable table
- Double-entry validation (debit XOR credit constraint)
- Account balance calculations
