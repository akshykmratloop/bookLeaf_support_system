import type { TranscriptLine } from '@bookleaf/shared';
import { ChatBubble } from './ChatBubble';

/** The lines of a voice call, shown as chat bubbles. */
export function TranscriptList({
  lines,
  className,
  label,
}: {
  lines: readonly TranscriptLine[];
  className: string;
  label?: string;
}) {
  return (
    <ol className={className} aria-label={label}>
      {lines.map((l, i) => (
        <ChatBubble
          key={`${l.at}-${i}`}
          message={{ role: l.role, body: l.text, source: null, factsUsed: [] }}
        />
      ))}
    </ol>
  );
}
