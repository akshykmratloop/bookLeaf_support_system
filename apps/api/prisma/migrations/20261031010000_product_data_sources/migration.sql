-- U-9: flexible product connection (expand + backfill).
-- Before: one endpoint per workspace, `{base_url}/support/customers/{id}`, in the fixed customer
-- shape. After: one to five data sources per workspace (`workspace_data_sources`), each a GET URL
-- template with {id}/{email}; MAPPED sources are read through paths saved on the Customer data page
-- (`customer_fields.source_id` + `path`, and `workspace_connectors.record_mapping` for name, email
-- and the item list).
--
-- Expand → backfill → contract (§17): `workspace_connectors.base_url` stays (now nullable, a
-- metadata-only change) and is no longer read once its data source exists; a later release drops
-- it. New columns are nullable with no default (no table rewrite). Every insert is idempotent, so
-- the migration works on an empty database and on a populated one.
-- The default workspace (BookLeaf) on server settings (HOST_API_URL, no connector row) needs no
-- row: the API builds the same CONTRACT source from env, so it keeps working unchanged.
-- Rollback: the old code reads the untouched base_url column; or restore the pre-deploy backup.

-- 1. Expand: the data-source format and table.
CREATE TYPE "DataSourceFormat" AS ENUM ('CONTRACT', 'MAPPED');

CREATE TABLE "workspace_data_sources" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "url_template" TEXT NOT NULL,
    "format" "DataSourceFormat" NOT NULL DEFAULT 'MAPPED',
    "auth_header" TEXT,
    "timeout_ms" INTEGER NOT NULL DEFAULT 3000,
    "cache_seconds" INTEGER NOT NULL DEFAULT 60,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workspace_data_sources_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workspace_data_sources_workspace_id_position_idx" ON "workspace_data_sources"("workspace_id", "position");

ALTER TABLE "workspace_data_sources" ADD CONSTRAINT "workspace_data_sources_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Expand: mapping columns (nullable, no default: metadata only).
ALTER TABLE "workspace_connectors" ADD COLUMN "record_mapping" JSONB;
ALTER TABLE "workspace_connectors" ALTER COLUMN "base_url" DROP NOT NULL;
ALTER TABLE "customer_fields" ADD COLUMN "source_id" UUID;
ALTER TABLE "customer_fields" ADD COLUMN "path" TEXT;

ALTER TABLE "customer_fields" ADD CONSTRAINT "customer_fields_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "workspace_data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Backfill: every saved connector becomes its first data source, the same endpoint in the same
--    fixed shape, with its own timeout and cache. Only for connectors with no source yet.
INSERT INTO "workspace_data_sources"
  ("id", "workspace_id", "name", "url_template", "format", "auth_header",
   "timeout_ms", "cache_seconds", "position", "created_at", "updated_at")
SELECT gen_random_uuid(), c."workspace_id", 'Customer',
       rtrim(c."base_url", '/') || '/support/customers/{id}', 'CONTRACT', NULL,
       c."timeout_ms", c."cache_seconds", 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "workspace_connectors" c
WHERE c."base_url" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "workspace_data_sources" s WHERE s."workspace_id" = c."workspace_id");

-- 4. Row-level security (S.8), same policy as every other tenant table. The app role's grants
--    come from the default privileges `pnpm db:roles` sets up, so this table is covered already.
ALTER TABLE "workspace_data_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_data_sources" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_isolation" ON "workspace_data_sources";
CREATE POLICY "workspace_isolation" ON "workspace_data_sources"
  USING ("workspace_id" = "app_current_workspace_id"())
  WITH CHECK ("workspace_id" = "app_current_workspace_id"());
