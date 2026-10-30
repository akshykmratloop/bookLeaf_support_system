import { CheckCheck, ListFilter, PenLine, type LucideIcon } from 'lucide-react';
import { QueuePreview } from '../molecules/QueuePreview';

const STEPS: { Icon: LucideIcon; text: string }[] = [
  { Icon: ListFilter, text: 'Sorted by topic and urgency' },
  { Icon: PenLine, text: 'A draft for every reply' },
  { Icon: CheckCheck, text: 'Your team sends it' },
];

/** The staff sign-in's left half (wide screens only): what the desk does, as a picture. */
export function DeskPanel() {
  return (
    <section
      aria-labelledby="desk-title"
      className="relative isolate hidden min-h-0 flex-col justify-between gap-10 overflow-hidden bg-console p-10 text-console-ink lg:flex xl:p-14"
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(var(--console-line)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,black,transparent_85%)] [background-size:22px_22px]"
      />
      <div
        aria-hidden
        className="absolute -top-32 -right-24 -z-10 h-96 w-96 rounded-full bg-console-glow blur-3xl"
      />
      <div className="flex items-center gap-2.5">
        <img src="/favicon.svg" alt="" className="h-8 w-8 rounded-[8px]" />
        <span className="text-[15px] font-bold tracking-tight">Support desk</span>
      </div>
      <div className="flex max-w-[540px] flex-col gap-8">
        <div>
          <h2
            id="desk-title"
            className="font-serif text-[40px] leading-[1.1] tracking-tight xl:text-[46px]"
          >
            Every question arrives <span className="text-brand-bright">already sorted.</span>
          </h2>
          <p className="mt-4 max-w-[460px] text-[15px] leading-relaxed text-console-ink-2">
            New tickets are classified, prioritised and given a draft reply before anyone opens
            them. Your team checks, edits and sends.
          </p>
        </div>
        <QueuePreview />
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-console-ink-2">
        {STEPS.map(({ Icon, text }) => (
          <li key={text} className="inline-flex items-center gap-2">
            <Icon size={14} aria-hidden className="text-brand-bright" />
            {text}
          </li>
        ))}
      </ul>
    </section>
  );
}
