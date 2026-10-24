-- Enable trigram matching for substring/fuzzy search over audit payloads.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Denormalized, DB-computed search surface over the audit payload.
-- STORED generated column: Postgres populates it automatically on every
-- insert/update from the row's own columns. NO application code writes it.
-- Declared in schema.prisma only as a plain optional String for query access;
-- Prisma cannot express GENERATED ALWAYS AS ... STORED, so this column and its
-- index are Prisma-UNMANAGED. Do NOT run `prisma migrate dev` (it would author a
-- spurious DROP). This project uses `prisma migrate deploy` (checksum replay),
-- which leaves both intact.
ALTER TABLE "AuditLog"
  ADD COLUMN "searchText" text
  GENERATED ALWAYS AS (
    coalesce("entityId", '') || ' ' ||
    coalesce("actorId", '') || ' ' ||
    coalesce("before"::text, '') || ' ' ||
    coalesce("after"::text, '') || ' ' ||
    coalesce("metadata"::text, '')
  ) STORED;

-- Trigram GIN index: accelerates ILIKE '%fragment%' over the search surface
-- (partial email, partial coupon code, order-number fragment).
CREATE INDEX "idx_auditlog_search_trgm"
  ON "AuditLog"
  USING GIN ("searchText" gin_trgm_ops);
