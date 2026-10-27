import type { ConversationSummary } from '@bookleaf/shared';
import { ChevronRight, MessagesSquare, Phone } from 'lucide-react';
import { Link } from 'react-router';
import { conversationPath, outcomeOf } from '../../lib/conversations';
import { relative } from '../../lib/format';
import { Pill } from '../atoms/Pill';

const KIND = {
  CHAT: { label: 'Chat', Icon: MessagesSquare, colors: 'bg-brand-soft text-brand-ink' },
  CALL: { label: 'Call', Icon: Phone, colors: 'bg-info-bg text-info' },
};

const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

/** One past chat or call: what it was about, when, and what came out of it. */
export function ConversationRow({ conversation: c }: { conversation: ConversationSummary }) {
  const kind = KIND[c.kind];
  const outcome = outcomeOf(c);
  return (
    <Link
      to={conversationPath(c)}
      className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-panel-2"
    >
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-control ${kind.colors}`}>
        <kind.Icon size={18} aria-label={kind.label} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold group-hover:text-brand-ink">
          {c.title}
        </span>
        <span className="block text-[12px] text-ink-3" title={relative(c.startedAt)}>
          {kind.label} · {TIME.format(new Date(c.startedAt))} · {c.messageCount}{' '}
          {c.messageCount === 1 ? 'message' : 'messages'}
        </span>
      </span>
      {outcome ? <Pill tone={outcome.tone}>{outcome.label}</Pill> : null}
      <ChevronRight size={16} aria-hidden className="shrink-0 text-ink-3" />
    </Link>
  );
}
