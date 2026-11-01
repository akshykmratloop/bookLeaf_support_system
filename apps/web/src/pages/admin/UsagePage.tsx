import { Coins } from 'lucide-react';
import { PageHeader } from '../../components/molecules/PageHeader';
import { AiUsagePanel } from '../../components/organisms/AiUsagePanel';
import { useWorkspaceAiUsage } from '../../lib/aiUsage';

/** /admin/usage — what AI cost this workspace over the last 30 days. Visibility only, no billing. */
export function UsagePage() {
  const usage = useWorkspaceAiUsage();
  return (
    <>
      <PageHeader
        title="AI usage"
        subtitle="What AI cost this workspace: sorting tickets, drafting replies, author chat and voice calls."
        actions={<Coins size={18} aria-hidden className="text-ink-3" />}
      />
      <AiUsagePanel query={usage} />
    </>
  );
}
