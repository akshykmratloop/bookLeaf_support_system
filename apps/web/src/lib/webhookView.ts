import {
  WEBHOOK_EVENTS,
  WEBHOOK_MAX_ATTEMPTS,
  type WebhookDelivery,
  type WebhookEvent,
} from '@bookleaf/shared';
import type { Tone } from '../components/atoms/Pill';

const EVENT_LABELS: Record<string, string> = {
  'ticket.created': 'Ticket created',
  'ticket.replied': 'Staff reply sent',
  'ticket.status_changed': 'Status changed',
  'webhook.test': 'Test delivery',
};

/** An event in plain words; an unknown one is shown as it is. */
export const eventLabel = (event: string): string => EVENT_LABELS[event] ?? event;

/** Where a delivery is: waiting for its first try, retrying, delivered, or given up. */
export function deliveryStatus(d: WebhookDelivery): { label: string; tone: Tone } {
  if (d.status === 'SUCCEEDED') return { label: 'Delivered', tone: 'success' };
  if (d.status === 'FAILED') return { label: 'Failed', tone: 'danger' };
  return d.attempts === 0
    ? { label: 'Queued', tone: 'info' }
    : { label: 'Retrying', tone: 'warning' };
}

/** The receiver's HTTP answer, or why there was none. */
export function responseText(d: WebhookDelivery): string {
  if (d.responseStatus !== null) return `HTTP ${d.responseStatus}`;
  return d.lastError ?? 'No answer yet';
}

/** "Attempt 2 of 6 · next try …"; the time is formatted by the caller. */
export function attemptsText(d: WebhookDelivery, formatTime: (iso: string) => string): string {
  if (d.attempts === 0) return 'Not sent yet';
  const base = `Attempt ${d.attempts} of ${WEBHOOK_MAX_ATTEMPTS}`;
  return d.status === 'PENDING' && d.nextAttemptAt
    ? `${base} · next try ${formatTime(d.nextAttemptAt)}`
    : base;
}

/** The event list with one event switched on or off, in the fixed order. */
export function withEvent(
  events: readonly WebhookEvent[],
  event: WebhookEvent,
  on: boolean,
): WebhookEvent[] {
  return WEBHOOK_EVENTS.filter((e) => (e === event ? on : events.includes(e)));
}
