import { SETUP_TEST_CUSTOMER_ID, type OnboardingTestTicket } from '@bookleaf/shared';
import { syncCustomer } from '../../host/sync.js';
import type { Session } from '../auth/session.js';
import { createTicket } from '../tickets/create.js';
import type { TicketDeps } from '../tickets/deps.js';
import { labelOf, TICKET_LABEL_SELECT } from '../tickets/ticket-ref.js';

/**
 * "Send a test ticket" (U-12): a real ticket, raised through the same code as the widget's, so
 * triage, the queue, live updates and webhooks all run. It belongs to a fixed test customer that
 * support creates itself (never read from the product), and it never ticks "Test it": only a
 * ticket from a real customer does.
 */
const TEST_CUSTOMER = {
  id: SETUP_TEST_CUSTOMER_ID,
  name: 'Setup test',
  /** A reserved domain (RFC 2606): nothing is ever sent there. */
  email: 'setup-test@example.invalid',
  items: [],
  facts: [],
  details: [],
};

const SUBJECT = 'Test ticket from the setup guide';
const DESCRIPTION =
  'This ticket was sent from "Get started" to check that tickets reach your queue. You can solve it.';

export async function sendTestTicket(
  deps: TicketDeps,
  admin: Session,
): Promise<OnboardingTestTicket> {
  const { workspaceId } = admin;
  const ids = await syncCustomer(deps.db, workspaceId, TEST_CUSTOMER);
  const customer: Session = {
    userId: ids.userId,
    workspaceId,
    role: 'AUTHOR',
    authorId: ids.authorId,
    name: TEST_CUSTOMER.name,
    email: TEST_CUSTOMER.email,
  };
  const { ticket } = await createTicket(
    deps,
    customer,
    { bookId: null, subject: SUBJECT, description: DESCRIPTION },
    { idempotencyKey: null },
  );
  const row = await deps.db.ticket.findUniqueOrThrow({
    where: { id: ticket.id },
    select: { id: true, createdAt: true, ...TICKET_LABEL_SELECT },
  });
  return { id: row.id, label: labelOf(row), createdAt: row.createdAt.toISOString() };
}
