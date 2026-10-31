import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEMO_AUTHORS } from '../lib/demoAccounts';
import { LoginPage } from './LoginPage';

const render = () =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <LoginPage />
    </QueryClientProvider>,
  );

describe('LoginPage', () => {
  it('keeps the manual form and adds one sign-in button per demo author', () => {
    const html = render();
    expect(html).toContain('id="email"');
    expect(html).toContain('id="password"');
    expect(html).toContain('Try it as an author — one click');
    for (const author of DEMO_AUTHORS) expect(html).toContain(`Sign in as ${author.name}`);
  });
});
