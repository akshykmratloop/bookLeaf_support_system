export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className={size === 'lg' ? 'h-10 w-10' : 'h-8 w-8'} />
      <span className={`font-serif font-semibold ${size === 'lg' ? 'text-[26px]' : 'text-[19px]'}`}>
        BookLeaf
      </span>
    </span>
  );
}
