/**
 * What the setup guide (U-12) knows about one workspace: plain facts read from the database,
 * with no wording. `steps.ts` turns them into the eight steps; `read-facts.ts` reads them.
 */
export interface LastTest {
  ok: boolean;
  at: Date;
  detail: string;
}

/** How the workspace's product connection is set: none, the server's env (BookLeaf), or saved. */
export type ConnectionFact =
  { kind: 'none' } | { kind: 'env' } | { kind: 'saved'; lastTest: LastTest | null };

export interface FailedDelivery {
  event: string;
  responseStatus: number | null;
  lastError: string | null;
}

export interface TestTicketFact {
  id: string;
  label: string;
  createdAt: Date;
}

export interface OnboardingFacts {
  /** Whether this server lets allowed sites frame the widget at all (embed mode). */
  embedded: boolean;
  connection: ConnectionFact;
  /** A full-shape (CONTRACT) source fills customer fields by key, without per-field mapping. */
  hasContractSource: boolean;
  fields: { total: number; mapped: number };
  handOverAt: Date | null;
  widgetLoad: { at: Date; origin: string } | null;
  /** The origins that may frame the widget now (the workspace's own, plus env for BookLeaf). */
  allowedOrigins: readonly string[];
  categories: number;
  articles: number;
  apiKeys: number;
  webhooks: number;
  /** The latest webhook delivery that gave up, when it is newer than every success. */
  failedDelivery: FailedDelivery | null;
  /** The first ticket from a real customer (not a "Send a test ticket" one). */
  firstRealTicketAt: Date | null;
  testTicket: TestTicketFact | null;
}
