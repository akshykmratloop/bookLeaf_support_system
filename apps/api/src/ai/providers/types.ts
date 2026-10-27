import type { z } from 'zod';

export type AiTask = 'TRIAGE' | 'DRAFT' | 'CHAT' | 'TEST';

/** Domain-level request: no vendor types leak past this interface. */
export interface StructuredRequest<T> {
  task: AiTask;
  model: string;
  /** Stable instructions (cache-eligible), identical across tickets. */
  stableSystem: string;
  /** Per-ticket context appended after the stable block. */
  dynamicSystem?: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens: number;
  effort?: 'low' | 'medium' | 'high';
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface StructuredResult<T> {
  data: T;
  usage: Usage;
  model: string;
  latencyMs: number;
}

export interface LlmProvider {
  readonly id: string;
  generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>>;
  /** Cheapest possible call proving the credential and model work. */
  ping(model: string): Promise<void>;
}
