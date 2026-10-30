import { describe, expect, it } from 'vitest';
import { REQUESTER_STEPS, requesterStatus } from './ticketStatus';

describe('requesterStatus', () => {
  it('describes each status in plain words, with its step', () => {
    expect(requesterStatus({ status: 'OPEN', awaitingYou: false })).toMatchObject({
      label: 'Received',
      step: 0,
    });
    expect(requesterStatus({ status: 'IN_PROGRESS', awaitingYou: false })).toMatchObject({
      label: 'In progress',
      step: 1,
    });
    expect(requesterStatus({ status: 'RESOLVED', awaitingYou: false })).toMatchObject({
      label: 'Solved',
      step: 2,
    });
    expect(requesterStatus({ status: 'CLOSED', awaitingYou: false }).step).toBe(2);
    expect(REQUESTER_STEPS).toEqual(['Received', 'In progress', 'Solved']);
  });

  it('puts "needs your reply" first when the team is waiting for the author', () => {
    expect(requesterStatus({ status: 'IN_PROGRESS', awaitingYou: true })).toMatchObject({
      label: 'Needs your reply',
      tone: 'warning',
      step: 1,
    });
  });

  it('tells the author a solved or closed ticket is locked and how to get more help (U-2)', () => {
    for (const status of ['RESOLVED', 'CLOSED'] as const) {
      const { description } = requesterStatus({ status, awaitingYou: false });
      expect(description).toMatch(/raise a new ticket/i);
      expect(description).not.toMatch(/opens again|reply if/i);
    }
  });
});
