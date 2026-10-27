import { useSignInOptions } from '../../lib/hostSignIn';
import { Card } from '../atoms/Card';

/** Shown when there is no session and no host page to ask for a new one. */
export function SignedOutNote() {
  const options = useSignInOptions();
  const url = options.data?.hostSignInUrl ?? null;
  return (
    <div className="grid h-full place-items-center p-6">
      <Card className="max-w-[420px] p-7 text-center">
        <p className="text-[16px] font-bold">Your help session ended</p>
        <p className="mt-2 text-[13.5px] text-ink-2">Open Help again from your BookLeaf account.</p>
        {url ? (
          <a href={url} className="mt-4 inline-block font-semibold text-brand underline">
            Back to BookLeaf
          </a>
        ) : null}
      </Card>
    </div>
  );
}
