/** BookLeaf Publishing's own logo, taken from bookleafpub.in (white chip behind it in dark mode). */
export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <img
      src="/bookleaf-logo.png"
      alt="BookLeaf Publishing"
      width={609}
      height={189}
      className={`brand-logo w-auto ${size === 'lg' ? 'h-14' : 'h-10'}`}
    />
  );
}
