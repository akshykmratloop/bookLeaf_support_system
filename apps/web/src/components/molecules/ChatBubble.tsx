import type { ChatMessage } from '@bookleaf/shared';
import { ShieldCheck } from 'lucide-react';
import { Pill } from '../atoms/Pill';

const NOTE: Partial<Record<NonNullable<ChatMessage['source']>, string>> = {
  SAFE_FALLBACK: 'Not confirmed from your records',
  UNAVAILABLE: 'Assistant unavailable',
};

/** One chat message. Text renders as plain text; verified figures are listed under answers. */
export function ChatBubble({
  message,
  pending = false,
}: {
  message: Pick<ChatMessage, 'role' | 'body' | 'source' | 'factsUsed'>;
  pending?: boolean;
}) {
  const mine = message.role === 'AUTHOR';
  const note = message.source ? NOTE[message.source] : undefined;
  return (
    <li className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-[14px] border px-4 py-3 ${
          mine ? 'border-brand/30 bg-brand-soft' : 'border-line bg-panel'
        } ${pending ? 'opacity-70' : ''}`}
      >
        <p className="mb-1 text-[11.5px] font-semibold text-ink-3">
          {mine ? 'You' : 'Ask BookLeaf'}
        </p>
        <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap">{message.body}</p>
        {note ? (
          <div className="mt-2">
            <Pill tone="warning">{note}</Pill>
          </div>
        ) : null}
        {message.factsUsed.length ? (
          <div className="mt-3 border-t border-line pt-2">
            <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold text-success">
              <ShieldCheck size={13} aria-hidden /> From your BookLeaf records
            </p>
            <ul className="flex flex-col gap-0.5 text-[12px] text-ink-2">
              {message.factsUsed.map((f) => (
                <li key={`${f.label}-${f.display}`}>
                  {f.label}: <span className="font-semibold text-ink">{f.display}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </li>
  );
}
