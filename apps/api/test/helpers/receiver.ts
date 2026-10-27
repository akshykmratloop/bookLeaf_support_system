import { createServer, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface Received {
  headers: IncomingHttpHeaders;
  body: string;
}

/** A real HTTP endpoint that records what it is sent and answers with the next queued status. */
export async function startReceiver() {
  const received: Received[] = [];
  const statuses: number[] = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c: Buffer) => (body += c.toString()));
    req.on('end', () => {
      received.push({ headers: req.headers, body });
      res.statusCode = statuses.shift() ?? 200;
      res.end('ok');
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/hooks/bookleaf`,
    received,
    /** Answers the next requests with these statuses (then 200). */
    answerWith: (...codes: number[]) => statuses.push(...codes),
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}
