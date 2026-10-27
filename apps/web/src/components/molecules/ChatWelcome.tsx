import { ArrowUpRight } from 'lucide-react';
import { AssistantAvatar } from './AssistantAvatar';

const SUGGESTIONS = [
  'How much royalty is pending on my books?',
  'When is the next payout?',
  'What stage is my book in?',
  'Is my book live on Amazon?',
];

/** The empty conversation: what the assistant can do, and questions to start with. */
export function ChatWelcome({ onAsk }: { onAsk: (question: string) => void }) {
  return (
    <li className="flex animate-fade-up flex-col items-center gap-4 py-6 text-center">
      <AssistantAvatar size={56} />
      <div>
        <p className="text-[18px] font-extrabold">Ask me anything about your books</p>
        <p className="mx-auto mt-1 max-w-[360px] text-[13px] text-ink-2">
          I answer from your own BookLeaf records and show the figures I used. I can also raise a
          ticket for you.
        </p>
      </div>
      <div className="flex max-w-[560px] flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onAsk(s)}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-panel px-3.5 py-2 text-[12.5px] font-semibold text-ink-2 shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:text-brand"
          >
            {s} <ArrowUpRight size={13} aria-hidden />
          </button>
        ))}
      </div>
    </li>
  );
}
