import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { toastDuration } from '../../lib/toast';
import { ToastCard } from './Toast';

const card = (tone: 'success' | 'error') =>
  renderToStaticMarkup(
    <ToastCard item={{ id: 1, tone, text: 'Saved' }} onDismiss={() => undefined} />,
  );

describe('Toast', () => {
  it('announces an error at once (role="alert") and keeps it for 8 seconds', () => {
    expect(card('error')).toContain('role="alert"');
    expect(toastDuration('error')).toBe(8000);
  });

  it('announces a confirmation politely (role="status") for 4 seconds', () => {
    expect(card('success')).toContain('role="status"');
    expect(toastDuration('success')).toBe(4000);
  });

  it('can be dismissed with a labelled button', () => {
    expect(card('error')).toMatch(/<button type="button" aria-label="Dismiss notification"/);
  });
});
