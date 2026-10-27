import type { ChatMessage } from '@bookleaf/shared';
import { ShieldCheck } from 'lucide-react';
import { Pill } from '../atoms/Pill';
import { AssistantAvatar } from './AssistantAvatar';

const NOTE: Partial<Record<NonNullable<ChatMessage['source']>, string>> = {
  SAFE_FALLBACK: 'Not confirmed from your records',
  UNAVAILABLE: 'Assistant unavailable',
};

type Message = Pick<ChatMessage, 'role' | 'body' | 'source' | 'factsUsed'>;

/** The verified figures an answer used, as small chips under it. */
function Facts({ facts }: { facts: Message['factsUsed'] }) {
  return (
    <div className="mt-3 border-t border-line pt-2.5">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-success">
        <ShieldCheck size={13} aria-hidden /> Checked against your BookLeaf records
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {facts.map((f) => (
          <li
            key={`${f.label}-${f.display}`}
            className="rounded-full bg-success-bg px-2.5 py-1 text-[11.5px] text-ink-2"
          >
            {f.label}: <span className="font-bold text-ink">{f.display}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One chat message. Text renders as plain text; verified figures are listed under answers. */
export function ChatBubble({ message, pending = false }: { message: Message; pending?: boolean }) {
  const note = message.source ? NOTE[message.source] : undefined;
  if (message.role === 'AUTHOR')
    return (
      <li className="flex animate-fade-up justify-end">
        <p
          className={`max-w-[82%] rounded-[20px] rounded-br-md bg-brand px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap text-white shadow-soft ${pending ? 'opacity-70' : ''}`}
        >
          {message.body}
        </p>
      </li>
    );
  return (
    <li className="flex animate-fade-up items-end gap-2">
      <AssistantAvatar size={28} />
      <div className="max-w-[86%] rounded-[20px] rounded-bl-md border border-line bg-panel px-4 py-3 shadow-soft">
        <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{message.body}</p>
        {note ? (
          <div className="mt-2">
            <Pill tone="warning">{note}</Pill>
          </div>
        ) : null}
        {message.factsUsed.length ? <Facts facts={message.factsUsed} /> : null}
      </div>
    </li>
  );
}
