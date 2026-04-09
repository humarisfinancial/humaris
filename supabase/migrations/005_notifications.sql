-- ============================================================
-- Migration 005: Notifications (duplicate review reminders)
-- ============================================================

create type notification_type as enum (
  'duplicate_review_reminder',
  'upload_complete',
  'extraction_complete',
  'extraction_failed'
);

create table if not exists notifications (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid references user_profiles(id) on delete cascade,
  type        notification_type not null,
  title       text not null,
  body        text,
  metadata    jsonb not null default '{}',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notifications_org_user on notifications(org_id, user_id);
create index if not exists idx_notifications_read on notifications(read_at) where read_at is null;

alter table notifications enable row level security;

create policy "Users can view their own notifications"
  on notifications for select
  using (user_id = auth.uid() or is_super_admin());

create policy "Users can mark their notifications as read"
  on notifications for update
  using (user_id = auth.uid());

create policy "System can create notifications"
  on notifications for insert
  with check (true);
