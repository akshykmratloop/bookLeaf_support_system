/**
 * The sign-in backdrop: slow coral and cream glows, a faint dot grid, a spotlight that follows
 * the pointer (--mx/--my) and paper leaves that drift with parallax (--px/--py). Decorative.
 */
const LEAVES = [
  { left: '8%', top: '70%', size: 34, depth: 18, delay: '0s', rotate: -18 },
  { left: '46%', top: '8%', size: 26, depth: 30, delay: '1.2s', rotate: 14 },
  { left: '56%', top: '78%', size: 40, depth: 12, delay: '2.4s', rotate: 8 },
  { left: '92%', top: '12%', size: 22, depth: 36, delay: '0.6s', rotate: -6 },
];

function Leaf({ l }: { l: (typeof LEAVES)[number] }) {
  return (
    <span
      className="absolute"
      style={{
        left: l.left,
        top: l.top,
        transform: `translate(calc(var(--px, 0) * ${l.depth}px), calc(var(--py, 0) * ${l.depth}px))`,
        transition: 'transform 0.4s ease-out',
      }}
    >
      <svg
        viewBox="0 0 40 30"
        width={l.size}
        className="animate-float opacity-70"
        style={{ animationDelay: l.delay, rotate: `${l.rotate}deg` }}
      >
        <path
          d="M20 6C14 2 6 2 2 4v22c4-2 12-2 18 2 6-4 14-4 18-2V4c-4-2-12-2-18 2Z"
          fill="var(--panel)"
          stroke="var(--pink)"
        />
        <path d="M20 6v22" stroke="var(--brand-bright)" strokeWidth="1.2" opacity="0.6" />
      </svg>
    </span>
  );
}

export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <span className="absolute -top-40 -left-32 h-[560px] w-[560px] animate-blob rounded-full bg-[var(--brand-bright)] opacity-25 blur-[110px]" />
      <span className="absolute top-1/3 -right-40 h-[520px] w-[520px] animate-blob rounded-full bg-[var(--pink)] opacity-50 blur-[120px] [animation-delay:-6s]" />
      <span className="absolute -bottom-48 left-1/4 h-[480px] w-[480px] animate-blob rounded-full bg-[var(--cream)] opacity-90 blur-[100px] [animation-delay:-12s]" />
      <span className="absolute inset-0 bg-[radial-gradient(var(--line)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] [background-size:22px_22px] opacity-70" />
      <span className="absolute inset-0 bg-[radial-gradient(520px_circle_at_var(--mx,30%)_var(--my,40%),rgb(241_104_118/0.16),transparent_65%)]" />
      {LEAVES.map((l) => (
        <Leaf key={l.left + l.top} l={l} />
      ))}
    </div>
  );
}
