import type { PlatformProvider } from '@bookleaf/shared';
import { describe, expect, it } from 'vitest';
import { modelOptions, NO_KEY_REASON, providerOptions } from './platformAiOptions';

const provider = (id: string, keySource: PlatformProvider['keySource']): PlatformProvider => ({
  capability: 'AI',
  id,
  label: id.toUpperCase(),
  keySource,
  last4: null,
  models: [{ id: `${id}-fast`, label: 'Fast', tier: 'cheap' }],
});

describe('providerOptions (/platform AI provider dropdown)', () => {
  it('marks a provider with no key as disabled, with the reason', () => {
    const options = providerOptions(
      [provider('anthropic', 'ENV'), provider('openai', 'NONE'), provider('grok', 'SAVED')],
      'anthropic',
    );
    expect(options).toEqual([
      { value: 'anthropic', label: 'ANTHROPIC' },
      { value: 'openai', label: 'OPENAI', disabled: true, disabledReason: NO_KEY_REASON },
      { value: 'grok', label: 'GROK' },
    ]);
  });

  it('keeps the current provider pickable even when its key is gone', () => {
    const [only] = providerOptions([provider('openai', 'NONE')], 'openai');
    expect(only).toEqual({ value: 'openai', label: 'OPENAI' });
  });
});

describe('modelOptions', () => {
  it('shows the tier as the hint', () => {
    expect(modelOptions(provider('openai', 'ENV').models)).toEqual([
      { value: 'openai-fast', label: 'Fast', hint: 'cheap' },
    ]);
  });
});
