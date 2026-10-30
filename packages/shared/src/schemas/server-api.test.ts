import { describe, expect, it } from 'vitest';
import {
  API_KEY_PRESETS,
  API_KEY_SCOPES,
  CreateApiKeyRequestSchema,
  presetOf,
  scopeLabel,
} from './api-keys.js';
import {
  ServerCreateTicketSchema,
  ServerCustomerParamSchema,
  ServerMessageRequestSchema,
  ServerStatusChangeSchema,
} from './server-api.js';

const ticket = {
  customerId: 'AUTH001',
  subject: 'Royalty question',
  body: 'My royalty for last quarter looks lower than expected.',
};

describe('API key scopes', () => {
  it('has a readable label for every scope', () => {
    expect(API_KEY_SCOPES.map(scopeLabel)).toEqual([
      'Read customers',
      'Read tickets',
      'Create & update tickets',
    ]);
  });

  it('offers Read only and Read & write presets made of real scopes', () => {
    expect(API_KEY_PRESETS.read).toEqual(['tickets:read', 'customers:read']);
    expect(API_KEY_PRESETS.write).toEqual(['tickets:read', 'customers:read', 'tickets:write']);
  });

  it('names the preset a scope set matches, in any order, or custom', () => {
    expect(presetOf(['customers:read', 'tickets:read'])).toBe('read');
    expect(presetOf(['tickets:write', 'customers:read', 'tickets:read'])).toBe('write');
    expect(presetOf(['tickets:read'])).toBe('custom');
  });

  it('refuses an empty, unknown or repeated scope list', () => {
    const create = (scopes: string[]) =>
      CreateApiKeyRequestSchema.safeParse({ name: 'Server', scopes }).success;
    expect(create([])).toBe(false);
    expect(create(['tickets:delete'])).toBe(false);
    expect(create(['tickets:read', 'tickets:read'])).toBe(false);
    expect(create(['tickets:read'])).toBe(true);
  });
});

describe('server API request bodies', () => {
  it('accepts a ticket with an optional item id and cleans the text', () => {
    const parsed = ServerCreateTicketSchema.parse({
      ...ticket,
      subject: '  <b>Royalty</b> question ',
      itemId: 'BK001',
    });
    expect(parsed).toMatchObject({ subject: 'Royalty question', itemId: 'BK001' });
    expect(ServerCreateTicketSchema.parse(ticket).itemId).toBeNull();
  });

  it('refuses bad customer ids, short subjects and short bodies', () => {
    const bad = (v: object) => ServerCreateTicketSchema.safeParse({ ...ticket, ...v }).success;
    expect(bad({ customerId: '../etc' })).toBe(false);
    expect(bad({ customerId: '' })).toBe(false);
    expect(bad({ customerId: 'x'.repeat(101) })).toBe(false);
    expect(bad({ subject: 'Hi' })).toBe(false);
    expect(bad({ body: 'too short' })).toBe(false);
    expect(bad({ body: 'x'.repeat(4001) })).toBe(false);
    expect(bad({ itemId: 'a b' })).toBe(false);
  });

  it('takes a message body of 1 to 4000 characters', () => {
    expect(ServerMessageRequestSchema.safeParse({ body: 'ok' }).success).toBe(true);
    expect(ServerMessageRequestSchema.safeParse({ body: '   ' }).success).toBe(false);
    expect(ServerMessageRequestSchema.safeParse({ body: 'x'.repeat(4001) }).success).toBe(false);
  });

  it('allows only resolve, close and reopen as status changes', () => {
    const ok = (status: string) => ServerStatusChangeSchema.safeParse({ status }).success;
    expect(['RESOLVED', 'CLOSED', 'OPEN'].map(ok)).toEqual([true, true, true]);
    expect(ok('IN_PROGRESS')).toBe(false);
  });

  it('validates the customer path parameter', () => {
    expect(ServerCustomerParamSchema.safeParse({ customerId: 'AUTH001' }).success).toBe(true);
    expect(ServerCustomerParamSchema.safeParse({ customerId: '..' }).success).toBe(false);
  });
});
