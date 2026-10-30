import type { SourceProbe } from '@bookleaf/shared';
import { Pill } from '../atoms/Pill';

/** What each data source answered during a test, with its raw response to pick paths from. */
export function SourceProbeList({ probes }: { probes: SourceProbe[] }) {
  if (probes.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2" aria-label="Data source answers">
      {probes.map((p) => (
        <li key={p.sourceId} className="rounded-control border border-line p-3">
          <p className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="font-semibold">{p.name}</span>
            <Pill tone={p.ok ? 'success' : 'danger'} dot>
              {p.status === null ? 'No answer' : `HTTP ${p.status}`}
            </Pill>
            <span className="text-ink-2">{p.detail}</span>
          </p>
          {p.raw ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-[12px] font-semibold text-brand-ink">
                Raw response
              </summary>
              <pre className="mt-2 max-h-72 overflow-auto rounded-control bg-inset p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap break-all text-ink">
                {p.raw}
              </pre>
            </details>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
