# Sprint 1 — Foundation: Context & Decisions

> Completed: 2026-04-08
> Commit: f4ea6d5

---

## What Was Built

### Next.js Project Scaffold
- **Framework**: Next.js 16.2.3 (App Router, Turbopack)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: TanStack Query (QueryClientProvider in `src/app/providers.tsx`)
- **Toasts**: Sonner (`src/components/ui/sonner.tsx`)
- **Project name in package.json**: `humaris-app` (lowercase required by npm)

### Directory Structure Created
```
src/
├── app/
│   ├── (auth)/login/        # Login page
│   ├── (auth)/signup/       # Signup page
│   ├── (app)/               # All protected routes — layout wraps with AppShell
│   │   ├── dashboard/       # Stub — Sprint 6
│   │   ├── upload/          # Stub — Sprint 2
│   │   ├── documents/       # Stub — Sprint 2
│   │   ├── ledger/          # Stub — Sprint 4
│   │   ├── templates/       # Stub — Sprints 5 & 6
│   │   ├── search/          # Stub — Sprint 7
│   │   └── settings/        # Stub — Sprint 8
│   ├── (admin)/tenants/     # Super-admin only — Sprint 8
│   ├── api/auth/
│   │   ├── callback/        # Supabase OAuth/email confirmation handler
│   │   └── signout/         # POST to sign out
│   ├── layout.tsx           # Root layout with Providers
│   ├── page.tsx             # Redirects to /dashboard
│   └── providers.tsx        # QueryClient + Toaster
├── components/
│   ├── auth/
│   │   ├── login-form.tsx   # Client component
│   │   └── signup-form.tsx  # Client component — collects full_name + org_name
│   ├── layout/
│   │   └── app-shell.tsx    # Sidebar nav + user dropdown (Client Component)
│   └── ui/                  # shadcn components
├── hooks/
│   └── use-session.ts       # Client-side auth user hook
├── lib/
│   ├── db/
│   │   ├── client.ts        # Browser Supabase client (lazy env validation)
│   │   └── server.ts        # Server Supabase client + service role client
│   ├── auth/
│   │   └── session.ts       # requireSession() + getSession() — server-side
│   ├── rbac/
│   │   └── permissions.ts   # Permission matrix — single source of truth
│   ├── ai/
│   │   ├── extraction.ts    # ExtractionProvider interface
│   │   └── providers/
│   │       └── google-doc-ai.ts  # Google Document AI implementation
│   ├── storage/
│   │   └── index.ts         # Storage abstraction (Supabase Storage)
│   └── search/
│       └── index.ts         # Search abstraction (Postgres ILIKE for MVP)
├── proxy.ts                 # Route protection + session refresh (Next.js 16 "proxy")
└── types/
    └── index.ts             # All domain types — single source of truth
supabase/
└── migrations/
    ├── 001_initial_schema.sql
    ├── 002_rls_policies.sql
    └── 003_default_chart_of_accounts.sql
```

---

## Database Schema

### Tables
| Table | Purpose |
|-------|---------|
| `organizations` | Tenants — one per business |
| `user_profiles` | Extends `auth.users` with name, avatar, `is_super_admin` |
| `org_members` | User ↔ Org join with `org_role` enum |
| `documents` | Uploaded file metadata (path, type, folder, status) |
| `duplicate_flags` | Tracks duplicate detection results + user resolution |
| `extracted_records` | Structured financial data extracted from documents |
| `chart_of_accounts` | Double-entry chart of accounts per org |
| `ledger_entries` | Double-entry ledger (debit XOR credit constraint) |
| `financial_statements` | Cached generated statements (P&L, Balance, Cash Flow) |
| `document_search` | FTS index for documents (tsvector) |
| `transaction_search` | FTS index for ledger entries (tsvector) |
| `audit_log` | Role changes + financial data edits |

### Enums
- `org_role`: `owner | admin | accountant | ops | viewer`
- `document_type`: `invoice | receipt | bank_statement | payroll_report | revenue_report | expense_report | financial_statement | spreadsheet | bank_check | other`
- `document_folder`: `invoices | expenses | revenue | inventory | bank_statements | payroll | finance_accounting | original_uploads | duplicates_review | other`
- `document_status`: `pending | processing | extracted | review_required | approved | failed`
- `duplicate_confidence`: `exact | likely | possible`
- `duplicate_resolution`: `keep_new | keep_existing | keep_both | decide_later`
- `extraction_status`: `pending | review | approved | rejected`
- `account_type`: `asset | liability | equity | revenue | expense`
- `statement_type`: `pnl | balance_sheet | cash_flow`

### Key DB Features
- `update_updated_at()` trigger on all mutable tables
- `handle_new_user()` trigger auto-creates `user_profiles` row on Supabase Auth signup
- `seed_default_chart_of_accounts(org_id)` function — call after org creation
- All tables RLS-enabled; `user_org_ids()`, `user_org_role()`, `is_super_admin()` helper functions

---

## RBAC Permission Matrix

Defined in `src/lib/rbac/permissions.ts`. Uses numeric hierarchy:

| Role | Level |
|------|-------|
| owner | 5 |
| admin | 4 |
| accountant | 3 |
| ops | 2 |
| viewer | 1 |

Permission categories: `documents`, `extraction`, `ledger`, `statements`, `dashboard`, `search`, `settings`

---

## Auth Flow

1. User signs up at `/signup` → Supabase sends confirmation email
2. Confirmation link hits `/api/auth/callback` → exchanges code for session → redirects to `/dashboard`
3. `src/proxy.ts` refreshes session on every request and redirects unauthenticated users to `/login`
4. `requireSession()` in server components fetches user + profile + org membership
5. Sign out hits `POST /api/auth/signout` → clears session → redirects to `/login`

### Onboarding gap (not yet built)
After signup, user has no org. `requireSession()` redirects to `/onboarding` if no org found.
`/onboarding` route needs to be built in Sprint 8 (or Sprint 1 follow-up). It should:
- Accept org name (already collected in signup form via `user_meta_data.org_name`)
- Create org + add user as owner + seed chart of accounts

---

## Known Issues / TODOs for Later Sprints

1. **`/onboarding` route not yet created** — needed after signup when org doesn't exist yet. The signup form collects `org_name` via `user_meta_data` but the org row isn't created yet. A post-signup webhook or onboarding page needs to call `seed_default_chart_of_accounts()`.

2. **`src/lib/search/index.ts`** uses `ILIKE` for MVP — not full FTS (tsvector). Upgrade to `to_tsvector` queries in Sprint 7.

3. **Google Document AI** not installed — add `@google-cloud/documentai` in Sprint 3 when building the extraction pipeline.

4. **Supabase Storage buckets** (`financial-documents`, `original-uploads`) need to be created manually or via a migration before Sprint 2.

5. **`/admin` routes** — the proxy checks `is_super_admin` but the admin layout doesn't have its own `requireSession()` guard yet. Sprint 8.

---

## Environment Variables Required

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=        # From supabase start output or cloud project
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # From supabase start output or cloud project
SUPABASE_SERVICE_ROLE_KEY=       # From supabase start output or cloud project
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Sprint 3
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=
GOOGLE_APPLICATION_CREDENTIALS=
OPENAI_API_KEY=
```

---

## How to Run Locally

```bash
# Prerequisites: Docker Desktop running

# 1. Copy env template
cp .env.local.example .env.local

# 2. Start local Supabase
npx supabase start
# Copy URL, anon key, service role key from output into .env.local

# 3. Apply migrations
npx supabase db push

# 4. Run dev server
npm run dev
# → http://localhost:3000
```

---

## Abstraction Layers (Swap Guide)

| Layer | Current Implementation | How to Swap |
|-------|----------------------|-------------|
| Database | Supabase (local/cloud Postgres) | Change `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` |
| Storage | Supabase Storage | Edit `src/lib/storage/index.ts` to implement `StorageProvider` against S3/R2 |
| AI/OCR | Google Document AI | Add new class implementing `ExtractionProvider` in `src/lib/ai/providers/`, update `getExtractionProvider()` |
| Search | Postgres ILIKE | Edit `src/lib/search/index.ts` to call Typesense/Algolia instead |

---

## Next: Sprint 2 — File Upload + Document Management

Picks up from here. Needs:
- Drag & drop upload UI at `/upload`
- Supabase Storage bucket creation
- Auto-renaming logic
- AI classification (stubbed until Sprint 3)
- Duplicate detection + review UI
- Document library at `/documents`
- 48hr reminder notification system
