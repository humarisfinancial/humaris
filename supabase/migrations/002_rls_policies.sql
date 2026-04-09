-- ============================================================
-- Migration 002: Row Level Security Policies
-- Enforces strict multi-tenant data isolation at the DB layer
-- ============================================================

alter table organizations enable row level security;
alter table user_profiles enable row level security;
alter table org_members enable row level security;
alter table documents enable row level security;
alter table duplicate_flags enable row level security;
alter table extracted_records enable row level security;
alter table chart_of_accounts enable row level security;
alter table ledger_entries enable row level security;
alter table financial_statements enable row level security;
alter table document_search enable row level security;
alter table transaction_search enable row level security;
alter table audit_log enable row level security;

-- Helper: get current user's orgs
create or replace function user_org_ids()
returns setof uuid as $$
  select org_id from org_members where user_id = auth.uid();
$$ language sql security definer stable;

-- Helper: get current user's role in an org
create or replace function user_org_role(p_org_id uuid)
returns org_role as $$
  select role from org_members
  where user_id = auth.uid() and org_id = p_org_id
  limit 1;
$$ language sql security definer stable;

-- Helper: is super admin
create or replace function is_super_admin()
returns boolean as $$
  select coalesce(
    (select is_super_admin from user_profiles where id = auth.uid()),
    false
  );
$$ language sql security definer stable;

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
create policy "Users can view their organizations"
  on organizations for select
  using (id in (select user_org_ids()) or is_super_admin());

create policy "Owners can update their organization"
  on organizations for update
  using (user_org_role(id) = 'owner' or is_super_admin());

-- ============================================================
-- USER PROFILES
-- ============================================================
create policy "Users can view their own profile"
  on user_profiles for select
  using (id = auth.uid() or is_super_admin());

create policy "Users can view profiles of org members"
  on user_profiles for select
  using (
    id in (
      select user_id from org_members
      where org_id in (select user_org_ids())
    )
  );

create policy "Users can update their own profile"
  on user_profiles for update
  using (id = auth.uid());

-- ============================================================
-- ORG MEMBERS
-- ============================================================
create policy "Members can view org membership"
  on org_members for select
  using (org_id in (select user_org_ids()) or is_super_admin());

create policy "Owners and admins can manage members"
  on org_members for all
  using (
    user_org_role(org_id) in ('owner', 'admin') or is_super_admin()
  );

-- ============================================================
-- DOCUMENTS
-- ============================================================
create policy "Members can view documents in their org"
  on documents for select
  using (org_id in (select user_org_ids()) or is_super_admin());

create policy "Non-viewers can upload documents"
  on documents for insert
  with check (
    user_org_role(org_id) in ('owner', 'admin', 'accountant', 'ops')
  );

create policy "Owners, admins, accountants can update documents"
  on documents for update
  using (
    org_id in (select user_org_ids()) and
    user_org_role(org_id) in ('owner', 'admin', 'accountant')
    or is_super_admin()
  );

create policy "Owners and admins can delete documents"
  on documents for delete
  using (
    user_org_role(org_id) in ('owner', 'admin') or is_super_admin()
  );

-- ============================================================
-- DUPLICATE FLAGS
-- ============================================================
create policy "Members can view duplicate flags"
  on duplicate_flags for select
  using (org_id in (select user_org_ids()) or is_super_admin());

create policy "Non-viewers can manage duplicate flags"
  on duplicate_flags for all
  using (
    user_org_role(org_id) in ('owner', 'admin', 'accountant', 'ops')
    or is_super_admin()
  );

-- ============================================================
-- EXTRACTED RECORDS
-- ============================================================
create policy "Members can view extracted records"
  on extracted_records for select
  using (org_id in (select user_org_ids()) or is_super_admin());

create policy "Owners, admins, accountants can manage extracted records"
  on extracted_records for all
  using (
    user_org_role(org_id) in ('owner', 'admin', 'accountant')
    or is_super_admin()
  );

-- ============================================================
-- CHART OF ACCOUNTS
-- ============================================================
create policy "Members can view chart of accounts"
  on chart_of_accounts for select
  using (org_id in (select user_org_ids()) or is_super_admin());

create policy "Owners and admins can manage chart of accounts"
  on chart_of_accounts for all
  using (
    user_org_role(org_id) in ('owner', 'admin') or is_super_admin()
  );

-- ============================================================
-- LEDGER ENTRIES
-- ============================================================
create policy "Members can view ledger entries"
  on ledger_entries for select
  using (org_id in (select user_org_ids()) or is_super_admin());

create policy "Owners, admins, accountants can manage ledger entries"
  on ledger_entries for all
  using (
    user_org_role(org_id) in ('owner', 'admin', 'accountant')
    or is_super_admin()
  );

-- ============================================================
-- FINANCIAL STATEMENTS
-- ============================================================
create policy "Members can view financial statements"
  on financial_statements for select
  using (org_id in (select user_org_ids()) or is_super_admin());

create policy "Owners, admins, accountants can generate statements"
  on financial_statements for all
  using (
    user_org_role(org_id) in ('owner', 'admin', 'accountant')
    or is_super_admin()
  );

-- ============================================================
-- SEARCH
-- ============================================================
create policy "Members can search documents"
  on document_search for select
  using (
    document_id in (
      select id from documents where org_id in (select user_org_ids())
    )
  );

create policy "Members can search transactions"
  on transaction_search for select
  using (
    entry_id in (
      select id from ledger_entries where org_id in (select user_org_ids())
    )
  );

-- ============================================================
-- AUDIT LOG
-- ============================================================
create policy "Members can view their org audit log"
  on audit_log for select
  using (
    (org_id in (select user_org_ids()) and user_org_role(org_id) in ('owner', 'admin'))
    or is_super_admin()
  );

create policy "System can insert audit log entries"
  on audit_log for insert
  with check (true);
