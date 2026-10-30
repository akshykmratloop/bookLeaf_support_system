import { describe, expect, it } from 'vitest';
import { UpdateWebhookRequestSchema, WebhookDeliveryParamsSchema } from './webhooks.js';

const ID = '4b0c3a52-8f1e-4d2a-9d6b-1c2e3f4a5b6c';

describe('UpdateWebhookRequestSchema', () => {
  it.each([
    { active: false },
    { events: ['ticket.replied'] },
    { url: '  https://hooks.example.com/bookleaf  ' },
  ])('accepts %j', (body) => {
    expect(UpdateWebhookRequestSchema.safeParse(body).success).toBe(true);
  });

  it('trims the address', () => {
    const r = UpdateWebhookRequestSchema.parse({ url: ' https://a.example/x ' });
    expect(r.url).toBe('https://a.example/x');
  });

  it.each([
    {},
    { url: 'ftp://a.example' },
    { url: 'https://a.example/has a space' },
    { url: `https://a.example/${'x'.repeat(2048)}` },
    { events: [] },
    { events: ['ticket.deleted'] },
    { active: 'yes' },
  ])('refuses %j', (body) => {
    expect(UpdateWebhookRequestSchema.safeParse(body).success).toBe(false);
  });
});

describe('WebhookDeliveryParamsSchema', () => {
  it('needs two uuids', () => {
    expect(WebhookDeliveryParamsSchema.safeParse({ id: ID, deliveryId: ID }).success).toBe(true);
    expect(WebhookDeliveryParamsSchema.safeParse({ id: ID, deliveryId: 'x' }).success).toBe(false);
  });
});
