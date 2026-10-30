import { API_KEY_SCOPES, type ApiKey, type ApiKeyScope } from '@bookleaf/shared';
import { day, relative } from './format';

/** Active keys are managed; revoked ones are kept apart, for reference only (U-8). */
export function groupKeys(keys: ApiKey[]): { active: ApiKey[]; revoked: ApiKey[] } {
  return {
    active: keys.filter((k) => !k.revokedAt),
    revoked: keys.filter((k) => k.revokedAt),
  };
}

/** Turns one permission on or off, keeping the catalogue order so presets compare cleanly. */
export function toggleScope(
  scopes: readonly ApiKeyScope[],
  scope: ApiKeyScope,
  on: boolean,
): ApiKeyScope[] {
  return API_KEY_SCOPES.filter((s) => (s === scope ? on : scopes.includes(s)));
}

/** "1 Oct 2026" and "Last used 5 min ago" / "Never used" / "Revoked 2 d ago". */
export function keyDates(k: ApiKey, now = Date.now()): { created: string; used: string } {
  const used = k.revokedAt
    ? `Revoked ${relative(k.revokedAt, now)}`
    : k.lastUsedAt
      ? `Last used ${relative(k.lastUsedAt, now)}`
      : 'Never used';
  return { created: day(k.createdAt), used };
}

export const KEY_NAME_MAX = 60;

/** Inline errors for the create form; the server checks the same rules (422). */
export function newKeyErrors(
  name: string,
  scopes: readonly ApiKeyScope[],
): { name?: string; scopes?: string } {
  const trimmed = name.trim();
  return {
    ...(trimmed.length === 0 ? { name: 'Give the key a name, e.g. Production server' } : {}),
    ...(trimmed.length > KEY_NAME_MAX ? { name: `Use at most ${KEY_NAME_MAX} characters` } : {}),
    ...(scopes.length === 0 ? { scopes: 'Pick at least one permission' } : {}),
  };
}
