import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db.js';
import type { EventBus } from '../../platform/event-bus.js';

export interface TicketDeps {
  db: Db;
  clock: Clock;
  events: EventBus;
}
