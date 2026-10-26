import type { LlmProvider, StructuredRequest, StructuredResult } from '../types.js';

export type FakeHandler = (req: StructuredRequest<unknown>) => unknown | Promise<unknown>;

/**
 * Deterministic provider for tests and local runs without a key. The handler returns the raw
 * object (or throws an AiError to simulate failures); the schema still validates it.
 */
export function fakeProvider(handler: FakeHandler): LlmProvider & { calls: StructuredRequest<unknown>[] } {
  const calls: StructuredRequest<unknown>[] = [];
  return {
    id: 'fake',
    calls,
    async generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
      calls.push(req as StructuredRequest<unknown>);
      const raw = await handler(req as StructuredRequest<unknown>);
      const data = req.schema.parse(raw);
      return {
        data,
        model: req.model,
        latencyMs: 1,
        usage: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 0, cacheWriteTokens: 0 },
      };
    },
    async ping() {
      await handler({ task: 'TEST' } as StructuredRequest<unknown>);
    },
  };
}
