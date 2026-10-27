const PALETTE = [
  'bg-cat-royalty-bg text-cat-royalty',
  'bg-cat-isbn-bg text-cat-isbn',
  'bg-cat-printing-bg text-cat-printing',
  'bg-cat-distribution-bg text-cat-distribution',
  'bg-cat-production-bg text-cat-production',
];

const SIZES = { sm: 'h-7 w-7 text-[11px]', md: 'h-9 w-9 text-[13px]', lg: 'h-12 w-12 text-[16px]' };

export const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

/** The same name always gets the same colour. */
const colourOf = (name: string) =>
  PALETTE[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % PALETTE.length];

export function Avatar({ name, size = 'md' }: { name: string; size?: keyof typeof SIZES }) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${SIZES[size]} ${colourOf(name)}`}
    >
      {initialsOf(name)}
    </span>
  );
}
