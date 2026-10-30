import type { CustomerLine } from '@bookleaf/shared';

/** Label and value pairs from the customer record, e.g. "Royalty pending ₹3,570". */
export function CustomerLines({ lines }: { lines: readonly CustomerLine[] }) {
  if (!lines.length) return null;
  return (
    <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-x-3 gap-y-1.5 text-[12.5px]">
      {lines.map((l, n) => (
        <div key={`${l.label}-${n}`} className="contents">
          <dt className="break-words text-ink-3">{l.label}</dt>
          <dd className="font-semibold break-words text-ink">{l.display}</dd>
        </div>
      ))}
    </dl>
  );
}
