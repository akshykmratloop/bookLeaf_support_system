import type { ConversationSummary } from '@bookleaf/shared';
import { MessagesSquare, Phone } from 'lucide-react';
import { Link } from 'react-router';
import { conversationPath, outcomeOf } from '../../lib/conversations';
import { dateTime, relative } from '../../lib/format';
import { Pill } from '../atoms/Pill';

const KIND = {
  CHAT: { label: 'Chat', icon: <MessagesSquare size={16} aria-hidden /> },
  CALL: { label: 'Call', icon: <Phone size={16} aria-hidden /> },
};

/** One past chat or call: what it was about, when, and what came out of it. */
export function ConversationRow({ conversation: c }: { conversation: ConversationSummary }) {
  const kind = KIND[c.kind];
  const outcome = outcomeOf(c);
  return (
    <Link
      to={conversationPath(c)}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-panel-2"
    >
      <span className="text-ink-3" title={kind.label}>
        {kind.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{c.title}</span>
        <span className="block text-[12px] text-ink-3">
          {kind.label} · {dateTime(c.startedAt)} ({relative(c.startedAt)}) · {c.messageCount}{' '}
          {c.messageCount === 1 ? 'message' : 'messages'}
        </span>
      </span>
      {outcome ? <Pill tone={outcome.tone}>{outcome.label}</Pill> : null}
    </Link>
  );
}
