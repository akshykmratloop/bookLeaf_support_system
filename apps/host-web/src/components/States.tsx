export function Loading() {
  return (
    <div className="grid h-full place-items-center" role="status">
      <span className="flex items-center gap-3 text-ink-2">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand" />
        Loading your dashboard…
      </span>
    </div>
  );
}

export function Problem({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="grid h-full place-items-center p-6">
      <div role="alert" className="max-w-sm text-center">
        <p className="text-[16px] font-bold">We could not load your dashboard</p>
        <p className="mt-1 text-ink-2">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 h-10 rounded-full bg-brand px-5 font-semibold text-white hover:bg-brand-strong"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
