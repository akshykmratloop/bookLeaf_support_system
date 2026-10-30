import type { WebhookDelivery } from '@bookleaf/shared';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Pill } from '../atoms/Pill';
import { ErrorState, LoadingState } from '../molecules/States';
import { useToast } from '../molecules/Toast';
import { errorMessage } from '../../lib/api';
import { dateTime } from '../../lib/format';
import { useApiMutation } from '../../lib/queries';
import { attemptsText, deliveryStatus, eventLabel, responseText } from '../../lib/webhookView';
import { retryWebhookDelivery, useWebhookDeliveries, webhookKeys } from '../../lib/webhooks';

interface RowProps {
  d: WebhookDelivery;
  canRetry: boolean;
  busy: boolean;
  onRetry: () => void;
}

function DeliveryRow({ d, canRetry, busy, onRetry }: RowProps) {
  const status = deliveryStatus(d);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-2.5 last:border-b-0">
      <Pill tone={status.tone} dot>
        {status.label}
      </Pill>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold">{eventLabel(d.event)}</p>
        <p className="text-[12px] break-words text-ink-2">
          <time dateTime={d.createdAt}>{dateTime(d.createdAt)}</time> · {responseText(d)} ·{' '}
          {attemptsText(d, dateTime)}
        </p>
      </div>
      {d.status === 'FAILED' && canRetry ? (
        <Button
          variant="secondary"
          size="sm"
          icon={<RotateCcw size={14} aria-hidden />}
          disabled={busy}
          aria-label={`Retry the ${eventLabel(d.event)} delivery from ${dateTime(d.createdAt)}`}
          onClick={onRetry}
        >
          Retry
        </Button>
      ) : null}
    </li>
  );
}

/** The 20 latest deliveries of one webhook: status, HTTP answer, time and attempts. */
export function WebhookDeliveryLog({ webhookId, active }: { webhookId: string; active: boolean }) {
  const toast = useToast();
  const log = useWebhookDeliveries(webhookId);
  const retry = useApiMutation(retryWebhookDelivery, [webhookKeys.deliveries(webhookId)]);
  const onRetry = (deliveryId: string) =>
    retry.mutate(
      { id: webhookId, deliveryId },
      {
        onSuccess: () => toast('success', 'Delivery queued again'),
        onError: (e) => toast('error', errorMessage(e)),
      },
    );
  return (
    <section aria-label="Recent deliveries" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-bold">Recent deliveries</h3>
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw size={14} aria-hidden />}
          isLoading={log.isFetching}
          onClick={() => void log.refetch()}
        >
          Refresh
        </Button>
      </div>
      {log.isPending ? <LoadingState /> : null}
      {log.isError ? <ErrorState error={log.error} onRetry={() => void log.refetch()} /> : null}
      {log.data?.length === 0 ? (
        <p className="text-[12.5px] text-ink-3">Nothing sent yet. Use “Send test” to try it.</p>
      ) : null}
      {log.data?.length ? (
        <ul>
          {log.data.map((d) => (
            <DeliveryRow
              key={d.id}
              d={d}
              canRetry={active}
              busy={retry.isPending}
              onRetry={() => onRetry(d.id)}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
