import { Phone } from 'lucide-react';

const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

/** "Call · 3 min · 10:42" for a saved call. */
export const savedCallLabel = (minutes: number, at: string) =>
  `Call · ${minutes} min · ${TIME.format(new Date(at))}`;

/** Marks where a call joined the conversation. */
export function CallDivider({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-3 text-[11.5px] font-semibold text-ink-3" role="separator">
      <span className="h-px flex-1 bg-line" aria-hidden />
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1">
        <Phone size={12} aria-hidden className="text-brand-ink" />
        {label}
      </span>
      <span className="h-px flex-1 bg-line" aria-hidden />
    </li>
  );
}
