import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';
import { CopyButton } from './CopyButton';

interface Props {
  title: string;
  body: string;
  secret: string;
  onDone: () => void;
}

/** A secret shown once, with a copy button; it is gone when the admin closes it. */
export function OneTimeSecret({ title, body, secret, onDone }: Props) {
  return (
    <Card role="region" aria-label={title} className="flex flex-col gap-3 border-brand p-5">
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="text-[12.5px] text-ink-2">{body}</p>
      <code className="rounded-[9px] bg-inset p-3 font-mono text-[12.5px] break-all select-all">
        {secret}
      </code>
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton value={secret} label="Copy the signing secret" text="Copy secret" />
        <Button variant="secondary" onClick={onDone}>
          I have copied it
        </Button>
      </div>
    </Card>
  );
}
