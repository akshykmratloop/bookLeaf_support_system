import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  icon?: ReactNode;
  /** Tailwind colour classes, e.g. from categoryStyle(). */
  colors?: string;
  title?: string;
}

/** A small rounded label with an optional icon (issue types, channels, platforms). */
export function Chip({ children, icon, colors = 'bg-panel-2 text-ink-2', title }: Props) {
  return (
    <span
      title={title}
      className={`inline-flex h-6 max-w-full min-w-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-semibold ${colors}`}
    >
      {icon}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
