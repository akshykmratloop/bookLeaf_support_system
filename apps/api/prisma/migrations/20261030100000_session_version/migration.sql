-- F-12 part 2: ending sessions early.
-- Every session token carries the user's session version; the auth guard refuses a token whose
-- version is not the current one. Logout bumps the version in the app. A password change and
-- removal from a workspace bump it here, in the database, so every path that makes those changes
-- (today: an operator's SQL; later: the member and password screens) ends the user's sessions.
-- Expand only: one new column with a constant default and two triggers. Nothing is dropped.
-- Tokens issued before this migration have no version and are refused: everyone signs in again once.

-- 1. The version (constant default: metadata-only on Postgres 11+, no table rewrite).
ALTER TABLE "users" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 1;

-- 2. A new password ends every session issued with the old one.
CREATE OR REPLACE FUNCTION "end_sessions_on_password_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."password_hash" IS DISTINCT FROM OLD."password_hash" THEN
    NEW."session_version" := GREATEST(NEW."session_version", OLD."session_version" + 1);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "users_password_change_ends_sessions" ON "users";
CREATE TRIGGER "users_password_change_ends_sessions"
  BEFORE UPDATE OF "password_hash" ON "users"
  FOR EACH ROW EXECUTE FUNCTION "end_sessions_on_password_change"();

-- 3. Removal from a workspace (a workspace_members row deleted) ends the member's sessions.
CREATE OR REPLACE FUNCTION "end_sessions_on_member_removal"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "users" SET "session_version" = "session_version" + 1 WHERE "id" = OLD."user_id";
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS "workspace_members_removal_ends_sessions" ON "workspace_members";
CREATE TRIGGER "workspace_members_removal_ends_sessions"
  AFTER DELETE ON "workspace_members"
  FOR EACH ROW EXECUTE FUNCTION "end_sessions_on_member_removal"();
