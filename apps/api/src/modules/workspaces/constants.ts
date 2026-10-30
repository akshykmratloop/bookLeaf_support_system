/**
 * The default workspace: today's single-tenant BookLeaf setup. The migration creates it with
 * this fixed id and backfills every existing row to it; the connector registry falls back to
 * the `HOST_*` env settings for it while it has no connector row of its own.
 */
export const DEFAULT_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
export const DEFAULT_WORKSPACE_SLUG = 'bookleaf';
export const DEFAULT_WORKSPACE_NAME = 'BookLeaf Publishing';
/** BookLeaf's ticket prefix: its labels (BL-1001…) stay as they were before F-13. */
export const DEFAULT_TICKET_PREFIX = 'BL';
