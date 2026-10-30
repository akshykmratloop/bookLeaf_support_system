import { CircleHelp, Sparkles } from 'lucide-react';

interface SampleRow {
  number: string;
  subject: string;
  topic: string;
  /** Tailwind background class of the priority dot. */
  dot: string;
  isDrafted: boolean;
}

/** Made-up rows that only illustrate the queue; never real tickets. */
const ROWS: SampleRow[] = [
  {
    number: '#1042',
    subject: 'Charged twice for one order',
    topic: 'Payments',
    dot: 'bg-brand-bright',
    isDrafted: true,
  },
  {
    number: '#1041',
    subject: 'Cannot sign in after a password reset',
    topic: 'Account',
    dot: 'bg-accent',
    isDrafted: true,
  },
  {
    number: '#1040',
    subject: 'Where is my delivery?',
    topic: 'Orders',
    dot: 'bg-console-ink-2',
    isDrafted: false,
  },
];

function Row({ row, delay }: { row: SampleRow; delay: number }) {
  return (
    <li
      style={{ animationDelay: `${delay}ms` }}
      className="flex animate-fade-up items-center gap-3 rounded-control border border-console-line bg-console px-3 py-2.5"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${row.dot}`} />
      <span className="shrink-0 font-mono text-[11.5px] text-console-ink-2">{row.number}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{row.subject}</span>
      <span className="hidden shrink-0 rounded-full bg-console-raised px-2 py-0.5 text-[11px] text-console-ink-2 xl:inline">
        {row.topic}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-semibold text-console-ink-2">
        {row.isDrafted ? (
          <>
            <Sparkles size={12} className="text-brand-bright" /> Draft ready
          </>
        ) : (
          <>
            <CircleHelp size={12} /> Needs info
          </>
        )}
      </span>
    </li>
  );
}

/** A small, decorative picture of a triaged queue for the staff sign-in page. */
export function QueuePreview() {
  return (
    <div
      aria-hidden
      className="rounded-card border border-console-line bg-console-raised p-3 shadow-float"
    >
      <div className="mb-2.5 flex items-center justify-between px-1">
        <span className="text-[12px] font-semibold tracking-wide text-console-ink-2 uppercase">
          Queue
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-console-ink-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Live
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {ROWS.map((row, index) => (
          <Row key={row.number} row={row} delay={120 * (index + 1)} />
        ))}
      </ul>
    </div>
  );
}
