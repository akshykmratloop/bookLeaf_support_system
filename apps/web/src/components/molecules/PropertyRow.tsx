import type { ReactNode } from 'react';

/** One labelled property in a side panel, with an optional hint under it. */
export function PropertyRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11.5px] font-semibold text-ink-3 uppercase">{label}</span>
      {children}
      {hint ? <span className="text-[11.5px] text-ink-3">{hint}</span> : null}
    </div>
  );
}

/** A short bulleted list; nothing when empty. */
export function BulletList({ items }: { items: readonly string[] }) {
  if (!items.length) return null;
  return (
    <ul className="list-disc pl-4 text-[12px] text-ink-2">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
