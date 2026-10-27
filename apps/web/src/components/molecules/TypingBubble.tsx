import { AssistantAvatar } from './AssistantAvatar';

const DOT_DELAYS = ['0ms', '160ms', '320ms'];

/** The assistant's reply bubble while it checks the author's records and writes the answer. */
export function TypingBubble() {
  return (
    <li className="flex items-end gap-2" role="status" aria-label="Ask BookLeaf is replying">
      <AssistantAvatar size={28} />
      <span className="flex h-11 items-center gap-1.5 rounded-[20px] rounded-bl-md border border-line bg-panel px-4 shadow-soft">
        {DOT_DELAYS.map((delay) => (
          <span
            key={delay}
            aria-hidden
            style={{ animationDelay: delay }}
            className="size-2 animate-typing rounded-full bg-brand"
          />
        ))}
      </span>
    </li>
  );
}
