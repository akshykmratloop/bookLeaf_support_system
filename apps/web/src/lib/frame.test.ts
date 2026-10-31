import { describe, expect, it, vi } from 'vitest';
import { createHostChannel } from './frame';

const HOST = 'https://app.bookleaf.in';

interface Sent {
  data: { type: string } & Record<string, unknown>;
  target: string;
}

function fakeWindow() {
  const sent: Sent[] = [];
  const parent = {
    postMessage: (data: Sent['data'], target: string) => void sent.push({ data, target }),
  };
  let listener: ((e: { source: unknown; origin: string; data: unknown }) => void) | null = null;
  const win = {
    parent,
    addEventListener: (_: string, fn: typeof listener) => {
      listener = fn;
    },
  };
  const receive = (origin: string, data: unknown, source: unknown = parent) =>
    listener?.({ source, origin, data });
  return { win: win as unknown as Window, sent, receive, parent };
}

const hello = { type: 'bookleaf-support:hello', origin: HOST, theme: 'dark' };

describe('frame ↔ host page channel', () => {
  it('asks the host page to introduce itself as soon as it starts', () => {
    const { win, sent } = fakeWindow();
    createHostChannel(win);
    expect(sent).toEqual([{ data: { type: 'bookleaf-support:ready' }, target: '*' }]);
  });

  it('sends content-free messages to any origin', () => {
    const { win, sent } = fakeWindow();
    const channel = createHostChannel(win);
    channel.tell('escape');
    channel.tell('expand');
    expect(sent.slice(1).map((s) => s.target)).toEqual(['*', '*']);
  });

  it('holds content until the host names its origin, then sends it only there', () => {
    const { win, sent, receive } = fakeWindow();
    const channel = createHostChannel(win);
    channel.tell('brand', { name: 'BookLeaf', logoUrl: 'https://cdn.example/logo.png' });
    channel.tell('reauth', { path: '/embed/bookleaf/tickets' });
    expect(sent).toHaveLength(1); // only `ready`
    receive(HOST, hello);
    expect(channel.origin()).toBe(HOST);
    expect(sent.slice(1)).toEqual([
      {
        data: {
          type: 'bookleaf-support:brand',
          name: 'BookLeaf',
          logoUrl: 'https://cdn.example/logo.png',
        },
        target: HOST,
      },
      { data: { type: 'bookleaf-support:reauth', path: '/embed/bookleaf/tickets' }, target: HOST },
    ]);
    channel.tell('reauth', { path: '/embed/bookleaf' });
    expect(sent.at(-1)?.target).toBe(HOST);
  });

  it('does not learn an origin the message does not really come from', () => {
    const { win, receive } = fakeWindow();
    const channel = createHostChannel(win);
    receive('https://evil.example', hello); // claims HOST, sent from elsewhere
    receive(HOST, { ...hello, origin: undefined }); // names no origin
    receive(HOST, hello, {}); // not the parent window
    expect(channel.origin()).toBeNull();
  });

  it('runs a sign-out only when the learned host page asks for it', () => {
    const { win, receive } = fakeWindow();
    const channel = createHostChannel(win);
    const signOut = vi.fn();
    const stop = channel.on('signout', signOut);
    receive(HOST, { type: 'bookleaf-support:signout', origin: HOST });
    expect(signOut).toHaveBeenCalledOnce();
    receive('https://evil.example', {
      type: 'bookleaf-support:signout',
      origin: 'https://evil.example',
    });
    expect(signOut).toHaveBeenCalledOnce();
    stop();
    receive(HOST, { type: 'bookleaf-support:signout', origin: HOST });
    expect(signOut).toHaveBeenCalledOnce();
  });
});
