-- F-12 part 1: a staff email has exactly one account on the whole platform.
-- `users.login_email` holds the email (trimmed, lowercased) for staff (password) accounts only;
-- authors keep it NULL, so the same author email can still exist in several workspaces.
-- Expand only: a new nullable column, a backfill and a unique index. Nothing is dropped.
--
-- 1. Stop before changing anything if a staff email already has accounts in two workspaces:
--    there is no safe automatic choice, a person must decide which account to keep.
DO $$
DECLARE
  duplicate TEXT;
BEGIN
  SELECT lower(btrim("email")) INTO duplicate
  FROM "users"
  WHERE "password_hash" IS NOT NULL
  GROUP BY lower(btrim("email"))
  HAVING count(*) > 1
  ORDER BY 1
  LIMIT 1;
  IF duplicate IS NOT NULL THEN
    RAISE EXCEPTION 'F-12 staff_login_email: the staff email "%" has a password account in more than one workspace. Keep one account (delete or rename the others, e.g. change their email), then run the migration again.', duplicate;
  END IF;
END $$;

-- 2. The new column (nullable, no default: a metadata-only change on Postgres 11+).
ALTER TABLE "users" ADD COLUMN "login_email" TEXT;

-- 3. Backfill staff accounts only.
UPDATE "users"
SET "login_email" = lower(btrim("email"))
WHERE "password_hash" IS NOT NULL;

-- 4. One account per login email (NULLs are distinct, so authors are unaffected).
CREATE UNIQUE INDEX "users_login_email_key" ON "users"("login_email");
