import type { CheckResult, Fact } from '@bookleaf/shared';
import { AlertOctagon, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Card } from '../atoms/Card';

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

/** What the draft is allowed to say, with where each value came from. */
export function EvidencePanel({ facts }: { facts: Fact[] }) {
  const shown = facts.filter((f) => !f.id.startsWith('kb.'));
  return (
    <Card className="p-4">
      <p className="mb-3 text-[11.5px] font-semibold text-ink-3 uppercase">Verified facts used for this draft</p>
      <ul className="flex flex-col gap-2.5">
        {shown.map((f) => (
          <li key={f.id} className="text-[12.5px]">
            <span className="text-ink-2">{f.label}</span>
            <span className={`block font-semibold ${f.type === 'UNKNOWN' ? 'text-warning' : 'text-ink'}`}>{f.type === 'UNKNOWN' ? 'Unknown — confirm before stating' : f.display}</span>
            <span className="block text-[11px] text-ink-3">{sourceText(f)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-ink-3">Policy figures (₹1,000 threshold, 45-day window, timelines) come from the Knowledge Base.</p>
    </Card>
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
        <li key={`${i.code}-${n}`} className={`flex items-start gap-2 text-[12.5px] ${i.severity === 'BLOCK' ? 'text-danger' : 'text-warning'}`}>
          {i.severity === 'BLOCK' ? <AlertOctagon size={14} className="mt-0.5 shrink-0" aria-hidden /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />}
          <span>
            {i.message}
            {i.excerpt ? <span className="ml-1 font-mono text-[11.5px]">“{i.excerpt}”</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
