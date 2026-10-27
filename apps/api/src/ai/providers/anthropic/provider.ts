import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { AiInvalidOutputError } from '../errors.js';
import type { LlmProvider, StructuredRequest, StructuredResult } from '../types.js';
import { mapAnthropicError } from './map-error.js';

export interface AnthropicProviderOptions {
  apiKey: string;
  timeoutMs?: number;
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

  async function generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const started = performance.now(); // elapsed time only, not business time
    const system: Anthropic.TextBlockParam[] = [
      { type: 'text', text: req.stableSystem, cache_control: { type: 'ephemeral' } },
    ];
    if (req.dynamicSystem) system.push({ type: 'text', text: req.dynamicSystem });
    try {
      const response = await client.messages.parse({
        model: req.model,
        max_tokens: req.maxTokens,
        system,
        messages: [{ role: 'user', content: req.user }],
        output_config: {
          effort: req.effort ?? 'low',
          format: zodOutputFormat(req.schema as z.ZodType<T>),
        },
      });
      if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
        throw new AiInvalidOutputError(`Model stopped early (${response.stop_reason})`);
      }
      const parsed = response.parsed_output as T | null;
      if (parsed === null || parsed === undefined) {
        throw new AiInvalidOutputError('Model output did not match the schema');
      }
      const u = response.usage;
      return {
        data: parsed,
        model: response.model,
        latencyMs: Math.round(performance.now() - started),
        usage: {
          inputTokens: u.input_tokens,
          outputTokens: u.output_tokens,
          cacheReadTokens: u.cache_read_input_tokens ?? 0,
          cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
        },
      };
    } catch (error) {
      throw mapAnthropicError(error);
    }
  }

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
