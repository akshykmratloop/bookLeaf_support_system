import type { CheckResult, Fact } from '@bookleaf/shared';
import { AlertOctagon, AlertTriangle, ChevronRight, ShieldCheck } from 'lucide-react';

function sourceText(f: Fact): string {
  switch (f.source.kind) {
    case 'RECORD':
      return `Record: ${f.source.table}.${f.source.field}`;
    case 'KB':
      return `Policy: ${f.source.section}`;
    case 'DERIVED':
      return `Calculated: ${f.source.rule}`;
    case 'MISSING':
      return f.source.reason;
  }
}

/**
 * What the draft was allowed to say, with where each value came from. A small secondary part of
 * the ticket page (U-1), folded by default: the Customer panel is the main view of the customer.
 */
export function EvidencePanel({ facts }: { facts: Fact[] }) {
  const shown = facts.filter((f) => !f.id.startsWith('kb.'));
  return (
    <details className="group rounded-card border border-line bg-panel shadow-soft">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-card px-4 py-3 text-[12px] font-semibold text-ink-2 focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <ChevronRight
          size={14}
          aria-hidden
          className="shrink-0 text-ink-3 transition-transform group-open:rotate-90"
        />
        <span className="flex-1">Facts the draft used ({shown.length})</span>
      </summary>
      <div className="px-4 pb-4">
        <ul className="flex flex-col gap-2.5">
          {shown.map((f) => (
            <li key={f.id} className="text-[12.5px]">
              <span className="text-ink-2">{f.label}</span>
              <span
                className={`block font-semibold break-words ${f.type === 'UNKNOWN' ? 'text-warning' : 'text-ink'}`}
              >
                {f.type === 'UNKNOWN' ? 'Unknown — confirm before stating' : f.display}
              </span>
              <span className="block text-[11px] break-words text-ink-3">{sourceText(f)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-ink-3">
          Policy figures come from your Knowledge Base and are checked the same way.
        </p>
      </div>
    </details>
  );
}

/** Checker output for the current reply text. */
export function CheckIssues({ result }: { result: CheckResult }) {
  if (result.issues.length === 0) {
    return (
      <p className="flex items-center gap-2 text-[12.5px] text-success">
        <ShieldCheck size={15} aria-hidden /> Every figure matches a verified fact.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5" aria-label="Reply check results">
      {result.issues.map((i, n) => (
        <li
          key={`${i.code}-${n}`}
          className={`flex items-start gap-2 text-[12.5px] ${i.severity === 'BLOCK' ? 'text-danger' : 'text-warning'}`}
        >
          {i.severity === 'BLOCK' ? (
            <AlertOctagon size={14} className="mt-0.5 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          )}
          <span>
            {i.message}
            {i.excerpt ? <span className="ml-1 font-mono text-[11.5px]">“{i.excerpt}”</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
