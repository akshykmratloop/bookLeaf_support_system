import { useEffect, type RefObject } from 'react';

const MAX_DEG = 9;
const RESET: Record<string, string> = { '--rx': '0deg', '--ry': '0deg', '--px': '0', '--py': '0' };

/**
 * Follows the pointer over the element and sets CSS variables on it: --rx/--ry tilt the book,
 * --px/--py (-1..1) drive parallax, --mx/--my place the spotlight. Off for reduced motion.
 */
export function useTilt(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
        el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
        el.style.setProperty('--ry', `${((x - 0.5) * 2 * MAX_DEG).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${((0.5 - y) * 1.2 * MAX_DEG).toFixed(2)}deg`);
        el.style.setProperty('--px', ((x - 0.5) * 2).toFixed(3));
        el.style.setProperty('--py', ((y - 0.5) * 2).toFixed(3));
      });
    };
    const onLeave = () => {
      for (const [k, v] of Object.entries(RESET)) el.style.setProperty(k, v);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [ref]);
}
