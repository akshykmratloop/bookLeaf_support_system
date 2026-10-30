import type { TicketMessage } from '@bookleaf/shared';
import { Headset } from 'lucide-react';
import { dateTime } from '../../lib/format';

const Time = ({ iso }: { iso: string }) => (
  <span className="mt-1 block text-[11px] text-ink-3">{dateTime(iso)}</span>
);

function Mine({ body, at, label }: { body: string; at: string; label?: string }) {
  return (
    <li className="flex animate-fade-up flex-col items-end">
      {label ? <span className="mb-1 text-[11px] font-semibold text-ink-3">{label}</span> : null}
      <p className="max-w-[85%] rounded-[20px] rounded-br-md bg-brand px-4 py-2.5 text-[14px] leading-relaxed wrap-anywhere whitespace-pre-wrap text-white shadow-soft">
        {body}
      </p>
      <Time iso={at} />
    </li>
  );
}

function Team({ body, at }: { body: string; at: string }) {
  return (
    <li className="flex animate-fade-up items-end gap-2">
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-info-bg text-info"
      >
        <Headset size={15} />
      </span>
      <div className="max-w-[85%] min-w-0">
        <span className="mb-1 block text-[11px] font-semibold text-ink-3">BookLeaf Support</span>
        <p className="rounded-[20px] rounded-bl-md border border-line bg-panel px-4 py-2.5 text-[14px] leading-relaxed wrap-anywhere whitespace-pre-wrap shadow-soft">
          {body}
        </p>
        <Time iso={at} />
      </div>
    </li>
  );
}

/** The request and the replies, oldest first, as a conversation. Plain text only. */
export function TicketConversation(props: {
  description: string;
  createdAt: string;
  messages: TicketMessage[];
}) {
  return (
    <ol className="flex flex-col gap-4" aria-label="Conversation">
      <Mine body={props.description} at={props.createdAt} label="Your request" />
      {props.messages.map((m) => {
        if (m.kind === 'AUTHOR') return <Mine key={m.id} body={m.body} at={m.createdAt} />;
        if (m.kind === 'REPLY') return <Team key={m.id} body={m.body} at={m.createdAt} />;
        return (
          <li
            key={m.id}
            className="self-center rounded-full bg-panel-2 px-3 py-1 text-center text-[11.5px] text-ink-3"
          >
            {m.body}
          </li>
        );
      })}
    </ol>
  );
}
