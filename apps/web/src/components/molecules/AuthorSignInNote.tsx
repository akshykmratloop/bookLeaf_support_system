import { ExternalLink } from 'lucide-react';
import { useSignInOptions } from '../../lib/hostSignIn';

/** Authors never sign in here: they open support from their BookLeaf account. */
export function AuthorSignInNote() {
  const options = useSignInOptions();
  const url = options.data?.hostSignInUrl;
  return (
    <p className="mb-6 rounded-control bg-brand-soft p-3 text-[12.5px] text-brand">
      Authors: open support from your BookLeaf account.{' '}
      {url ? (
        <a className="inline-flex items-center gap-1 font-semibold underline" href={url}>
          Go to BookLeaf <ExternalLink size={12} aria-hidden />
        </a>
      ) : null}
    </p>
  );
}
