import { Check } from 'lucide-react';
import { REQUESTER_STEPS, type RequesterStatus } from '../../lib/ticketStatus';

/** Received → In progress → Solved, with where the ticket is now and what it means. */
export function StatusStepper({ status }: { status: RequesterStatus }) {
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex items-center" aria-label="Ticket progress">
        {REQUESTER_STEPS.map((label, i) => {
          const done = i < status.step || (i === status.step && i === REQUESTER_STEPS.length - 1);
          const current = i === status.step;
          return (
            <li
              key={label}
              aria-current={current ? 'step' : undefined}
              className="flex flex-1 items-center gap-2 last:flex-none"
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold ${
                  done
                    ? 'bg-brand text-white'
                    : current
                      ? 'bg-brand-soft text-brand-ink ring-2 ring-brand'
                      : 'bg-panel-2 text-ink-3'
                }`}
              >
                {done ? <Check size={14} aria-hidden /> : i + 1}
              </span>
              <span
                className={`text-[12.5px] font-semibold ${current ? 'text-ink' : 'text-ink-3'}`}
              >
                {label}
              </span>
              {i < REQUESTER_STEPS.length - 1 ? (
                <span
                  aria-hidden
                  className={`mx-2 h-0.5 flex-1 rounded-full ${i < status.step ? 'bg-brand' : 'bg-line'}`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="text-[13px] text-ink-2">{status.description}</p>
    </div>
  );
}
