/** Content Security Policy for the support app: only its own scripts, no framing. */
export const CSP = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
  imgSrc: ["'self'", 'data:'],
  connectSrc: ["'self'"],
  frameAncestors: ["'none'"],
  objectSrc: ["'none'"],
};

/**
 * The policy for this deployment. When voice connects straight to the API's own WebSocket
 * address (PUBLIC_API_WS_ORIGIN: the page is served through a proxy that cannot carry
 * WebSockets, such as Vercel), the page may connect there too.
 */
export const cspDirectives = (publicWsOrigin?: string) =>
  publicWsOrigin ? { ...CSP, connectSrc: [...CSP.connectSrc, publicWsOrigin] } : CSP;
