import { syncCustomer } from '../../host/sync.js';
import type { Db } from '../../platform/db.js';
import { NotFoundError } from '../../platform/errors.js';
import { authorIdOf, type Session } from '../auth/session.js';
import type { TicketDeps } from '../tickets/deps.js';

/**
 * The server API names customers and items by the product's own ids. Writes then run as that
 * customer (role AUTHOR, never staff), so the normal ticket rules apply to them unchanged.
 */
const authorBy = (db: Db, where: { workspaceId: string; externalId: string } | { id: string }) =>
  db.author.findFirst({ where, include: { user: { select: { name: true, email: true } } } });

type AuthorRow = NonNullable<Awaited<ReturnType<typeof authorBy>>>;

const asSession = (a: AuthorRow): Session => ({
  userId: a.userId,
  workspaceId: a.workspaceId,
  role: 'AUTHOR',
  authorId: a.id,
  name: a.user.name,
  email: a.user.email,
});

/** Reads the customer from the product and keeps the reference rows (as host sign-in does). */
async function refresh(deps: TicketDeps, workspaceId: string, customerId: string) {
  // Unknown to the product → CustomerNotFoundError (404); product down → HostUnavailableError (503).
  const customer = await deps.records.customer(customerId, workspaceId);
  await syncCustomer(deps.db, workspaceId, customer);
  const row = await authorBy(deps.db, { workspaceId, externalId: customerId });
  if (!row) throw new NotFoundError('Customer');
  return row;
}

/** The customer as a session; a customer support has not seen yet is read from the product. */
export async function customerSession(
  deps: TicketDeps,
  workspaceId: string,
  customerId: string,
): Promise<Session> {
  const known = await authorBy(deps.db, { workspaceId, externalId: customerId });
  return asSession(known ?? (await refresh(deps, workspaceId, customerId)));
}

/** The session of the customer who owns a ticket (the ticket is already checked to be this workspace's). */
export async function ticketOwnerSession(db: Db, authorId: string): Promise<Session> {
  const row = await authorBy(db, { id: authorId });
  if (!row) throw new NotFoundError('Customer');
  return asSession(row);
}

/** Support's id for one of the customer's items; refreshed once from the product if it is new. */
export async function itemOf(
  deps: TicketDeps,
  session: Session,
  customerId: string,
  itemId: string | null,
): Promise<string | null> {
  if (!itemId) return null;
  const where = { workspaceId: session.workspaceId, externalId: itemId };
  const find = () =>
    deps.db.book.findFirst({
      where: { ...where, authorId: authorIdOf(session) },
      select: { id: true },
    });
  let found = await find();
  if (!found) {
    await refresh(deps, session.workspaceId, customerId);
    found = await find();
  }
  if (!found) throw new NotFoundError('Item');
  return found.id;
}

/** Support's id for a customer of this workspace, or 404 when support has no record of them. */
export async function knownCustomerId(db: Db, workspaceId: string, customerId: string) {
  const row = await authorBy(db, { workspaceId, externalId: customerId });
  if (!row) throw new NotFoundError('Customer');
  return row.id;
}
