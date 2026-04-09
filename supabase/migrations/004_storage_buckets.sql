-- ============================================================
-- Migration 004: Storage Buckets
-- ============================================================

-- Main document storage (renamed, processed files)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'financial-documents',
  'financial-documents',
  false,
  52428800,  -- 50MB
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
) on conflict (id) do nothing;

-- Original file archive (unmodified copies)
insert into storage.buckets (id, name, public, file_size_limit)
values (
  'original-uploads',
  'original-uploads',
  false,
  52428800  -- 50MB
) on conflict (id) do nothing;

-- RLS: only org members can access their own files
-- Storage paths follow pattern: {org_id}/{filename}

create policy "Org members can read their documents"
  on storage.objects for select
  using (
    bucket_id = 'financial-documents' and
    (storage.foldername(name))[1] in (
      select org_id::text from org_members where user_id = auth.uid()
    )
  );

create policy "Non-viewer members can upload documents"
  on storage.objects for insert
  with check (
    bucket_id = 'financial-documents' and
    (storage.foldername(name))[1] in (
      select om.org_id::text from org_members om
      where om.user_id = auth.uid()
      and om.role in ('owner', 'admin', 'accountant', 'ops')
    )
  );

create policy "Owners and admins can delete documents"
  on storage.objects for delete
  using (
    bucket_id = 'financial-documents' and
    (storage.foldername(name))[1] in (
      select om.org_id::text from org_members om
      where om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
    )
  );

create policy "Org members can read their original uploads"
  on storage.objects for select
  using (
    bucket_id = 'original-uploads' and
    (storage.foldername(name))[1] in (
      select org_id::text from org_members where user_id = auth.uid()
    )
  );

create policy "Non-viewer members can save originals"
  on storage.objects for insert
  with check (
    bucket_id = 'original-uploads' and
    (storage.foldername(name))[1] in (
      select om.org_id::text from org_members om
      where om.user_id = auth.uid()
      and om.role in ('owner', 'admin', 'accountant', 'ops')
    )
  );
