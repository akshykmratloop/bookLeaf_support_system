import type { TicketMessage } from '@bookleaf/shared';
import { Lock } from 'lucide-react';
import { dateTime } from '../../lib/format';

const STYLE: Record<TicketMessage['kind'], string> = {
  AUTHOR: 'border-line bg-panel-2',
  REPLY: 'border-brand/40 bg-brand-soft',
  INTERNAL_NOTE: 'border-warning/40 bg-warning-bg',
  SYSTEM: 'border-line bg-inset',
};

function who(m: TicketMessage, audience: 'AUTHOR' | 'ADMIN'): string {
  if (m.kind === 'SYSTEM') return 'BookLeaf';
  if (m.kind === 'AUTHOR') return audience === 'AUTHOR' ? 'You' : (m.senderName ?? 'Author');
  if (m.kind === 'INTERNAL_NOTE') return `${m.senderName ?? 'Team'} · internal note`;
  return audience === 'ADMIN' ? `${m.senderName ?? 'Team'} · reply to author` : 'BookLeaf Support';
}

/** The original query followed by the conversation, oldest first. Text is rendered as plain text. */
export function MessageThread({ description, messages, audience }: { description: string; messages: TicketMessage[]; audience: 'AUTHOR' | 'ADMIN' }) {
  return (
    <ol className="flex flex-col gap-3">
      <li className="rounded-[12px] border border-line bg-panel-2 p-4">
        <p className="mb-1.5 text-[11.5px] font-semibold text-ink-3 uppercase">{audience === 'AUTHOR' ? 'Your original query' : 'Original query'}</p>
        <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap">{description}</p>
      </li>
      {messages.map((m) => (
        <li key={m.id} className={`rounded-[12px] border p-4 ${STYLE[m.kind]}`}>
          <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-ink-2">
            {m.kind === 'INTERNAL_NOTE' ? <Lock size={12} aria-hidden /> : null}
            {who(m, audience)}
            <span className="font-normal text-ink-3">· {dateTime(m.createdAt)}</span>
          </p>
          <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap">{m.body}</p>
        </li>
      ))}
    </ol>
  );
}
