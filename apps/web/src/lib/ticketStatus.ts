import type { TicketStatus } from '@bookleaf/shared';
import type { Tone } from '../components/atoms/Pill';

export interface RequesterStatus {
  label: string;
  /** One plain sentence: what is happening and what the author can do. */
  description: string;
  tone: Tone;
  /** Position on the Received → In progress → Solved stepper. */
  step: number;
}

export const REQUESTER_STEPS = ['Received', 'In progress', 'Solved'] as const;

const BY_STATUS: Record<TicketStatus, RequesterStatus> = {
  OPEN: {
    label: 'Received',
    description: 'We have your request. The support team will reply here.',
    tone: 'info',
    step: 0,
  },
  IN_PROGRESS: {
    label: 'In progress',
    description: 'The support team is working on it.',
    tone: 'brand',
    step: 1,
  },
  RESOLVED: {
    label: 'Solved',
    description: 'This is marked solved. Reply if you still need help, and it opens again.',
    tone: 'success',
    step: 2,
  },
  CLOSED: {
    label: 'Closed',
    description: 'This ticket is closed. Raise a new ticket if you need more help.',
    tone: 'neutral',
    step: 2,
  },
};

const AWAITING: Omit<RequesterStatus, 'step'> = {
  label: 'Needs your reply',
  description: 'The support team replied and is waiting for you.',
  tone: 'warning',
};

/** The status as the author sees it (the requester view). */
export function requesterStatus(t: {
  status: TicketStatus;
  awaitingYou: boolean;
}): RequesterStatus {
  const base = BY_STATUS[t.status];
  return t.awaitingYou ? { ...AWAITING, step: base.step } : base;
}
