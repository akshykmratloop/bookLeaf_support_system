import { describe, expect, it } from 'vitest';
import { usedTokenIds } from '../auth/used-tokens.js';
import { createSessionTokens, type Session } from '../auth/session.js';
import { UnauthorizedError } from '../../platform/errors.js';
import { memoryBackend } from '../../platform/shared-state/memory/index.js';
import { createStreamTickets, STREAM_TICKET_SECONDS } from './stream-ticket.js';

const SECRET = 'unit-test-jwt-secret-that-is-long-enough-123';
const CALL = '0b9a4a8e-9a4f-4a8f-9c1f-0f6a5f3f6d11';
const OTHER_CALL = '6b1f3c2d-7e4a-4b5c-8d9e-0a1b2c3d4e5f';
const SESSION: Session = {
  userId: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
  workspaceId: '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a',
  role: 'AUTHOR',
  authorId: '3e4f5a6b-7c8d-4e9f-8a1b-2c3d4e5f6a7b',
  name: 'Priya Sharma',
  email: 'priya.sharma@email.com',
};

function setup() {
  let now = new Date('2026-10-29T10:00:00Z');
  const clock = { now: () => now, dataAsOf: () => new Date('2025-12-31T00:00:00Z') };
  const used = usedTokenIds(memoryBackend(() => now.getTime()).claims, clock, 'voice-stream');
  const tickets = createStreamTickets(SECRET, clock, used);
  const advance = (seconds: number) => {
    now = new Date(now.getTime() + seconds * 1000);
  };
  return { clock, tickets, advance };
}

describe('voice stream tickets', () => {
  it('opens the call it was issued for, as the session it was issued to', async () => {
    const { tickets } = setup();
    const ticket = await tickets.issue(SESSION, CALL);
    await expect(tickets.redeem(ticket, CALL)).resolves.toEqual(SESSION);
  });

  it('works once: a replayed ticket is refused', async () => {
    const { tickets } = setup();
    const ticket = await tickets.issue(SESSION, CALL);
    await tickets.redeem(ticket, CALL);
    await expect(tickets.redeem(ticket, CALL)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('cannot open a different call', async () => {
    const { tickets } = setup();
    const ticket = await tickets.issue(SESSION, CALL);
    await expect(tickets.redeem(ticket, OTHER_CALL)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it(`expires after ${STREAM_TICKET_SECONDS} seconds`, async () => {
    const { tickets, advance } = setup();
    const ticket = await tickets.issue(SESSION, CALL);
    advance(STREAM_TICKET_SECONDS + 1);
    await expect(tickets.redeem(ticket, CALL)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('is not interchangeable with the session cookie', async () => {
    const { tickets, clock } = setup();
    const sessions = createSessionTokens(SECRET, 8, clock);
    const cookie = await sessions.sign(SESSION, 1);
    await expect(tickets.redeem(cookie, CALL)).rejects.toBeInstanceOf(UnauthorizedError);
    const ticket = await tickets.issue(SESSION, CALL);
    await expect(sessions.verify(ticket)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('refuses garbage', async () => {
    const { tickets } = setup();
    await expect(tickets.redeem('not-a-token', CALL)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
