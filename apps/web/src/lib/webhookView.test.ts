import type { WebhookDelivery } from '@bookleaf/shared';
import { describe, expect, it } from 'vitest';
import { attemptsText, deliveryStatus, eventLabel, responseText, withEvent } from './webhookView';

const delivery = (patch: Partial<WebhookDelivery>): WebhookDelivery => ({
  id: 'd1',
  event: 'ticket.created',
  status: 'PENDING',
  attempts: 0,
  responseStatus: null,
  lastError: null,
  createdAt: '2026-10-30T10:00:00.000Z',
  deliveredAt: null,
  nextAttemptAt: '2026-10-30T10:00:00.000Z',
  ...patch,
});

describe('webhook view helpers', () => {
  it('names each event in plain words, and shows unknown ones as they are', () => {
    expect(eventLabel('ticket.created')).toBe('Ticket created');
    expect(eventLabel('ticket.replied')).toBe('Staff reply sent');
    expect(eventLabel('ticket.status_changed')).toBe('Status changed');
    expect(eventLabel('webhook.test')).toBe('Test delivery');
    expect(eventLabel('ticket.merged')).toBe('ticket.merged');
  });

  it('labels a delivery by where it is: queued, retrying, delivered, failed', () => {
    expect(deliveryStatus(delivery({}))).toEqual({ label: 'Queued', tone: 'info' });
    expect(deliveryStatus(delivery({ attempts: 2 }))).toEqual({
      label: 'Retrying',
      tone: 'warning',
    });
    expect(deliveryStatus(delivery({ status: 'SUCCEEDED', attempts: 1 }))).toEqual({
      label: 'Delivered',
      tone: 'success',
    });
    expect(deliveryStatus(delivery({ status: 'FAILED', attempts: 6 }))).toEqual({
      label: 'Failed',
      tone: 'danger',
    });
  });

  it('shows the answer code, or the error when there was no answer', () => {
    expect(responseText(delivery({ responseStatus: 204 }))).toBe('HTTP 204');
    expect(responseText(delivery({ lastError: 'connect ECONNREFUSED' }))).toBe(
      'connect ECONNREFUSED',
    );
    expect(responseText(delivery({}))).toBe('No answer yet');
  });

  it('counts attempts out of the maximum, with the next try for a waiting delivery', () => {
    const fmt = (iso: string) => `at ${iso.slice(11, 16)}`;
    expect(attemptsText(delivery({ status: 'SUCCEEDED', attempts: 1 }), fmt)).toBe(
      'Attempt 1 of 6',
    );
    expect(
      attemptsText(delivery({ attempts: 2, nextAttemptAt: '2026-10-30T10:05:00.000Z' }), fmt),
    ).toBe('Attempt 2 of 6 · next try at 10:05');
    expect(attemptsText(delivery({ attempts: 0 }), fmt)).toBe('Not sent yet');
  });

  it('adds or removes an event, keeping the fixed order and no duplicates', () => {
    expect(withEvent(['ticket.status_changed'], 'ticket.created', true)).toEqual([
      'ticket.created',
      'ticket.status_changed',
    ]);
    expect(withEvent(['ticket.created'], 'ticket.created', true)).toEqual(['ticket.created']);
    expect(withEvent(['ticket.created', 'ticket.replied'], 'ticket.created', false)).toEqual([
      'ticket.replied',
    ]);
  });
});
