/** Staged files only: format, then lint-fix code. Run by scripts/hooks/pre-commit. */
export default {
  '*.{ts,tsx,js,mjs}': ['prettier --write', 'eslint --fix'],
  '*.{json,md,css,yml,yaml}': ['prettier --write'],
};
