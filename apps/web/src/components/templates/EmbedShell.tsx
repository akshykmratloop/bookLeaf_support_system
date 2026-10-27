import type { AuthUser } from '@bookleaf/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { isFramed, requestReauth, tellHost } from '../../lib/frame';
import { useSignInOptions } from '../../lib/hostSignIn';
import { useLiveUpdates } from '../../lib/live-updates';
import { useWorkspaceBrand } from '../../lib/useWorkspaceBrand';
import { useAuthorTickets } from '../../lib/queries';
import { Avatar } from '../atoms/Avatar';
import { SignedOutNote } from '../molecules/SignedOutNote';
import { EmbedNav } from './EmbedNav';

/** Full page (opened from the host, not in the widget): a way back, never a sign-out. */
function PageHeader({ user, brandName }: { user: AuthUser; brandName: string }) {
  const back = useSignInOptions().data?.hostSignInUrl ?? null;
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-panel px-4 lg:px-8">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <p className="flex-1 text-[16px] font-bold">{brandName} Help</p>
      {back ? (
        <a
          href={back}
          className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-[13px] font-semibold text-ink-2 hover:bg-panel-2 hover:text-ink"
        >
          <ArrowLeft size={15} aria-hidden /> Back to {brandName}
        </a>
      ) : null}
      <Avatar name={user.name} />
    </header>
  );
}

/** Esc inside the frame closes the widget, the same as Esc on the host page. */
function useEscapeToHost() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) tellHost('escape');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}

/** Fixed frame: only <main> scrolls. Tabs on top when narrow, a side rail when wide. */
export function EmbedShell({ user }: { user: AuthUser }) {
  const qc = useQueryClient();
  const { pathname } = useLocation();
  const [expired, setExpired] = useState(false);
  const framed = isFramed();
  const onExpired = useCallback(() => {
    qc.clear();
    if (framed) requestReauth(window.location.pathname);
    else setExpired(true);
  }, [qc, framed]);
  useLiveUpdates(onExpired);
  useEscapeToHost();
  const brandName = useWorkspaceBrand();
  const awaiting = (useAuthorTickets().data?.items ?? []).filter((t) => t.awaitingYou).length;
  if (expired) return <SignedOutNote />;
  return (
    <div className="flex h-full flex-col overflow-hidden bg-app">
      {framed ? null : <PageHeader user={user} brandName={brandName} />}
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[232px] shrink-0 flex-col gap-4 border-r border-line bg-panel p-4 lg:flex">
          <EmbedNav awaiting={awaiting} rail />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="shrink-0 px-3 pt-3 lg:hidden">
            <EmbedNav awaiting={awaiting} rail={false} />
          </div>
          <main key={pathname} className="min-h-0 flex-1 overflow-y-auto overscroll-none">
            <div className="mx-auto flex min-h-full w-full max-w-[1100px] flex-col px-4 py-4 lg:px-8 lg:py-7">
              <Outlet context={user} />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
