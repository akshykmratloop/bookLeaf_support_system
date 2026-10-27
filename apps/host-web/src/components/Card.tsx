import type { ReactNode } from 'react';

export function Card({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={`animate-rise rounded-card border border-line bg-panel p-5 shadow-card ${className}`}
    >
      <h2 className="text-[15px] font-bold">{title}</h2>
      {subtitle ? <p className="text-[12.5px] text-ink-3">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}
