import type { Webhook } from '@bookleaf/shared';
import { ChevronDown, KeyRound, Pencil, Power, Send, Trash2 } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Pill } from '../atoms/Pill';
import { dateTime } from '../../lib/format';
import { deliveryStatus, eventLabel, responseText } from '../../lib/webhookView';
import type { WebhookActions } from './useWebhookActions';
import { WebhookDeliveryLog } from './WebhookDeliveryLog';

interface Props {
  w: Webhook;
  actions: WebhookActions;
  isOpen: boolean;
  onOpenLog: () => void;
  onEdit: () => void;
}

function LastDelivery({ w }: { w: Webhook }) {
  const d = w.lastDelivery;
  if (!d) return <p className="text-[12px] text-ink-3">No deliveries yet</p>;
  return (
    <p className="text-[12px] text-ink-2">
      Last delivery: {deliveryStatus(d).label} · {eventLabel(d.event)} · {responseText(d)} ·{' '}
      <time dateTime={d.createdAt}>{dateTime(d.createdAt)}</time>
    </p>
  );
}

function RowActions({ w, actions, onEdit }: Pick<Props, 'w' | 'actions' | 'onEdit'>) {
  const icon = (I: typeof Send) => <I size={14} aria-hidden />;
  return (
    <div className="flex flex-wrap gap-1">
      <Button
        variant="secondary"
        size="sm"
        icon={icon(Send)}
        disabled={!w.active || actions.busy}
        title={w.active ? undefined : 'Switch the webhook on to send a test'}
        onClick={() => actions.test(w)}
      >
        Send test
      </Button>
      <Button variant="ghost" size="sm" icon={icon(Pencil)} onClick={onEdit}>
        Edit
      </Button>
      <Button
        variant={w.active ? 'ghost' : 'soft'}
        size="sm"
        icon={icon(Power)}
        disabled={actions.busy}
        onClick={() => actions.toggle(w)}
      >
        {w.active ? 'Switch off' : 'Switch on'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        icon={icon(KeyRound)}
        disabled={actions.busy}
        onClick={() => actions.rotate(w)}
      >
        Rotate secret
      </Button>
      <Button
        variant="danger"
        size="sm"
        icon={icon(Trash2)}
        disabled={actions.busy}
        onClick={() => actions.remove(w)}
      >
        Delete
      </Button>
    </div>
  );
}

/** One webhook: where it sends, which events, how the last delivery went, and its actions. */
export function WebhookRow({ w, actions, isOpen, onOpenLog, onEdit }: Props) {
  const logId = `webhook-log-${w.id}`;
  return (
    <li className="flex flex-col gap-3 border-b border-line px-4 py-4 last:border-b-0">
      <div className="flex flex-wrap items-start gap-2">
        <code className="min-w-0 flex-1 font-mono text-[13px] font-semibold break-all">
          {w.url}
        </code>
        {w.active ? (
          <Pill tone="success" dot>
            On
          </Pill>
        ) : (
          <Pill tone="warning" dot>
            Off
          </Pill>
        )}
      </div>
      <ul aria-label="Events" className="flex flex-wrap gap-1.5">
        {w.events.map((e) => (
          <li key={e}>
            <Pill tone="brand">{eventLabel(e)}</Pill>
          </li>
        ))}
      </ul>
      <LastDelivery w={w} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RowActions w={w} actions={actions} onEdit={onEdit} />
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={isOpen}
          aria-controls={logId}
          icon={
            <ChevronDown
              size={14}
              aria-hidden
              className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'}
            />
          }
          onClick={onOpenLog}
        >
          Delivery log
        </Button>
      </div>
      {isOpen ? (
        <div id={logId} className="rounded-[9px] bg-inset px-3 py-2">
          <WebhookDeliveryLog webhookId={w.id} active={w.active} />
        </div>
      ) : null}
    </li>
  );
}
