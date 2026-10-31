import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { LoginPage } from './LoginPage';
import { PlatformLoginPage } from './platform/PlatformLoginPage';

const render = (page: ReactNode) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>,
  );

describe('demo sign-in buttons', () => {
  it('the staff login keeps its form and offers only the demo admin', () => {
    const html = render(<LoginPage />);
    expect(html).toContain('id="email"');
    expect(html).toContain('id="password"');
    expect(html.match(/Sign in as /g)).toHaveLength(1);
    expect(html).toContain('Sign in as BookLeaf admin (demo)');
  });

  it('the platform (super admin) login has no demo button', () => {
    const html = render(<PlatformLoginPage />);
    expect(html).toContain('Sign in to the console');
    expect(html).not.toMatch(/demo/i);
    expect(html).not.toContain('Sign in as');
  });
});
