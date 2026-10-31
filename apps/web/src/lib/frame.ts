/**
 * Talking to the host page that framed the support app (public/embed.js). Messages carry no
 * secrets, and embed.js accepts them only from this origin and from this frame's window.
 *
 * The frame does not know the host's origin up front, so it learns it: embed.js names its own
 * origin in every message it sends (the first one on frame load, or in answer to our `ready`),
 * and the frame keeps it when it matches the origin the browser reports for that message. Only
 * the parent window is listened to, and frame-ancestors already limits the parent to the
 * workspace's allowed origins. Messages with content (a page path, the brand and logo) go only to
 * that learned origin, held back until it is known; content-free ones (escape, expand, close)
 * may go to '*'.
 */
const PREFIX = 'bookleaf-support:';

export const isFramed = (): boolean => {
  try {
    return window.self !== window.top;
  } catch {
    return true; // a cross-origin parent throws on access: we are framed
  }
};

type ContentFree = 'escape' | 'expand' | 'close' | 'ready' | 'signedout';
type WithContent = 'reauth' | 'brand';
export type HostMessage = ContentFree | WithContent;
type Extra = Record<string, string | null>;
/** What the host page may ask of the frame. */
export type HostCommand = 'signout';

const CONTENT_FREE: ReadonlySet<HostMessage> = new Set<ContentFree>([
  'escape',
  'expand',
  'close',
  'ready',
  'signedout',
]);
const COMMANDS: ReadonlySet<string> = new Set<HostCommand>(['signout']);

export interface HostChannel {
  tell(type: HostMessage, extra?: Extra): void;
  /** Runs `handler` when the host page sends `command`; returns a function that stops it. */
  on(command: HostCommand, handler: () => void): () => void;
  /** The host page's origin, once learned. */
  origin(): string | null;
}

interface Inbound {
  type?: unknown;
  origin?: unknown;
}

/** The channel to `win.parent`. One per window; the app uses the one for its own window. */
export function createHostChannel(win: Window): HostChannel {
  let hostOrigin: string | null = null;
  const held = new Map<WithContent, Extra>();
  const handlers = new Map<HostCommand, Set<() => void>>();
  const post = (type: HostMessage, extra: Extra, target: string) =>
    win.parent.postMessage({ type: `${PREFIX}${type}`, ...extra }, target);

  const learn = (e: MessageEvent<Inbound | null>): boolean => {
    if (hostOrigin !== null) return e.origin === hostOrigin;
    if (typeof e.data?.origin !== 'string' || e.data.origin !== e.origin) return false;
    hostOrigin = e.origin;
    for (const [type, extra] of held) post(type, extra, e.origin);
    held.clear();
    return true;
  };

  win.addEventListener('message', (e: MessageEvent<Inbound | null>) => {
    if (e.source !== win.parent || typeof e.data?.type !== 'string') return;
    if (!e.data.type.startsWith(PREFIX) || !learn(e)) return;
    const command = e.data.type.slice(PREFIX.length);
    if (COMMANDS.has(command)) handlers.get(command as HostCommand)?.forEach((h) => h());
  });
  // Ask embed.js to introduce itself, in case its first message came before we listened.
  post('ready', {}, '*');

  return {
    tell(type, extra = {}) {
      if (CONTENT_FREE.has(type)) return post(type, extra, '*');
      if (hostOrigin) return post(type, extra, hostOrigin);
      held.set(type as WithContent, extra); // the latest of each kind, sent once we know where
    },
    on(command, handler) {
      const set = handlers.get(command) ?? new Set();
      handlers.set(command, set.add(handler));
      return () => void set.delete(handler);
    },
    origin: () => hostOrigin,
  };
}

let own: HostChannel | null = null;
/** This window's channel, started on first use (only when framed). */
const channel = (): HostChannel => (own ??= createHostChannel(window));

export function tellHost(type: HostMessage, extra: Extra = {}): void {
  if (!isFramed()) return;
  channel().tell(type, extra);
}

/** Listens for a command from the host page; a no-op on a full page. */
export function onHostCommand(command: HostCommand, handler: () => void): () => void {
  if (!isFramed()) return () => undefined;
  return channel().on(command, handler);
}

/** The session ran out: ask the host page for a fresh sign-in on the same screen. */
export const requestReauth = (path: string) => tellHost('reauth', { path });
