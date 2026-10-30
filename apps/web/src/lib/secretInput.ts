/**
 * Props for a write-only secret box (API keys, signing secrets). Browsers ignore
 * autocomplete="off" on password inputs and fill the saved sign-in instead, which made a stored
 * key look edited. "new-password" stops that; the data-* flags do the same for 1Password,
 * LastPass and Bitwarden.
 */
export const SECRET_INPUT_ATTRS = {
  autoComplete: 'new-password',
  autoCapitalize: 'off',
  autoCorrect: 'off',
  spellCheck: false,
  'data-1p-ignore': 'true',
  'data-lpignore': 'true',
  'data-bwignore': 'true',
  'data-form-type': 'other',
} as const;
