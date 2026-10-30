import { CopyButton } from './CopyButton';

interface Props {
  /** What the code is, shown above it and used for the Copy button's label. */
  label: string;
  code: string;
}

/** A code sample filled in for this workspace, with a Copy button. Scrolls sideways when narrow. */
export function CodeSample({ label, code }: Props) {
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="flex items-center justify-between gap-2 text-[12px] font-semibold text-ink-2">
        <span>{label}</span>
        <CopyButton value={code} label={`Copy ${label.toLowerCase()}`} text="Copy" />
      </figcaption>
      <pre
        tabIndex={0}
        aria-label={label}
        className="max-w-full overflow-x-auto rounded-control bg-inset p-3 font-mono text-[12px] leading-relaxed text-ink focus-visible:outline-2 focus-visible:outline-brand"
      >
        <code>{code}</code>
      </pre>
    </figure>
  );
}
