import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PasswordField } from './PasswordField';

const render = (props: Partial<Parameters<typeof PasswordField>[0]> = {}) =>
  renderToStaticMarkup(<PasswordField id="pw" value="" onChange={() => undefined} {...props} />);

describe('PasswordField', () => {
  it('starts hidden, with a "Show password" button tied to the input', () => {
    const html = render();
    expect(html).toContain('type="password"');
    expect(html).toContain('aria-label="Show password"');
    expect(html).toContain('aria-controls="pw"');
    expect(html).toContain('autoComplete="current-password"');
  });

  it('takes the signup label, hint and new-password autocomplete', () => {
    const html = render({
      label: 'Choose a password',
      hint: 'At least 12 characters.',
      autoComplete: 'new-password',
      name: 'password',
    });
    expect(html).toContain('Choose a password');
    expect(html).toContain('At least 12 characters.');
    expect(html).toContain('aria-describedby="pw-hint"');
    expect(html).toContain('autoComplete="new-password"');
    expect(html).toContain('name="password"');
  });

  it('shows the error instead of the hint', () => {
    const html = render({ hint: 'At least 12 characters.', error: 'Too short' });
    expect(html).toContain('Too short');
    expect(html).not.toContain('At least 12 characters.');
    expect(html).toContain('aria-describedby="pw-error"');
  });
});
