import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useToast } from './Toast';

const COPIED_MS = 2000;

interface Props {
  /** The exact text put on the clipboard. */
  value: string;
  /** What is copied, for screen readers: "Copy key prefix". */
  label: string;
  /** Shown next to the icon; omit for an icon-only button. */
  text?: string;
}

/** Copies `value`; the icon turns into a tick for two seconds. A refused copy says so. */
export function CopyButton({ value, label, text }: Props) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(t);
  }, [copied]);
  // Wrapped so a missing clipboard (plain-http page) lands in the same "refused" branch.
  const copy = () => {
    void Promise.resolve()
      .then(() => navigator.clipboard.writeText(value))
      .then(
        () => setCopied(true),
        () => toast('error', 'Could not copy. Select the text and copy it yourself.'),
      );
  };
  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? `${label}: copied` : label}
      title={label}
      className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-control border border-line bg-panel px-2 text-[12px] font-semibold text-ink-2 transition-colors hover:border-brand hover:text-ink"
    >
      <Icon size={13} aria-hidden className={copied ? 'text-success' : ''} />
      {text ? <span>{copied ? 'Copied' : text}</span> : null}
    </button>
  );
}
