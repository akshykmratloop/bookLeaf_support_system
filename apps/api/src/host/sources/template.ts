import { templatePlaceholders } from '@bookleaf/shared';

/** A source URL uses `{email}` but support knows no email for this customer. */
export class MissingEmailError extends Error {
  constructor() {
    super('no email is known for this customer');
    this.name = 'MissingEmailError';
  }
}

export const needsEmail = (template: string) => templatePlaceholders(template).includes('email');

/** Fills `{id}` and `{email}` (URL-encoded) into a source's URL template. */
export function expandTemplate(
  template: string,
  values: { id: string; email: string | null },
): URL {
  const { email } = values;
  if (email === null && needsEmail(template)) throw new MissingEmailError();
  const filled = template
    .replaceAll('{id}', encodeURIComponent(values.id))
    .replaceAll('{email}', encodeURIComponent(email ?? ''));
  return new URL(filled);
}
