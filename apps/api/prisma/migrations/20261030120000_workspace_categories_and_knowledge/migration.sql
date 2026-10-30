-- S.9: per-workspace ticket categories and knowledge base (expand + backfill).
-- Before: one fixed TicketCategory enum for every workspace, and BookLeaf's knowledge base in code.
-- After: each workspace has its own ticket_categories (key, label, AI description, default priority,
-- SLA hours, order, active) and knowledge_articles linked to categories by key.
-- Tickets and ticket drafts gain category_key (a foreign key to the workspace's own category).
--
-- Expand → backfill → contract (§17): the old enum columns ("category") stay untouched and are
-- simply no longer used by the code. A later release drops them and the TicketCategory enum.
-- Nothing is dropped or rewritten here; new columns are nullable with no default (metadata only).
-- Works on an empty database and on a populated one; every insert is idempotent.
-- The knowledge-base articles themselves are written by the seed (deploy/up.sh runs it after
-- migrating), so their text lives in one place: apps/api/src/modules/categories/bookleaf-knowledge.ts.
-- Rollback: the old code still reads the untouched enum columns; or restore the pre-deploy backup.

-- 1. Expand: new tables.
CREATE TABLE "ticket_categories" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "default_priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "sla_hours" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ticket_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "knowledge_articles" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "knowledge_articles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "knowledge_article_categories" (
    "workspace_id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "category_key" TEXT NOT NULL,

    CONSTRAINT "knowledge_article_categories_pkey" PRIMARY KEY ("article_id","category_key")
);

CREATE INDEX "ticket_categories_workspace_id_position_idx" ON "ticket_categories"("workspace_id", "position");
CREATE UNIQUE INDEX "ticket_categories_workspace_id_key_key" ON "ticket_categories"("workspace_id", "key");
CREATE INDEX "knowledge_articles_workspace_id_position_idx" ON "knowledge_articles"("workspace_id", "position");
CREATE UNIQUE INDEX "knowledge_articles_workspace_id_id_key" ON "knowledge_articles"("workspace_id", "id");
CREATE INDEX "knowledge_article_categories_workspace_id_category_key_idx" ON "knowledge_article_categories"("workspace_id", "category_key");

ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_article_categories" ADD CONSTRAINT "knowledge_article_categories_workspace_id_article_id_fkey" FOREIGN KEY ("workspace_id", "article_id") REFERENCES "knowledge_articles"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_article_categories" ADD CONSTRAINT "knowledge_article_categories_workspace_id_category_key_fkey" FOREIGN KEY ("workspace_id", "category_key") REFERENCES "ticket_categories"("workspace_id", "key") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- 2. Expand: the new link columns (nullable, no default: no table rewrite).
ALTER TABLE "tickets" ADD COLUMN "category_key" TEXT;
ALTER TABLE "ticket_drafts" ADD COLUMN "category_key" TEXT;

-- 3. Backfill categories. Same definitions as BOOKLEAF_CATEGORIES in
--    apps/api/src/modules/categories/bookleaf-knowledge.ts (the seed upserts them create-only).
--    The default workspace (BookLeaf) gets all six. Every other existing workspace gets
--    GENERAL_INQUIRY plus each old category its tickets or drafts already use, so no ticket loses
--    its category and those workspaces triage exactly as before until their admins edit the list.
WITH defs ("key", "label", "description", "default_priority", "position") AS (
  VALUES
    ('ROYALTY_PAYMENTS', 'Royalty & Payments',
     'royalty amounts, missing or late payouts, payout dates, royalty calculation, bank transfer of royalties.',
     'MEDIUM', 0),
    ('ISBN_METADATA', 'ISBN & Metadata Issues',
     'wrong, duplicate or mismatched ISBN; book metadata such as title, description, author name, price shown on a platform.',
     'HIGH', 1),
    ('PRINTING_QUALITY', 'Printing & Quality',
     'physical print defects (blurry images, misaligned pages, binding, colour), author copies, reprints, print turnaround.',
     'MEDIUM', 2),
    ('DISTRIBUTION_AVAILABILITY', 'Distribution & Availability',
     'book missing, "currently unavailable" or not listed on Amazon India, Flipkart, Amazon US, Amazon UK or the BookLeaf Store.',
     'MEDIUM', 3),
    ('BOOK_STATUS_PRODUCTION', 'Book Status & Production Updates',
     'where a not-yet-published book is in production (editing, cover design, typesetting, proofreading, ISBN assignment, printing, distribution setup) and when it will be done.',
     'MEDIUM', 4),
    ('GENERAL_INQUIRY', 'General Inquiry',
     'anything else (packages, account, bio, how-to questions).',
     'LOW', 5)
)
INSERT INTO "ticket_categories"
  ("id", "workspace_id", "key", "label", "description", "default_priority", "position", "updated_at")
SELECT gen_random_uuid(), w."id", d."key", d."label", d."description",
       d."default_priority"::"Priority", d."position", CURRENT_TIMESTAMP
FROM "workspaces" w
CROSS JOIN defs d
WHERE w."is_default"
   OR d."key" = 'GENERAL_INQUIRY'
   OR EXISTS (SELECT 1 FROM "tickets" t
              WHERE t."workspace_id" = w."id" AND t."category"::TEXT = d."key")
   OR EXISTS (SELECT 1 FROM "ticket_drafts" td
              WHERE td."workspace_id" = w."id" AND td."category"::TEXT = d."key")
ON CONFLICT ("workspace_id", "key") DO NOTHING;

-- 4. Backfill the link columns from the old enum (same key text).
UPDATE "tickets" SET "category_key" = "category"::TEXT
WHERE "category" IS NOT NULL AND "category_key" IS NULL;
UPDATE "ticket_drafts" SET "category_key" = "category"::TEXT
WHERE "category" IS NOT NULL AND "category_key" IS NULL;

-- 5. Constrain: a ticket or draft can only point at a category of its own workspace.
CREATE INDEX "tickets_workspace_id_category_key_idx" ON "tickets"("workspace_id", "category_key");
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_workspace_id_category_key_fkey" FOREIGN KEY ("workspace_id", "category_key") REFERENCES "ticket_categories"("workspace_id", "key") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ticket_drafts" ADD CONSTRAINT "ticket_drafts_workspace_id_category_key_fkey" FOREIGN KEY ("workspace_id", "category_key") REFERENCES "ticket_categories"("workspace_id", "key") ON DELETE RESTRICT ON UPDATE RESTRICT;
