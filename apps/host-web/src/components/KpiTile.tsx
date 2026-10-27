import type { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: string;
  hint: string;
  Icon: LucideIcon;
  /** Tailwind classes for the icon tile. */
  tone: string;
}

/** One headline number (a stat tile: no chart needed for a single value). */
export function KpiTile({ label, value, hint, Icon, tone }: Props) {
  return (
    <div className="flex animate-rise flex-col gap-3 rounded-card border border-line bg-panel p-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] font-semibold text-ink-2">{label}</p>
        <span className={`grid h-8 w-8 place-items-center rounded-xl ${tone}`}>
          <Icon size={16} aria-hidden />
        </span>
      </div>
      <p className="text-[26px] leading-none font-extrabold tracking-tight">{value}</p>
      <p className="text-[12px] text-ink-3">{hint}</p>
    </div>
  );
}
