import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { AiInvalidOutputError } from '../errors.js';
import type { LlmProvider, StructuredRequest, StructuredResult, Usage } from '../types.js';
import { mapAnthropicError } from './map-error.js';

export interface AnthropicProviderOptions {
  apiKey: string;
  timeoutMs?: number;
}

/** The stable part is cached across calls; the per-ticket part is not. */
function systemBlocks(req: StructuredRequest<unknown>): Anthropic.TextBlockParam[] {
  const system: Anthropic.TextBlockParam[] = [
    { type: 'text', text: req.stableSystem, cache_control: { type: 'ephemeral' } },
  ];
  if (req.dynamicSystem) system.push({ type: 'text', text: req.dynamicSystem });
  return system;
}

function requireParsed<T>(stopReason: string | null, parsed: T | null | undefined): T {
  if (stopReason === 'refusal' || stopReason === 'max_tokens') {
    throw new AiInvalidOutputError(`Model stopped early (${stopReason})`);
  }
  if (parsed === null || parsed === undefined) {
    throw new AiInvalidOutputError('Model output did not match the schema');
  }
  return parsed;
}

const usageOf = (u: Anthropic.Usage): Usage => ({
  inputTokens: u.input_tokens,
  outputTokens: u.output_tokens,
  cacheReadTokens: u.cache_read_input_tokens ?? 0,
  cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
});

async function generateWith<T>(
  client: Anthropic,
  req: StructuredRequest<T>,
): Promise<StructuredResult<T>> {
  const started = performance.now(); // elapsed time only, not business time
  try {
    const response = await client.messages.parse({
      model: req.model,
      max_tokens: req.maxTokens,
      system: systemBlocks(req),
      messages: [{ role: 'user', content: req.user }],
      output_config: {
        effort: req.effort ?? 'low',
        format: zodOutputFormat(req.schema as z.ZodType<T>),
      },
    });
    const data = requireParsed(response.stop_reason, response.parsed_output as T | null);
    const latencyMs = Math.round(performance.now() - started);
    return { data, model: response.model, latencyMs, usage: usageOf(response.usage) };
  } catch (error) {
    throw mapAnthropicError(error);
  }
}

/**
 * Claude via the official SDK. Structured output uses `output_config.format`, so the model must
 * return JSON matching the Zod schema. SDK retries are off: the job queue owns retries.
 */
export function anthropicProvider(opts: AnthropicProviderOptions): LlmProvider {
  const client = new Anthropic({
    apiKey: opts.apiKey,
    maxRetries: 0,
    timeout: opts.timeoutMs ?? 20_000,
  });
  const generateStructured = <T>(req: StructuredRequest<T>) => generateWith(client, req);
  return {
    id: 'anthropic',
    generateStructured,
    async ping(model) {
      await generateStructured({
        task: 'TEST',
        model,
        stableSystem: 'Reply with {"ok": true}.',
        user: 'ping',
        schema: z.object({ ok: z.boolean() }),
        maxTokens: 64,
      });
    },
  };
}
