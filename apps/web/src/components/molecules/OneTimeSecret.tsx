import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';

type CopyState = 'idle' | 'copied' | 'failed';

interface Props {
  title: string;
  body: string;
  secret: string;
  onDone: () => void;
}

/** A secret shown once, with a copy button; it is gone when the admin closes it. */
export function OneTimeSecret({ title, body, secret, onDone }: Props) {
  const [copy, setCopy] = useState<CopyState>('idle');
  // Wrapped so a missing clipboard (plain-http page) lands in the same "failed" branch.
  const onCopy = () =>
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(secret))
      .then(
        () => setCopy('copied'),
        () => setCopy('failed'),
      );
  return (
    <Card role="region" aria-label={title} className="flex flex-col gap-3 border-brand p-5">
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="text-[12.5px] text-ink-2">{body}</p>
      <code className="rounded-[9px] bg-inset p-3 font-mono text-[12.5px] break-all select-all">
        {secret}
      </code>
      <p aria-live="polite" className="text-[12px] text-ink-3">
        {copy === 'copied' ? 'Copied to the clipboard.' : null}
        {copy === 'failed' ? 'Copying is blocked here: select the text and copy it.' : null}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="soft"
          icon={
            copy === 'copied' ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />
          }
          onClick={() => void onCopy()}
        >
          Copy secret
        </Button>
        <Button variant="secondary" onClick={onDone}>
          I have copied it
        </Button>
      </div>
    </Card>
  );
}
