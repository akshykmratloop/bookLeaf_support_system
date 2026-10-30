-- U-11: tickets raised by the workspace's own server through the server API
-- (POST /api/v1/server/tickets) are marked with their own source, so staff can tell them apart.
-- Adding an enum value is metadata-only: no table rewrite, existing rows keep their source.
-- IF NOT EXISTS keeps the step repeatable on a database where it was already applied.
ALTER TYPE "TicketSource" ADD VALUE IF NOT EXISTS 'API';
