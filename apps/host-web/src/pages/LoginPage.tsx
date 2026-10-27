import { useRef } from 'react';
import { Logo } from '../components/Logo';
import { Aurora } from '../components/login/Aurora';
import { LeafBook } from '../components/login/LeafBook';
import { SignInCard } from '../components/login/SignInCard';
import { useTilt } from '../components/login/useTilt';

/**
 * BookLeaf's sign-in. One canvas: a living backdrop, BookLeaf's story as a book whose leaves
 * turn (it tilts with the pointer), and the sign-in card. The book is hidden on small screens.
 */
export function LoginPage() {
  const stage = useRef<HTMLDivElement>(null);
  useTilt(stage);
  return (
    <div
      ref={stage}
      className="relative h-full overflow-x-hidden overflow-y-auto overscroll-none bg-[linear-gradient(160deg,var(--brand-soft),var(--bg)_45%,var(--cream))]"
    >
      <Aurora />
      <div className="relative mx-auto flex min-h-full max-w-[1320px] flex-col gap-8 px-6 py-8 lg:px-12">
        <header className="flex items-center justify-between">
          <Logo size="lg" />
          <a
            href="https://www.bookleafpub.in/"
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-full bg-panel/70 px-4 py-2 text-[13px] font-semibold text-ink-2 shadow-card backdrop-blur hover:text-brand-ink sm:inline"
          >
            bookleafpub.in ↗
          </a>
        </header>
        <main className="grid flex-1 items-center gap-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <section
            aria-label="What BookLeaf does"
            className="light-scope hidden flex-col gap-8 lg:flex"
          >
            <h2 className="animate-rise text-[46px] leading-[1.08] font-light tracking-tight text-brand-ink">
              Publishing made easy.
              <span className="block text-ink">Turn the page on your book.</span>
            </h2>
            <LeafBook />
          </section>
          <div className="flex justify-center lg:justify-end">
            <SignInCard />
          </div>
        </main>
        <p className="text-center text-[12px] text-ink-3 lg:text-left">
          A demo of BookLeaf's author platform.
        </p>
      </div>
    </div>
  );
}
