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
  /** The lease this worker set when it claimed the job; writes are conditional on it. */
  leaseExpiresAt: Date;
}

export interface JobDeps {
  db: Db;
  ai: AiRuntime;
  clock: Clock;
  events: EventBus;
  records: HostRecords;
  log: Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>;
  /** Most AI runs a workspace may make in 24 h before ticket jobs fall back (AI_BUDGET). */
  ticketRunsPerWorkspacePerDay?: number;
}

export interface JobHandler {
  /** Calls the AI and stores the result. Throws AiError on provider failure. */
  runAi(job: ClaimedJob, deps: JobDeps): Promise<void>;
  /** Stores a rule-based result. Must not call the AI. */
  fallback(job: ClaimedJob, deps: JobDeps): Promise<void>;
}
