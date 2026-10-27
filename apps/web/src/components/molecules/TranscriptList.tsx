import type { ConversationLine } from '@bookleaf/shared';
import { threadItems } from '../../lib/callGroups';
import { CallDivider, savedCallLabel } from './CallDivider';
import { ChatBubble } from './ChatBubble';

const lineOf = (l: ConversationLine) => ({ callId: l.callId ?? null, at: l.at });

/**
 * Saved lines shown as chat bubbles: a call's transcript, or a past chat in which any spoken
 * lines sit under a "Call" divider with a phone mark.
 */
export function TranscriptList({
  lines,
  className,
  label,
}: {
  lines: readonly ConversationLine[];
  className: string;
  label?: string;
}) {
  return (
    <ol className={className} aria-label={label}>
      {threadItems(lines, lineOf).map((item, i) =>
        item.kind === 'call' ? (
          <CallDivider key={`call-${item.callId}`} label={savedCallLabel(item.minutes, item.at)} />
        ) : (
          <ChatBubble
            key={`${item.message.at}-${i}`}
            message={{
              role: item.message.role,
              body: item.message.text,
              source: null,
              factsUsed: [],
              channel: item.message.callId ? 'VOICE' : 'CHAT',
            }}
          />
        ),
      )}
    </ol>
  );
}
