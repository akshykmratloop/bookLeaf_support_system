import type { PlatformProvider } from '@bookleaf/shared';
import type { DropdownOption } from './useDropdown';

export const NO_KEY_REASON = 'No API key: save one below or set it on the server';

/**
 * The AI provider choices on /platform (U-7 + U-6). A provider with no saved or env key cannot be
 * picked; the one already chosen stays selectable so the current setting still reads correctly.
 */
export function providerOptions(providers: PlatformProvider[], current: string): DropdownOption[] {
  return providers.map((p) =>
    p.keySource === 'NONE' && p.id !== current
      ? { value: p.id, label: p.label, disabled: true, disabledReason: NO_KEY_REASON }
      : { value: p.id, label: p.label },
  );
}

/** A provider's models, with the tier as the quieter second line. */
export function modelOptions(models: PlatformProvider['models']): DropdownOption[] {
  return models.map((m) => ({ value: m.id, label: m.label, hint: m.tier }));
}
