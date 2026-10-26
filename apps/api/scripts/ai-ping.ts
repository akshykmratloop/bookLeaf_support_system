/** One bounded call per configured model to prove the credential works. Prints no secrets. */
import { z } from 'zod';
import { anthropicProvider } from '../src/ai/providers/anthropic/provider.js';

const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.log('ANTHROPIC_API_KEY not set — skipping live check');
  process.exit(0);
}
const provider = anthropicProvider({ apiKey: key });
for (const model of process.argv.slice(2)) {
  try {
    const r = await provider.generateStructured({
      task: 'TEST',
      model,
      stableSystem: 'You classify support messages. Return JSON only.',
      user: 'Message: "I have not received royalty for 6 months." Is this about payments?',
      schema: z.object({ aboutPayments: z.boolean() }),
      maxTokens: 512,
    });
    console.log(model, 'OK', JSON.stringify(r.data), `in=${r.usage.inputTokens} out=${r.usage.outputTokens} ${r.latencyMs}ms`);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    console.log(model, 'FAILED', err.code, err.message);
  }
}
