import type { Prisma } from '@prisma/client';
import { ConflictError, UsageLimitError } from '../../platform/errors.js';
import type { AssistantLimits } from '../assistant/limits.js';
import { countCallsSince } from './repository.js';

const HOUR_MS = 3_600_000;

/** One live call per author, plus hourly and daily caps. Run inside the author-row lock. */
export async function checkQuota(
  tx: Prisma.TransactionClient,
  limits: AssistantLimits['voice'],
  authorId: string,
  now: Date,
): Promise<void> {
  const active = await tx.voiceSession.count({
    where: { authorId, status: { in: ['PENDING', 'ACTIVE'] } },
  });
  if (active > 0)
    throw new ConflictError('VOICE_CALL_ACTIVE', 'You already have a call in progress.');
  const lastHour = await countCallsSince(tx, authorId, new Date(now.getTime() - HOUR_MS));
  if (lastHour >= limits.callsPerHour)
    throw new UsageLimitError(
      'VOICE_HOURLY_LIMIT',
      `You can make ${limits.callsPerHour} calls per hour. Please try again later or use chat.`,
    );
  const lastDay = await countCallsSince(tx, authorId, new Date(now.getTime() - 24 * HOUR_MS));
  if (lastDay >= limits.callsPerDay)
    throw new UsageLimitError(
      'VOICE_DAILY_LIMIT',
      `You've reached today's limit of ${limits.callsPerDay} calls. You can still use chat or raise a ticket.`,
    );
}
