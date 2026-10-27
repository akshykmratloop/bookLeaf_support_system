import { BOOK_STAGES, STAGE_LABELS } from '@bookleaf/shared';

/** The nine production stages as a track; the current one is labelled. */
export function StageTrack({ stageIndex }: { stageIndex: number }) {
  const stage = BOOK_STAGES[stageIndex];
  return (
    <div>
      <div
        className="flex gap-1"
        role="img"
        aria-label={`Stage ${stageIndex + 1} of ${BOOK_STAGES.length}: ${stage ? STAGE_LABELS[stage] : ''}`}
      >
        {BOOK_STAGES.map((s, i) => (
          <span
            key={s}
            className={`h-1.5 flex-1 rounded-full ${i <= stageIndex ? 'bg-brand' : 'bg-grid'}`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-[12px] text-ink-2">
        Stage {stageIndex + 1} of {BOOK_STAGES.length} ·{' '}
        <strong className="text-ink">{stage ? STAGE_LABELS[stage] : ''}</strong>
      </p>
    </div>
  );
}
