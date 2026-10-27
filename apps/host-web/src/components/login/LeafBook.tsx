import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { LeftPage, RightPage, SPREADS } from './leaves';

interface Turn {
  to: number;
  dir: 'next' | 'prev';
}

const AUTO_TURN_MS = 6000;
const COUNT = SPREADS.length;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const face = 'absolute inset-0 [backface-visibility:hidden]';

/** The leaf being turned: front is the page lifting off, back is the page landing. */
function TurningLeaf({ from, turn, onDone }: { from: number; turn: Turn; onDone: () => void }) {
  const next = turn.dir === 'next';
  return (
    <div
      onAnimationEnd={onDone}
      className={`absolute top-0 z-20 h-full w-1/2 [transform-style:preserve-3d] ${next ? 'left-1/2 origin-left animate-leaf-next' : 'left-0 origin-right animate-leaf-prev'}`}
    >
      <div className={face}>{next ? <RightPage index={from} /> : <LeftPage index={from} />}</div>
      <div className={`${face} [transform:rotateY(180deg)]`}>
        {next ? <LeftPage index={turn.to} /> : <RightPage index={turn.to} />}
      </div>
    </div>
  );
}

/** Which page each half shows: during a turn, the halves already show where the leaf will land. */
function halves(index: number, turn: Turn | null) {
  if (!turn) return { left: index, right: index };
  return turn.dir === 'next' ? { left: index, right: turn.to } : { left: turn.to, right: index };
}

function useBook() {
  const [index, setIndex] = useState(0);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [auto, setAuto] = useState(true);
  const go = (to: number, dir: Turn['dir']) => {
    if (turn || to === index) return;
    if (reducedMotion()) setIndex(to);
    else setTurn({ to, dir });
  };
  useEffect(() => {
    if (!auto || turn || reducedMotion()) return;
    const t = setTimeout(() => setTurn({ to: (index + 1) % COUNT, dir: 'next' }), AUTO_TURN_MS);
    return () => clearTimeout(t);
  }, [auto, turn, index]);
  const finish = () => {
    if (turn) setIndex(turn.to);
    setTurn(null);
  };
  const byHand = (to: number) => {
    setAuto(false);
    go((to + COUNT) % COUNT, to > index ? 'next' : 'prev');
  };
  return { index, turn, finish, byHand };
}

/** BookLeaf's story as a real book: it tilts with the pointer and its leaves turn. */
export function LeafBook() {
  const { index, turn, finish, byHand } = useBook();
  const shown = halves(index, turn);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') byHand(index + 1);
    if (e.key === 'ArrowLeft') byHand(index - 1);
  };
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-full max-w-[640px] [perspective:2200px]">
        <div
          role="region"
          aria-roledescription="book"
          aria-label={`What BookLeaf does: ${SPREADS[index]?.label ?? ''}, page ${index + 1} of ${COUNT}`}
          tabIndex={0}
          onKeyDown={onKey}
          className="relative aspect-[1.6] w-full rounded-[14px] transition-transform duration-300 ease-out [transform-style:preserve-3d] [transform:rotateX(calc(8deg+var(--rx,0deg)))_rotateY(var(--ry,0deg))] focus-visible:outline-offset-8"
        >
          <span className="absolute -inset-3 rounded-[18px] bg-[linear-gradient(135deg,#f16977,#c8384c)] shadow-[0_40px_80px_-20px_rgb(169_45_66/0.55)] [transform:translateZ(-24px)]" />
          <span className="absolute -inset-1.5 rounded-[14px] bg-[repeating-linear-gradient(90deg,var(--paper-edge-a)_0_1px,var(--paper-edge-b)_1px_3px)] [transform:translateZ(-10px)]" />
          <div className="absolute inset-y-0 left-0 w-1/2">
            <LeftPage index={shown.left} />
          </div>
          <div className="absolute inset-y-0 right-0 w-1/2">
            <RightPage index={shown.right} />
          </div>
          <span className="absolute inset-y-0 left-1/2 z-10 w-8 -translate-x-1/2 bg-[linear-gradient(90deg,transparent,var(--paper-spine),transparent)]" />
          {turn ? <TurningLeaf from={index} turn={turn} onDone={finish} /> : null}
        </div>
      </div>
      <BookControls index={index} onGo={byHand} />
    </div>
  );
}

function BookControls({ index, onGo }: { index: number; onGo: (to: number) => void }) {
  const round =
    'grid h-10 w-10 place-items-center rounded-full bg-panel/80 text-ink shadow-card backdrop-blur transition hover:scale-105 hover:text-brand-ink';
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className={round}
        aria-label="Previous page"
        onClick={() => onGo(index - 1)}
      >
        <ChevronLeft size={18} aria-hidden />
      </button>
      <div className="flex gap-1.5 rounded-full bg-panel/70 p-1 shadow-card backdrop-blur">
        {SPREADS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-current={i === index}
            onClick={() => onGo(i)}
            className={`h-8 rounded-full px-3 text-[12.5px] font-semibold transition-all ${i === index ? 'bg-brand text-white' : 'text-ink-2 hover:text-ink'}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={round}
        aria-label="Next page"
        onClick={() => onGo(index + 1)}
      >
        <ChevronRight size={18} aria-hidden />
      </button>
    </div>
  );
}
