/** The soft pink waves from BookLeaf's site, as a decorative background layer. */
export function Waves({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1200 220"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-x-0 bottom-0 h-[45%] w-full ${className}`}
    >
      <path
        d="M0 120c160-60 320-60 480 0s320 60 480 0 180-50 240-30v130H0Z"
        fill="var(--pink)"
        opacity="0.35"
      />
      <path
        d="M0 160c200-50 360-40 540 10s360 40 520-10 120-20 140-10v70H0Z"
        fill="var(--brand-bright)"
        opacity="0.18"
      />
    </svg>
  );
}
