# MVP Plan — AI Financial Intelligence Platform

> Source of truth for the MVP build. Derived from `AI App Pre-PRD.docx` + clarifying Q&A session (2026-04-07).
> Refer to this document instead of re-reading the pre-PRD or relying on conversation memory.

---

## Product Summary

An AI-powered financial intelligence platform for small businesses that converts unstructured financial documents (invoices, receipts, bank statements, spreadsheets, PDFs) into structured financial records, ledger entries, financial statements, and performance dashboards.

---

## Tech Stack (Final)

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Next.js API Routes (monorepo, extractable to microservices later) |
| Database | Supabase (PostgreSQL) + Repository abstraction layer |
| Storage | Supabase Storage |
| Auth | Supabase Auth |
| State | TanStack Query |
| Charts | Recharts |
| AI/OCR | Google Document AI (primary) + provider abstraction layer |
| Hosting | Vercel |

### Key Architectural Decisions

**DB abstraction** — All business logic calls Repository classes (e.g. `DocumentRepository.findById()`), never Supabase directly. Switching from local → cloud is a single config line change in `src/lib/db/client.ts`.

**AI provider abstraction** — All extraction goes through `src/lib/ai/extraction.ts` (a provider-agnostic interface). Google Document AI is the first implementation. GPT-4o Vision is stubbed as fallback.

**Search abstraction** — `src/lib/search/index.ts` defines a `SearchProvider` interface. Postgres FTS (`tsvector`) is the MVP implementation. Typesense/Algolia can be plugged in without touching feature code.

**Multi-tenancy via RLS** — Every DB table has `org_id`. Supabase Row Level Security policies enforce tenant isolation at the DB layer, not just application logic.

---

## MVP Features (Source of Truth: Key User Flows)

All 7 engines are in scope for MVP:

| # | Feature | Notes |
|---|---------|-------|
| 1 | File Upload + Auto-Renaming | Drag & drop, duplicate detection, AI classification, folder routing |
| 2 | Data Extraction Engine | OCR pipeline, AI field extraction, review queue for low-confidence results |
| 3 | Internal Ledger Engine | Double-entry ledger, chart of accounts, transaction categorization |
| 4 | Financial Statement Generator | P&L, Balance Sheet, Cash Flow — auto-generated from ledger |
| 5 | Data Organization Engine | Templates that auto-populate from ledger data |
| 6 | KPI Dashboard | Real-time metrics cards + Recharts trend charts |
| 7 | Global Platform Search | Internal platform data only (documents + transactions) |

Plus: RBAC with 5 roles + super-admin layer.

---

## RBAC Roles

| Role | Key Permissions |
|------|----------------|
| Organization Owner | Full access + user/org management |
| Financial Manager / Admin | Full financial access, cannot manage org ownership |
| Accountant / Bookkeeper | Upload, extract, edit ledger, generate statements |
| Operations User | Upload + view documents, limited dashboard, no ledger |
| Read-Only Viewer | View dashboards + statements, search only |
| Super-Admin (internal) | Cross-tenant management, debug, support |

Multi-tenancy: each business is a strict tenant. `org_id` on every table, enforced via Supabase RLS.

---

## Project Structure

```
/
├── app/
│   ├── (auth)/                   # Login, signup
│   ├── (app)/                    # All protected pages
│   │   ├── dashboard/            # KPI Dashboard
│   │   ├── upload/               # File Upload + Auto-Rename
│   │   ├── documents/            # Document Library
│   │   ├── ledger/               # Internal Ledger Engine
│   │   ├── templates/            # Data Org Engine + Statement Generator
│   │   ├── search/               # Global Platform Search
│   │   └── settings/             # Org settings, users, RBAC
│   ├── (admin)/                  # Super-admin only
│   │   └── tenants/
│   └── api/
│       ├── documents/
│       ├── extraction/
│       ├── ledger/
│       ├── statements/
│       ├── kpi/
│       └── search/
├── src/
│   ├── lib/
│   │   ├── db/
│   │   │   ├── client.ts         # Single DB client — swap local ↔ cloud here
│   │   │   └── repositories/     # DocumentRepo, LedgerRepo, ExtractionRepo, etc.
│   │   ├── ai/
│   │   │   ├── extraction.ts     # Provider-agnostic ExtractionProvider interface
│   │   │   └── providers/
│   │   │       ├── google-doc-ai.ts
│   │   │       └── gpt4o-vision.ts
│   │   ├── storage/
│   │   │   └── index.ts          # StorageProvider interface (Supabase today, S3 later)
│   │   └── search/
│   │       └── index.ts          # SearchProvider interface (Postgres FTS today)
│   ├── components/
│   ├── hooks/
│   └── types/
├── supabase/
│   └── migrations/               # All schema changes versioned here
└── docs/                         # This file lives here
```

---

## Core Database Schema

```sql
-- Multi-tenancy
organizations       (id, name, slug, settings, created_at)
users               (id, email, name, avatar_url)
org_members         (org_id, user_id, role: owner|admin|accountant|ops|viewer)

-- Documents
documents           (id, org_id, uploaded_by, original_name, renamed_name,
                     doc_type, folder, storage_path, file_size, status,
                     is_duplicate, created_at)
duplicate_flags     (id, doc_id, matched_doc_id, confidence, resolution, resolved_at)

-- Extraction
extracted_records   (id, document_id, org_id, vendor_name, transaction_date,
                     amount, line_items jsonb, confidence_score, status, reviewed_by)

-- Ledger
chart_of_accounts   (id, org_id, code, name, type: asset|liability|equity|revenue|expense,
                     parent_id)
ledger_entries      (id, org_id, extracted_record_id, account_id, date, description,
                     debit, credit, category, source_doc_id)

-- Financial Statements (cached)
financial_statements (id, org_id, type: pnl|balance|cashflow, period_start,
                      period_end, data jsonb, generated_at)

-- Search (Postgres FTS)
document_search     (document_id, search_vector tsvector)
transaction_search  (entry_id, search_vector tsvector)
```

All tables include `org_id` with RLS policies enforcing strict tenant isolation.

---

## Build Order (8 Sprints)

### Sprint 1 — Foundation
- Supabase schema + RLS policies
- Next.js project scaffold (App Router, TypeScript, Tailwind, shadcn/ui)
- Auth flows (login, signup, org creation)
- Multi-tenant middleware (org context on every request)
- RBAC permission hook + server-side checks
- Base navigation shell layout

### Sprint 2 — File Upload + Document Management
- Drag & drop upload UI
- Supabase Storage integration via storage abstraction layer
- AI document classification (doc type detection)
- Standardized auto-renaming: `[Date] [DocType] [Vendor/Account]`
- Duplicate detection: exact (content hash) + near-match (AI content comparison)
- Duplicate review UI: side-by-side comparison, Keep New / Keep Existing / Keep Both / Decide Later
- Folder routing: /Invoices, /Expenses, /Revenue, /Bank Statements, etc.
- Persistent banner + dashboard badge for unresolved duplicates
- 48hr email + in-app reminder for unresolved duplicate files

### Sprint 3 — Data Extraction Engine
- Google Document AI integration behind `ExtractionProvider` interface
- Full pipeline: document upload → OCR → classify → extract fields → validate → confidence score
- Review Queue UI: low-confidence extractions surfaced for human review
- Field-level edit on extracted data
- Approved records written to `extracted_records` table

### Sprint 4 — Internal Ledger Engine
- Default chart of accounts (configurable per org)
- Auto-ledger entry creation from approved extracted records
- Manual transaction entry + edit UI
- Transaction categorization + recategorization
- Ledger view: filterable, sortable, paginated

### Sprint 5 — Financial Statement Generator
- P&L, Balance Sheet, Statement of Cash Flows — auto-generated from ledger
- Template selection UI (built-in templates + user-uploadable custom templates)
- Period selection: custom range, month, quarter, fiscal year, YTD, MTD
- Drill-down: summary → category → individual transactions → source document
- Export: PDF, XLSX, CSV
- Uncategorized transactions flagged inline with edit capability

### Sprint 6 — KPI Dashboard
- Metrics: Total Revenue, Gross Profit, Net Profit, Gross Margin, Net Margin, Total Expenses, Net Cash Flow, Revenue Growth Rate
- Recharts: time-series revenue trend chart, expense breakdown donut chart
- Prior period comparison (% change badges)
- Date range selector
- Auto-refresh when new documents are processed

### Sprint 7 — Global Platform Search
- Postgres `tsvector` full-text search across documents, extracted records, and ledger entries
- `Ctrl+F` triggered platform-wide search bar
- Results grouped by type: Documents / Transactions / Vendors
- `SearchProvider` interface stubbed for future external connectors (Gmail, Slack)

### Sprint 8 — Admin, Polish, Edge Cases
- Super-admin panel: tenant management, user impersonation, debug view
- Organization settings: user invite, role assignment, folder rename
- Error states, loading skeletons, empty states across all views
- Audit log: role changes, financial data edits
- End-to-end flow smoke testing

---

## Out of MVP Scope

The following are explicitly deferred to future versions:

- Email / Slack / Teams / Gmail ingestion
- External accounting integrations (QuickBooks, Xero)
- Financial forecasting
- Billing / subscriptions (Stripe)
- Mobile app
- Custom role creation (5 fixed roles for MVP)
- Operational metrics (revenue per customer, CAC, ARPU)
- Automated financial presentations
- Industry benchmarking

---

## Supported File Types (Upload)

PDF, JPG, PNG, CSV, XLSX, DOCX, Google Sheets

---

## Auto-Rename Format

```
[Date of last file edit] [Document Type] [Vendor or Account]

Examples:
  2026.02.18 Invoice ABC Supply.pdf
  2026.01.13 2026 Financial Forecast.xlsx
  2026.02.18 Invoice ABC Supply (v2).pdf   ← "Keep Both" duplicate
```

## Document Folder Structure

```
/Invoices
/Expenses
/Revenue
/Inventory
/Bank Statements
/Payroll
/Finance & Accounting
/Original File Uploads          ← Unmodified originals always preserved
/Duplicates — Needs Review      ← Only visible when files pending resolution
```

---

## Financial Statement Types

| Statement | Key Calculated Fields |
|-----------|-----------------------|
| Profit & Loss | Revenue, COGS, Gross Profit, Operating Expenses, Operating Income, Net Income |
| Balance Sheet | Assets, Liabilities, Equity (must satisfy: Assets = Liabilities + Equity) |
| Statement of Cash Flows | Operating Activities, Investing Activities, Financing Activities, Net Cash Flow |
