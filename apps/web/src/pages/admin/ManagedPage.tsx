import { ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { Card } from '../../components/atoms/Card';

/**
 * Old links to the AI Settings and provider key screens (U-7): AI providers, models and keys
 * are now the support provider's. The API refuses those endpoints with 403 too.
 */
export function ManagedPage() {
  return (
    <Card className="mx-auto mt-10 flex max-w-[520px] flex-col items-center gap-3 p-8 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand-ink">
        <ShieldCheck size={20} aria-hidden />
      </span>
      <h1 className="text-[18px] font-semibold">Managed by your support provider</h1>
      <p className="text-[13px] text-ink-2">
        AI providers, models and keys are set up for you. You can still choose how the AI writes,
        and switch chat and voice on or off, in Workspace settings.
      </p>
      <Link
        to="/admin/workspace/settings"
        className="mt-1 text-[13px] font-semibold text-brand-ink underline-offset-2 hover:underline focus-visible:ring-4 focus-visible:ring-brand/25 focus-visible:outline-none"
      >
        Open workspace settings
      </Link>
    </Card>
  );
}
