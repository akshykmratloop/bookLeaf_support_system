import type { ReactNode } from 'react';
import { HelpArt, RoyaltyArt, StagesArt, StoresArt } from './FeatureArt';

/** One spread of the book: the words on the left page, the picture on the right. */
export interface Spread {
  id: string;
  label: string;
  title: string;
  body: string;
  art: ReactNode;
  caption: string;
}

export const SPREADS: Spread[] = [
  {
    id: 'publish',
    label: 'Publishing',
    title: 'From manuscript to bookshelf',
    body: 'Follow every book through all nine production stages, from editing to going live.',
    art: <StagesArt />,
    caption: 'Nine stages, one view',
  },
  {
    id: 'royalties',
    label: 'Royalties',
    title: 'Royalties you can see',
    body: 'Earned, paid and pending for each book. Payouts within 45 days of each quarter, from ₹1,000.',
    art: <RoyaltyArt />,
    caption: 'Paid and pending, book by book',
  },
  {
    id: 'stores',
    label: 'Stores',
    title: 'Sold where readers shop',
    body: 'See where each book is on sale and how many copies it has sold.',
    art: <StoresArt />,
    caption: 'Every store, every copy',
  },
  {
    id: 'help',
    label: 'Help',
    title: 'Help without leaving the page',
    body: 'Ask by chat or call. Answers come from your own records, and the team picks up the rest.',
    art: <HelpArt />,
    caption: 'Chat or call, any time',
  },
];

const folio = (i: number) => String(i + 1).padStart(2, '0');

/** A page's paper: warm white, shaded towards the spine, with a running footer. */
function Paper({
  side,
  footer,
  children,
}: {
  side: 'left' | 'right';
  footer: string;
  children: ReactNode;
}) {
  const shade =
    side === 'left'
      ? 'bg-[linear-gradient(to_left,rgb(47_46_46/0.09),transparent_14%),linear-gradient(#fffdfb,#fffaf7)]'
      : 'bg-[linear-gradient(to_right,rgb(47_46_46/0.09),transparent_14%),linear-gradient(#fffdfb,#fffaf7)]';
  return (
    <div
      className={`absolute inset-0 flex flex-col overflow-hidden px-7 pt-7 pb-4 text-[#2f2e2e] ${shade} ${side === 'left' ? 'rounded-l-[10px]' : 'rounded-r-[10px]'}`}
    >
      <div className="min-h-0 flex-1">{children}</div>
      <p
        className={`mt-3 text-[10.5px] tracking-[0.18em] text-[#8a8686] uppercase ${side === 'left' ? 'text-left' : 'text-right'}`}
      >
        {footer}
      </p>
    </div>
  );
}

export function LeftPage({ index }: { index: number }) {
  const s = SPREADS[index];
  if (!s) return null;
  return (
    <Paper side="left" footer={`BookLeaf Publishing · ${folio(index * 2)}`}>
      <p className="text-[56px] leading-none font-light text-[#f16977]">{folio(index)}</p>
      <p className="mt-3 text-[11px] font-bold tracking-[0.2em] text-[#c8384c] uppercase">
        {s.label}
      </p>
      <h3 className="mt-2 text-[22px] leading-snug font-light tracking-tight">{s.title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-[#5e5e5e]">{s.body}</p>
    </Paper>
  );
}

export function RightPage({ index }: { index: number }) {
  const s = SPREADS[index];
  if (!s) return null;
  return (
    <Paper side="right" footer={`${s.caption} · ${folio(index * 2 + 1)}`}>
      <div className="flex h-full flex-col justify-center">{s.art}</div>
    </Paper>
  );
}
