-- U-12: what the "Get started" setup guide needs to tick two of its steps from real events.
-- `last_hand_over_at`: the last time the workspace's product handed a customer over with a valid
-- token. `last_widget_load_at` / `last_widget_origin`: the last time the widget page was framed
-- by one of the workspace's allowed sites, and which one. Written at most once a minute.
--
-- Three nullable columns with no default on "workspaces": metadata only in PostgreSQL 11+, no
-- table rewrite, quick on a populated table and an empty one. The table's row-level security
-- policy (own row only) and the app role's table grants already cover new columns.
-- Rollback: nothing reads these columns except the setup guide; dropping them loses only the
-- two ticks (`ALTER TABLE "workspaces" DROP COLUMN ...`), or restore the pre-deploy backup.

ALTER TABLE "workspaces" ADD COLUMN "last_hand_over_at" TIMESTAMPTZ(3);
ALTER TABLE "workspaces" ADD COLUMN "last_widget_load_at" TIMESTAMPTZ(3);
ALTER TABLE "workspaces" ADD COLUMN "last_widget_origin" TEXT;
