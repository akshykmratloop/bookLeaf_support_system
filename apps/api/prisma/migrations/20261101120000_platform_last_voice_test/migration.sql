-- The console's last voice "Test connection" result, next to the AI one. Additive only: three
-- nullable columns, no default, no table rewrite (metadata-only on PostgreSQL 11+).
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "last_voice_test_at" TIMESTAMPTZ(3);
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "last_voice_test_ok" BOOLEAN;
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "last_voice_test_detail" TEXT;
