-- Sprint 7: search_vector columns for full-text search, maintained by triggers.
-- Generated columns were dropped due to Supabase immutability restrictions.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION update_document_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('pg_catalog.english',
    coalesce(NEW.renamed_name, '') || ' ' ||
    coalesce(NEW.original_name, '') || ' ' ||
    coalesce(NEW.doc_type::text, '') || ' ' ||
    coalesce(NEW.folder::text, ''));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_ledger_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('pg_catalog.english',
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.category, ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER documents_search_vector_update
  BEFORE INSERT OR UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_document_search_vector();

CREATE TRIGGER ledger_entries_search_vector_update
  BEFORE INSERT OR UPDATE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION update_ledger_search_vector();

CREATE INDEX IF NOT EXISTS idx_documents_search_vector
  ON documents USING gin(search_vector);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_search_vector
  ON ledger_entries USING gin(search_vector);
