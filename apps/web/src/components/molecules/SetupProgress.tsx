import { progressText, type SetupProgress as Progress } from '../../lib/onboarding';

/** "5 of 8 done" with a bar; the bar turns amber while a step needs attention. */
export function SetupProgress({ progress }: { progress: Progress }) {
  const text = progressText(progress);
  const fill = progress.broken > 0 ? 'bg-warning' : 'bg-brand';
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] font-semibold text-ink" aria-live="polite">
        {text}
      </p>
      <div
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
        aria-valuetext={text}
        className="h-2 w-full overflow-hidden rounded-full bg-panel-2"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${fill}`}
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  );
}
