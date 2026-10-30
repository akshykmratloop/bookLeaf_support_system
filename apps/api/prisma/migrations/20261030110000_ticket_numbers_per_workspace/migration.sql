-- F-13: ticket numbers per workspace (Zendesk/Jira style).
-- Before: one global SERIAL for every workspace, shown as BL-(1000 + n), so a workspace could read
-- the platform's ticket volume from its own numbers.
-- After: each workspace has its own counter (next_ticket_number, from 1001) and a fixed prefix that
-- is unique across the platform (BookLeaf = BL; others from their names; BL → BL2 → BL3 if taken).
-- tickets.number now stores the real number (1001+) and is unique per workspace only.
--
-- Data: BookLeaf keeps every label it has shown (number + 1000, so BL-1001 stays BL-1001). Other
-- workspaces renumber from 1001 in created_at order. Every counter is set to max + 1 (or 1001).
-- Nothing is dropped except the global sequence and its unique index, which the new code replaces;
-- the number column and all its values stay. Works on an empty database and on a populated one.
-- Rollback: restore the pre-deploy backup (deploy/up.sh takes one before migrating).

-- 1. Expand: the counter (constant default, metadata-only) and the prefix (filled below).
ALTER TABLE "workspaces" ADD COLUMN "next_ticket_number" INTEGER NOT NULL DEFAULT 1001;
ALTER TABLE "workspaces" ADD COLUMN "ticket_prefix" TEXT;

-- 2. Backfill prefixes, the default workspace (BookLeaf) first so it keeps BL. Same rule as
--    apps/api/src/modules/workspaces/ticket-prefix.ts: initials of a multi-word name, the capitals
--    of a one-word name (else its first two letters), 2-5 letters, fallback TKT, then the first
--    free numeric suffix.
DO $$
DECLARE
  ws RECORD;
  words TEXT[];
  letters TEXT;
  base TEXT;
  candidate TEXT;
  n INTEGER;
BEGIN
  FOR ws IN SELECT "id", "name", "is_default" FROM "workspaces"
            ORDER BY "is_default" DESC, "created_at", "id" LOOP
    IF ws."is_default" THEN
      base := 'BL';
    ELSE
      words := ARRAY(
        SELECT t.m[1]
        FROM regexp_matches(
          regexp_replace(normalize(ws."name", NFKD), '[̀-ͯ]', '', 'g'),
          '([A-Za-z]+)', 'g'
        ) WITH ORDINALITY AS t(m, i)
        ORDER BY t.i
      );
      IF cardinality(words) > 1 THEN
        letters := array_to_string(
          ARRAY(SELECT left(w.word, 1) FROM unnest(words) WITH ORDINALITY AS w(word, i) ORDER BY w.i),
          ''
        );
      ELSIF cardinality(words) = 1 THEN
        letters := regexp_replace(words[1], '[^A-Z]', '', 'g');
        IF length(letters) < 2 THEN
          letters := left(words[1], 2);
        END IF;
      ELSE
        letters := '';
      END IF;
      base := left(upper(letters), 5);
      IF length(base) < 2 THEN
        base := 'TKT';
      END IF;
    END IF;
    candidate := base;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM "workspaces" WHERE "ticket_prefix" = candidate) LOOP
      n := n + 1;
      candidate := base || n::TEXT;
    END LOOP;
    UPDATE "workspaces" SET "ticket_prefix" = candidate WHERE "id" = ws."id";
  END LOOP;
END
$$;

ALTER TABLE "workspaces" ALTER COLUMN "ticket_prefix" SET NOT NULL;
CREATE UNIQUE INDEX "workspaces_ticket_prefix_key" ON "workspaces"("ticket_prefix");

-- 3. Tickets: retire the global sequence and its unique index (the app now takes numbers from the
--    workspace counter inside the ticket's transaction).
DROP INDEX "tickets_number_key";
ALTER TABLE "tickets" ALTER COLUMN "number" DROP DEFAULT;
DROP SEQUENCE IF EXISTS "tickets_number_seq";

-- 4. BookLeaf keeps its labels: the stored number becomes the shown one (1 → 1001 = BL-1001).
UPDATE "tickets" AS t
SET "number" = t."number" + 1000
FROM "workspaces" AS w
WHERE w."id" = t."workspace_id" AND w."is_default";

-- 5. Every other workspace numbers its own tickets from 1001, oldest first.
UPDATE "tickets" AS t
SET "number" = 1000 + r.rn
FROM (
  SELECT t2."id",
         row_number() OVER (PARTITION BY t2."workspace_id" ORDER BY t2."created_at", t2."id") AS rn
  FROM "tickets" AS t2
  JOIN "workspaces" AS w ON w."id" = t2."workspace_id"
  WHERE NOT w."is_default"
) AS r
WHERE t."id" = r."id";

CREATE UNIQUE INDEX "tickets_workspace_id_number_key" ON "tickets"("workspace_id", "number");

-- 6. Each counter continues after the workspace's highest number.
UPDATE "workspaces" AS w
SET "next_ticket_number" = GREATEST(
  1001,
  COALESCE((SELECT max(t."number") + 1 FROM "tickets" AS t WHERE t."workspace_id" = w."id"), 1001)
);
