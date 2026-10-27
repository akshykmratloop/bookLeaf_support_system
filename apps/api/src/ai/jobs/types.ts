import type { FastifyBaseLogger } from 'fastify';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db.js';
import type { EventBus } from '../../platform/event-bus.js';
import type { HostRecords } from '../../host/types.js';
import type { AiRuntime } from './runtime.js';

export type JobKind = 'TRIAGE' | 'DRAFT';

export interface ClaimedJob {
  id: string;
  ticketId: string;
  kind: JobKind;
  generation: number;
  attempts: number;
  maxAttempts: number;
}

export interface JobDeps {
  db: Db;
  ai: AiRuntime;
  clock: Clock;
  events: EventBus;
  records: HostRecords;
  log: Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>;
}

export interface JobHandler {
  /** Calls the AI and stores the result. Throws AiError on provider failure. */
  runAi(job: ClaimedJob, deps: JobDeps): Promise<void>;
  /** Stores a rule-based result. Must not call the AI. */
  fallback(job: ClaimedJob, deps: JobDeps): Promise<void>;
}
