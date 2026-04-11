-- Sprint 7: Add generated tsvector columns for full-text search.
-- These are auto-maintained by Postgres on every insert/update.
-- No separate indexing pipeline required.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(renamed_name, '') || ' ' ||
      coalesce(original_name, '') || ' ' ||
      coalesce(doc_type, '') || ' ' ||
      coalesce(folder, ''))
  ) STORED;

ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(description, '') || ' ' ||
      coalesce(category, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_documents_search_vector
  ON documents USING gin(search_vector);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_search_vector
  ON ledger_entries USING gin(search_vector);
