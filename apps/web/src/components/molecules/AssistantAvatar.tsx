import { Sparkles } from 'lucide-react';

/** The assistant's round mark beside its messages. */
export function AssistantAvatar({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-bright to-brand text-white shadow-soft"
    >
      <Sparkles size={Math.round(size / 2.2)} />
    </span>
  );
}
