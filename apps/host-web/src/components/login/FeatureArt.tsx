import { BookOpen, IndianRupee, Sparkles } from 'lucide-react';

/** Small looping illustrations for the sign-in showcase. Decorative: the text says it all. */

const STAGES = [
  'Manuscript',
  'Editing',
  'Cover',
  'Typeset',
  'Proof',
  'ISBN',
  'Print',
  'Stores',
  'Live',
];

export function StagesArt() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <div className="relative h-2 overflow-hidden rounded-full bg-brand-soft">
        <span className="absolute inset-y-0 left-0 animate-fill rounded-full bg-brand-bright" />
      </div>
      <ol className="flex justify-between">
        {STAGES.map((s, i) => (
          <li
            key={s}
            title={s}
            className="grid h-7 w-7 animate-pop place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand-ink"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <span className="sr-only">{s}</span>
            {i === STAGES.length - 1 ? <BookOpen size={13} aria-hidden /> : i + 1}
          </li>
        ))}
      </ol>
      <p className="flex justify-between text-[11px] text-ink-3">
        <span>Manuscript</span>
        <span>Live in stores</span>
      </p>
    </div>
  );
}

const BARS = [38, 52, 46, 70, 64, 88];

export function RoyaltyArt() {
  return (
    <div aria-hidden className="flex items-end gap-5">
      <div className="flex h-24 flex-1 items-end gap-2">
        {BARS.map((h, i) => (
          <span
            key={i}
            className="flex-1 origin-bottom animate-grow rounded-t-[4px] bg-[var(--series-2)]"
            style={{ height: `${h}%`, animationDelay: `${i * 110}ms` }}
          />
        ))}
      </div>
      <div className="grid h-20 w-20 animate-float place-items-center rounded-full bg-panel shadow-card">
        <IndianRupee className="text-brand-ink" size={28} />
      </div>
    </div>
  );
}

const STORES = ['Amazon India', 'Flipkart', 'BookLeaf Store'];

export function StoresArt() {
  return (
    <div aria-hidden className="relative flex h-24 items-center justify-center">
      <span className="grid h-16 w-12 animate-float place-items-center rounded-md bg-[linear-gradient(135deg,var(--brand-bright),var(--navy))] text-white shadow-card">
        <BookOpen size={20} />
      </span>
      {STORES.map((s, i) => (
        <span
          key={s}
          className="absolute animate-pop rounded-full bg-panel px-3 py-1 text-[11.5px] font-semibold text-ink shadow-card"
          style={{
            animationDelay: `${200 + i * 180}ms`,
            ...[
              { left: '2%', top: '8%' },
              { right: '4%', top: '18%' },
              { left: '18%', bottom: '0%' },
            ][i],
          }}
        >
          {s}
        </span>
      ))}
    </div>
  );
}

export function HelpArt() {
  return (
    <div aria-hidden className="flex flex-col gap-2 text-[12.5px]">
      <p className="max-w-[80%] animate-pop self-end rounded-2xl rounded-br-md bg-brand px-3 py-2 text-white">
        When will I get my royalty?
      </p>
      <p
        className="flex max-w-[85%] animate-pop items-start gap-2 self-start rounded-2xl rounded-bl-md bg-panel px-3 py-2 text-ink shadow-card"
        style={{ animationDelay: '450ms' }}
      >
        <Sparkles size={14} className="mt-0.5 shrink-0 text-brand-ink" />
        Straight from your records, with a ticket to the team if you need one.
      </p>
    </div>
  );
}
