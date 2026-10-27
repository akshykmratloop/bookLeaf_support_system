import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

export function SectionHeader({
  title,
  to,
  cta = 'See all',
}: {
  title: string;
  to?: string;
  cta?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-bold">{title}</h2>
      {to ? (
        <Link
          to={to}
          className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-brand"
        >
          {cta} <ChevronRight size={14} aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
