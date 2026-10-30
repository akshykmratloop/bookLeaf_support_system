import { describe, expect, it } from 'vitest';
import { SECRET_INPUT_ATTRS } from './secretInput';

describe('SECRET_INPUT_ATTRS', () => {
  it('asks the browser for a new password so it never fills a saved login', () => {
    // Chrome ignores autocomplete="off" on password inputs and fills the saved sign-in.
    expect(SECRET_INPUT_ATTRS.autoComplete).toBe('new-password');
  });

  it('tells common password managers to leave the field alone', () => {
    expect(SECRET_INPUT_ATTRS).toMatchObject({
      'data-1p-ignore': 'true',
      'data-lpignore': 'true',
      'data-bwignore': 'true',
      'data-form-type': 'other',
    });
  });

  it('turns off spellcheck and autocapitalise so keys are sent as typed', () => {
    expect(SECRET_INPUT_ATTRS.spellCheck).toBe(false);
    expect(SECRET_INPUT_ATTRS.autoCapitalize).toBe('off');
    expect(SECRET_INPUT_ATTRS.autoCorrect).toBe('off');
  });
});
