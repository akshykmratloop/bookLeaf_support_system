-- The console's last AI "Test connection" result, kept in the database so it survives restarts and
-- is the same on every copy of the API. Additive only: three nullable columns, no default, no
-- table rewrite (metadata-only on PostgreSQL 11+).
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "last_test_at" TIMESTAMPTZ(3);
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "last_test_ok" BOOLEAN;
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "last_test_detail" TEXT;
