import type { Fact, MappedPreview as Preview } from '@bookleaf/shared';
import { Pill } from '../atoms/Pill';

function FactList({ facts }: { facts: Fact[] }) {
  if (facts.length === 0) return null;
  return (
    <dl className="grid gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-[minmax(0,14rem)_1fr]">
      {facts.map((f) => (
        <div key={f.id} className="contents">
          <dt className="truncate text-ink-2" title={f.id}>
            {f.label}
          </dt>
          <dd className="min-w-0 break-words">
            {f.source.kind === 'MISSING' ? (
              <Pill tone="warning" title={f.source.reason}>
                Unavailable
              </Pill>
            ) : (
              f.display
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The customer record support would see, merged from every source, before saving anything. */
export function MappedPreview({ preview }: { preview: Preview }) {
  const c = preview.customer;
  return (
    <section
      aria-label="Mapped preview"
      className="flex flex-col gap-3 rounded-control border border-line p-3"
    >
      <p className="text-[12.5px] font-semibold text-ink-2">Mapped preview</p>
      {c ? (
        <>
          <p className="text-[13.5px]">
            <span className="font-semibold">{c.name}</span>{' '}
            <span className="text-ink-2">{c.email}</span>
          </p>
          <FactList facts={c.facts} />
          {c.items.map((item) => (
            <div key={item.id} className="flex flex-col gap-1 border-t border-line pt-2">
              <p className="text-[12.5px] font-semibold">
                {item.title} <span className="font-mono text-[11px] text-ink-3">{item.id}</span>
              </p>
              <FactList facts={item.facts} />
            </div>
          ))}
        </>
      ) : null}
      {preview.unavailable.length ? (
        <ul className="flex flex-col gap-1 text-[12px] text-warning">
          {preview.unavailable.map((u) => (
            <li key={u.key}>
              <code className="font-mono">{u.key}</code>: {u.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
