import { LoadingState } from '../../components/molecules/States';
import { useHostSignIn } from '../../lib/useHostSignIn';
import { AssistantPage } from '../author/AssistantPage';

/**
 * No link out to the full app here: in a cross-site iframe the session cookie is partitioned
 * to the host, so a plain link would open without it. The widget's "open in a new tab" button
 * signs the author in there with a fresh token instead.
 */
function EmbedHeader() {
  return (
    <header className="border-b border-line px-4 py-3">
      <p className="text-[14px] font-semibold">BookLeaf support</p>
    </header>
  );
}

/**
 * The support widget inside the host's iframe (`/embed#t=<hand-over token>`): no app shell,
 * just the assistant. The page itself stays still; only the content area scrolls.
 */
export function EmbedPage() {
  const { user, error } = useHostSignIn();
  if (error)
    return (
      <p role="alert" className="p-4 text-[13.5px]">
        {error} Please close help and open it again.
      </p>
    );
  if (!user) return <LoadingState label="Opening support…" />;
  return (
    <div className="flex h-full flex-col overflow-hidden bg-app">
      <EmbedHeader />
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-none p-3">
        <AssistantPage />
      </main>
    </div>
  );
}
