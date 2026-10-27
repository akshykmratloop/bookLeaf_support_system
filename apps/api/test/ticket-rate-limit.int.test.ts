import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TICKETS_PER_HOUR } from '../src/modules/tickets/routes.js';
import { call, createHarness, EMAILS, type Harness } from './helpers/app.js';

let h: Harness;
let rohit: string;
let arjun: string;

beforeAll(async () => {
  h = await createHarness();
  [rohit, arjun] = await Promise.all([h.login(EMAILS.rohit), h.login(EMAILS.arjun)]);
});
afterAll(() => h.close());

const raise = (cookie: string, n: number) =>
  call(h, 'POST', '/tickets', cookie, {
    bookId: null,
    subject: `Question ${n}`,
    description: 'I have a general question about my author account, please help.',
  });

describe('ticket creation is rate limited per author (each ticket starts paid AI work)', () => {
  it(`allows ${TICKETS_PER_HOUR} tickets an hour, then answers 429 for that author only`, async () => {
    for (let n = 0; n < TICKETS_PER_HOUR; n += 1)
      expect((await raise(rohit, n)).statusCode).toBe(201);
    const over = await raise(rohit, TICKETS_PER_HOUR);
    expect(over.statusCode).toBe(429);
    expect((await raise(arjun, 0)).statusCode).toBe(201);
  });
});
