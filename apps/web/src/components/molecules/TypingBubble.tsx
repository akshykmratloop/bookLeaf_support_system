const DOT_DELAYS = ['0ms', '150ms', '300ms'];

/** The assistant's reply bubble while it checks the author's records and writes the answer. */
export function TypingBubble() {
  return (
    <li className="flex justify-start" role="status" aria-label="Ask BookLeaf is replying">
      <div className="rounded-card border border-line bg-panel px-4 py-3">
        <p className="mb-1 text-[11.5px] font-semibold text-ink-3">Ask BookLeaf</p>
        <span className="flex h-5 items-center gap-1.5" aria-hidden>
          {DOT_DELAYS.map((delay) => (
            <span
              key={delay}
              style={{ animationDelay: delay }}
              className="size-2 animate-bounce rounded-full bg-ink-3 motion-reduce:animate-none"
            />
          ))}
        </span>
      </div>
    </li>
  );
}
