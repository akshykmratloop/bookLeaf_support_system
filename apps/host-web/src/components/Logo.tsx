/** BookLeaf Publishing's own logo, taken from bookleafpub.in (white chip behind it in dark mode). */
export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <img
      src="/bookleaf-logo.png"
      alt="BookLeaf Publishing"
      width={609}
      height={189}
      className={`brand-logo w-auto max-w-none shrink-0 object-contain ${size === 'lg' ? 'h-12' : 'h-10'}`}
    />
  );
}
