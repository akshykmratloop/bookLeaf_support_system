import type { PlatformProvider } from '@bookleaf/shared';
import { describe, expect, it } from 'vitest';
import {
  modelOptions,
  NO_KEY_REASON,
  providerOptions,
  voiceModelOptions,
} from './platformAiOptions';

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

describe('voiceModelOptions (/platform voice model dropdown)', () => {
  const models = [
    { id: 'gpt-realtime-2.1', label: 'GPT Realtime 2.1', tier: 'strong' },
    { id: 'gpt-realtime-mini', label: 'GPT Realtime mini', tier: 'fast' },
  ];

  it('starts with the server default (empty value), then the provider models', () => {
    expect(voiceModelOptions(models, 'gpt-realtime-2.1', '')).toEqual([
      { value: '', label: 'Server default', hint: 'gpt-realtime-2.1' },
      { value: 'gpt-realtime-2.1', label: 'GPT Realtime 2.1', hint: 'strong' },
      { value: 'gpt-realtime-mini', label: 'GPT Realtime mini', hint: 'fast' },
    ]);
  });

  it('keeps a saved model that is no longer listed so the current setting still reads', () => {
    const options = voiceModelOptions(models, 'gpt-realtime-2.1', 'gpt-realtime-old');
    expect(options.at(-1)).toEqual({
      value: 'gpt-realtime-old',
      label: 'gpt-realtime-old',
      hint: 'saved earlier',
    });
  });

  it('offers only the server default when the provider lists no models', () => {
    expect(voiceModelOptions([], 'gpt-realtime-2.1', '')).toHaveLength(1);
  });
});
