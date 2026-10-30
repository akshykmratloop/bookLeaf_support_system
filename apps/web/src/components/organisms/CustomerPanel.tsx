import type { TicketCustomer } from '@bookleaf/shared';
import { CloudOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { errorMessage } from '../../lib/api';
import { itemsHeading, useTicketCustomer } from '../../lib/ticketCustomer';
import { Avatar } from '../atoms/Avatar';
import { Card } from '../atoms/Card';
import { Skeleton } from '../atoms/Skeleton';
import { CustomerItemList } from '../molecules/CustomerItemList';
import { CustomerLines } from '../molecules/CustomerLines';
import { CUSTOMER_PANEL_FIXTURE } from '../molecules/CustomerPanelFixture';
import { CustomerTickets } from '../molecules/CustomerTickets';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <h3 className="text-[11.5px] font-semibold text-ink-3 uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Profile({ c }: { c: TicketCustomer }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={c.name} />
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold">{c.name}</p>
        <p className="truncate text-[12.5px] text-ink-2">{c.email}</p>
        <p className="truncate font-mono text-[11px] text-ink-3">ID {c.externalId}</p>
      </div>
    </div>
  );
}

function RecordsUnavailable() {
  return (
    <p className="flex items-start gap-2 rounded-control bg-warning-bg px-2.5 py-2 text-[12px] text-warning">
      <CloudOff size={14} aria-hidden className="mt-0.5 shrink-0" />
      The product is not answering right now, so the customer record cannot be shown.
    </p>
  );
}

function CustomerBody({ c }: { c: TicketCustomer }) {
  return (
    <div className="flex flex-col gap-4">
      <Profile c={c} />
      {c.recordsAvailable ? null : <RecordsUnavailable />}
      {c.account.length ? (
        <Section title="Account">
          <CustomerLines lines={c.account} />
        </Section>
      ) : null}
      {c.items.length ? (
        <Section title={itemsHeading(c.itemNoun, c.items.length)}>
          <CustomerItemList items={c.items} />
        </Section>
      ) : null}
      <Section title={`Other tickets (${c.otherTicketsTotal})`}>
        <CustomerTickets tickets={c.otherTickets} total={c.otherTicketsTotal} />
      </Section>
    </div>
  );
}

/**
 * Who raised the ticket (U-1): profile and record lines from the customer record, labelled by
 * the workspace's customer data fields, and the customer's other tickets in this workspace.
 */
export function CustomerPanel({ ticketId }: { ticketId: string }) {
  const customer = useTicketCustomer(ticketId);
  return (
    <Card className="flex flex-col gap-3 p-4" role="region" aria-label="Customer">
      <h2 className="text-[11.5px] font-semibold text-ink-3 uppercase">Customer</h2>
      {customer.isError ? (
        <p role="alert" className="text-[12.5px] text-danger">
          {errorMessage(customer.error)}
        </p>
      ) : (
        <Skeleton
          name="customer-panel"
          loading={customer.isPending}
          fixture={<CustomerBody c={CUSTOMER_PANEL_FIXTURE} />}
        >
          {customer.data ? <CustomerBody c={customer.data} /> : null}
        </Skeleton>
      )}
    </Card>
  );
}
