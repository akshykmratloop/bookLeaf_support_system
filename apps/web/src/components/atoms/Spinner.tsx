export function Spinner({ size = 18, label }: { size?: number; label?: string }) {
  return (
    <span role={label ? 'status' : undefined} className="inline-flex items-center gap-2 text-ink-2">
      <span
        aria-hidden
        style={{ width: size, height: size, animation: 'spin 0.8s linear infinite' }}
        className="inline-block rounded-full border-2 border-line-strong border-t-brand"
      />
      {label ? <span className="text-[13px]">{label}</span> : null}
    </span>
  );
}
