import type { AuthUser } from '@bookleaf/shared';
import { History, LifeBuoy, MessageCircle, TicketPlus } from 'lucide-react';
import { useOutletContext } from 'react-router';
import { ConversationRow } from '../../components/molecules/ConversationRow';
import { QuickAction } from '../../components/molecules/QuickAction';
import { SectionHeader } from '../../components/molecules/SectionHeader';
import { TicketCard } from '../../components/molecules/TicketCard';
import { HomeGreeting } from '../../components/organisms/HomeGreeting';
import { useAssistantAvailability } from '../../lib/assistant';
import { useConversations } from '../../lib/conversations';
import { authorPaths } from '../../lib/paths';
import { useAuthorTickets } from '../../lib/queries';

const RECENT = 3;

function TicketsSection() {
  const tickets = useAuthorTickets().data?.items ?? [];
  const waiting = tickets.filter((t) => t.awaitingYou).slice(0, RECENT);
  const recent = tickets.filter((t) => !t.awaitingYou).slice(0, RECENT);
  if (tickets.length === 0) return null;
  return (
    <>
      {waiting.length ? (
        <section aria-label="Needs your reply">
          <SectionHeader title="Needs your reply" to={authorPaths.tickets} />
          <div className="grid gap-3 lg:grid-cols-2">
            {waiting.map((t) => (
              <TicketCard key={t.id} ticket={t} />
            ))}
          </div>
        </section>
      ) : null}
      {recent.length ? (
        <section aria-label="Recent tickets">
          <SectionHeader title="Recent tickets" to={authorPaths.tickets} />
          <div className="grid gap-3 lg:grid-cols-2">
            {recent.map((t) => (
              <TicketCard key={t.id} ticket={t} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function ConversationsSection() {
  const items = useConversations().data?.pages[0]?.items.slice(0, RECENT) ?? [];
  if (items.length === 0) return null;
  return (
    <section aria-label="Recent conversations">
      <SectionHeader title="Recent conversations" to={authorPaths.history} />
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-panel shadow-soft">
        {items.map((c) => (
          <li key={`${c.kind}-${c.id}`}>
            <ConversationRow conversation={c} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The widget's first screen: ask, act, and see what is waiting. */
export function EmbedHomePage() {
  const user = useOutletContext<AuthUser>();
  const chat = useAssistantAvailability().data?.chat.state;
  return (
    <div className="flex flex-col gap-6">
      <HomeGreeting name={user.name} canAsk={chat === 'AVAILABLE'} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <QuickAction
          to={authorPaths.ask}
          title="Ask BookLeaf"
          body="Chat or call for an instant answer."
          Icon={MessageCircle}
          colors="bg-brand-soft text-brand-ink"
        />
        <QuickAction
          to={authorPaths.newTicket}
          title="Raise a ticket"
          body="The support team replies here."
          Icon={TicketPlus}
          colors="bg-accent-soft text-warning"
        />
        <QuickAction
          to={authorPaths.tickets}
          title="Your tickets"
          body="Follow and reply to your requests."
          Icon={LifeBuoy}
          colors="bg-info-bg text-info"
        />
        <QuickAction
          to={authorPaths.history}
          title="Past conversations"
          body="Every chat and call, read-only."
          Icon={History}
          colors="bg-cat-isbn-bg text-cat-isbn"
        />
      </div>
      <TicketsSection />
      <ConversationsSection />
    </div>
  );
}
