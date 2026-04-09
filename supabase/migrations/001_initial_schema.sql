-- ============================================================
-- Migration 001: Initial Schema
-- AI Financial Intelligence Platform
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";  -- for similarity search

-- ============================================================
-- ORGANIZATIONS (tenants)
-- ============================================================
create table if not exists organizations (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text not null unique,
  settings    jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- USERS (managed by Supabase Auth — this extends it)
-- ============================================================
create table if not exists user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  is_super_admin boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- ORG MEMBERS (RBAC)
-- ============================================================
create type org_role as enum ('owner', 'admin', 'accountant', 'ops', 'viewer');

create table if not exists org_members (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid not null references user_profiles(id) on delete cascade,
  role        org_role not null default 'viewer',
  invited_by  uuid references user_profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, user_id)
);

-- ============================================================
-- DOCUMENTS
-- ============================================================
create type document_type as enum (
  'invoice', 'receipt', 'bank_statement', 'payroll_report',
  'revenue_report', 'expense_report', 'financial_statement',
  'spreadsheet', 'bank_check', 'other'
);

create type document_folder as enum (
  'invoices', 'expenses', 'revenue', 'inventory',
  'bank_statements', 'payroll', 'finance_accounting',
  'original_uploads', 'duplicates_review', 'other'
);

create type document_status as enum (
  'pending', 'processing', 'extracted', 'review_required', 'approved', 'failed'
);

create table if not exists documents (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organizations(id) on delete cascade,
  uploaded_by     uuid not null references user_profiles(id),
  original_name   text not null,
  renamed_name    text,
  doc_type        document_type,
  folder          document_folder not null default 'other',
  storage_path    text not null,
  original_storage_path text,  -- path of preserved original
  file_size       bigint not null,
  mime_type       text,
  status          document_status not null default 'pending',
  is_duplicate    boolean not null default false,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- DUPLICATE FLAGS
-- ============================================================
create type duplicate_confidence as enum ('exact', 'likely', 'possible');
create type duplicate_resolution as enum ('keep_new', 'keep_existing', 'keep_both', 'decide_later');

create table if not exists duplicate_flags (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organizations(id) on delete cascade,
  doc_id          uuid not null references documents(id) on delete cascade,
  matched_doc_id  uuid references documents(id) on delete set null,
  confidence      duplicate_confidence not null,
  resolution      duplicate_resolution,
  resolved_by     uuid references user_profiles(id),
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- EXTRACTED RECORDS
-- ============================================================
create type extraction_status as enum ('pending', 'review', 'approved', 'rejected');

create table if not exists extracted_records (
  id                uuid primary key default uuid_generate_v4(),
  org_id            uuid not null references organizations(id) on delete cascade,
  document_id       uuid not null references documents(id) on delete cascade,
  vendor_name       text,
  transaction_date  date,
  amount            numeric(15,2),
  tax_amount        numeric(15,2),
  invoice_number    text,
  payment_terms     text,
  line_items        jsonb not null default '[]',
  raw_fields        jsonb not null default '{}',
  confidence_score  numeric(4,3),  -- 0.000 to 1.000
  status            extraction_status not null default 'pending',
  reviewed_by       uuid references user_profiles(id),
  reviewed_at       timestamptz,
  extraction_provider text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ============================================================
-- CHART OF ACCOUNTS
-- ============================================================
create type account_type as enum ('asset', 'liability', 'equity', 'revenue', 'expense');

create table if not exists chart_of_accounts (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organizations(id) on delete cascade,
  code        text not null,
  name        text not null,
  type        account_type not null,
  parent_id   uuid references chart_of_accounts(id),
  is_system   boolean not null default false,  -- system defaults, not deletable
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, code)
);

-- ============================================================
-- LEDGER ENTRIES (double-entry)
-- ============================================================
create table if not exists ledger_entries (
  id                  uuid primary key default uuid_generate_v4(),
  org_id              uuid not null references organizations(id) on delete cascade,
  extracted_record_id uuid references extracted_records(id) on delete set null,
  account_id          uuid not null references chart_of_accounts(id),
  source_doc_id       uuid references documents(id) on delete set null,
  entry_date          date not null,
  description         text,
  debit               numeric(15,2) not null default 0,
  credit              numeric(15,2) not null default 0,
  category            text,
  is_manual           boolean not null default false,
  created_by          uuid references user_profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint debit_or_credit check (
    (debit > 0 and credit = 0) or (credit > 0 and debit = 0)
  )
);

-- ============================================================
-- FINANCIAL STATEMENTS (cached output)
-- ============================================================
create type statement_type as enum ('pnl', 'balance_sheet', 'cash_flow');

create table if not exists financial_statements (
  id            uuid primary key default uuid_generate_v4(),
  org_id        uuid not null references organizations(id) on delete cascade,
  type          statement_type not null,
  period_start  date not null,
  period_end    date not null,
  granularity   text,  -- 'monthly', 'quarterly', 'yearly'
  data          jsonb not null default '{}',
  generated_by  uuid references user_profiles(id),
  generated_at  timestamptz not null default now()
);

-- ============================================================
-- FULL-TEXT SEARCH INDEXES
-- ============================================================
create table if not exists document_search (
  document_id   uuid primary key references documents(id) on delete cascade,
  search_vector tsvector
);

create table if not exists transaction_search (
  entry_id      uuid primary key references ledger_entries(id) on delete cascade,
  search_vector tsvector
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
create table if not exists audit_log (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid references organizations(id) on delete cascade,
  user_id     uuid references user_profiles(id),
  action      text not null,
  resource    text not null,
  resource_id uuid,
  old_value   jsonb,
  new_value   jsonb,
  ip_address  inet,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_org_members_org_id on org_members(org_id);
create index if not exists idx_org_members_user_id on org_members(user_id);
create index if not exists idx_documents_org_id on documents(org_id);
create index if not exists idx_documents_status on documents(status);
create index if not exists idx_documents_folder on documents(folder);
create index if not exists idx_extracted_records_org_id on extracted_records(org_id);
create index if not exists idx_extracted_records_document_id on extracted_records(document_id);
create index if not exists idx_ledger_entries_org_id on ledger_entries(org_id);
create index if not exists idx_ledger_entries_entry_date on ledger_entries(entry_date);
create index if not exists idx_ledger_entries_account_id on ledger_entries(account_id);
create index if not exists idx_duplicate_flags_org_id on duplicate_flags(org_id);
create index if not exists idx_document_search_vector on document_search using gin(search_vector);
create index if not exists idx_transaction_search_vector on transaction_search using gin(search_vector);
create index if not exists idx_audit_log_org_id on audit_log(org_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger organizations_updated_at before update on organizations
  for each row execute function update_updated_at();
create trigger user_profiles_updated_at before update on user_profiles
  for each row execute function update_updated_at();
create trigger org_members_updated_at before update on org_members
  for each row execute function update_updated_at();
create trigger documents_updated_at before update on documents
  for each row execute function update_updated_at();
create trigger extracted_records_updated_at before update on extracted_records
  for each row execute function update_updated_at();
create trigger chart_of_accounts_updated_at before update on chart_of_accounts
  for each row execute function update_updated_at();
create trigger ledger_entries_updated_at before update on ledger_entries
  for each row execute function update_updated_at();

-- ============================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into user_profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
