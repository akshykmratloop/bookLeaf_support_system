/**
 * BookLeaf support widget. A host product adds one tag to its pages:
 *
 *   <script src="https://support.example.com/embed.js" data-token-url="/support-token" defer></script>
 *
 * data-token-url  host endpoint (same origin as the page, POST, cookies sent) that returns
 *                 { "token": "<hand-over token>" } for the signed-in user. Required.
 * data-label      launcher text. Default "Help".
 * data-title      panel title. Default "BookLeaf Help".
 *
 * It draws a launcher button. Opening it asks the host for a fresh token and shows the support
 * app in a panel; Expand makes it full screen over the page. The user never leaves the host
 * page. Remove the tag and the widget is gone: nothing else to undo.
 *
 * window.BookLeafSupport: open(), close(), expand(), collapse().
 */
(() => {
  if (window.BookLeafSupport) return; // the tag was added twice
  const script = document.currentScript;
  const supportUrl = new URL(script.src).origin;
  const tokenUrl = script.dataset.tokenUrl;
  if (!tokenUrl) throw new Error('BookLeaf support: add data-token-url to the embed.js tag.');
  const label = script.dataset.label || 'Help';
  const title = script.dataset.title || 'BookLeaf Help';
  const Z = 2147483000;
  const BRAND = '#0e8a55';
  const MSG = 'bookleaf-support:';
  /** A frame path the app may ask to reopen after signing in again. */
  const FRAME_PATH = /^\/embed(\/[\w\-/]*)?$/;
  const REAUTH_LIMIT = 3; // per minute, so a broken session can never loop

  const ICONS = {
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>',
    expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
    collapse: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
  };
  const svg = (name, size) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  const style = (el, css) => Object.assign(el.style, css);

  const state = { panel: null, frame: null, backdrop: null, expanded: false, reauths: [] };

  async function freshToken() {
    const res = await fetch(tokenUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) throw new Error('Please sign in to get help.');
    const { token } = await res.json();
    if (typeof token !== 'string') throw new Error('Help is not available right now.');
    return token;
  }

  function showNote(err) {
    const p = state.panel;
    if (!p) return;
    p.querySelector('[data-note]')?.remove();
    const note = document.createElement('p');
    note.dataset.note = '';
    note.setAttribute('role', 'alert');
    note.textContent = err instanceof Error ? err.message : 'Help is not available right now.';
    style(note, {
      margin: '0',
      padding: '24px',
      font: '14px/1.5 system-ui, sans-serif',
      color: '#3b4160',
    });
    p.append(note);
  }

  function iconButton(icon, text, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = svg(icon, 18);
    b.title = text;
    b.setAttribute('aria-label', text);
    style(b, {
      display: 'grid',
      placeItems: 'center',
      width: '34px',
      height: '34px',
      border: '0',
      borderRadius: '10px',
      background: 'rgba(255,255,255,.14)',
      color: '#fff',
      cursor: 'pointer',
    });
    b.addEventListener('click', onClick);
    return b;
  }

  function header() {
    const bar = document.createElement('div');
    style(bar, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 12px 10px 16px',
      background: `linear-gradient(135deg, ${BRAND}, #13a86a)`,
      color: '#fff',
      font: '700 15px system-ui, sans-serif',
    });
    const name = document.createElement('span');
    name.textContent = title;
    style(name, { flex: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
    const toggle = iconButton('expand', 'Expand to full screen', () =>
      state.expanded ? collapse() : expand(),
    );
    toggle.dataset.toggle = '';
    bar.append(name, toggle, iconButton('close', 'Close help', close));
    return bar;
  }

  function frameFor(path, token) {
    const f = document.createElement('iframe');
    f.title = title;
    f.allow = 'microphone';
    f.src = `${supportUrl}${path}#t=${encodeURIComponent(token)}`;
    style(f, { border: '0', width: '100%', flex: '1', background: '#f5f6fb' });
    return f;
  }

  const PANEL = {
    position: 'fixed',
    zIndex: String(Z),
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    overflow: 'hidden',
    boxShadow: '0 24px 64px -16px rgba(23,26,51,.35), 0 2px 6px rgba(23,26,51,.08)',
    transition: 'all .22s cubic-bezier(.2,.8,.2,1)',
  };
  const DOCKED = {
    top: 'auto',
    left: 'auto',
    right: '16px',
    bottom: '88px',
    width: 'min(420px, calc(100vw - 32px))',
    height: 'min(700px, calc(100vh - 120px))',
    borderRadius: '20px',
  };
  const FULL = {
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    width: '100vw',
    height: '100vh',
    borderRadius: '0',
  };
  const wide = () => window.innerWidth >= 900;
  const fullBox = () =>
    wide()
      ? {
          top: '24px',
          left: '24px',
          right: '24px',
          bottom: '24px',
          width: 'auto',
          height: 'auto',
          borderRadius: '20px',
        }
      : FULL;

  function buildPanel() {
    const p = document.createElement('div');
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', title);
    style(p, { ...PANEL, ...DOCKED, opacity: '0', transform: 'translateY(12px) scale(.98)' });
    p.append(header());
    requestAnimationFrame(() => style(p, { opacity: '1', transform: 'none' }));
    return p;
  }

  async function load(path) {
    const p = state.panel;
    try {
      const token = await freshToken();
      if (state.panel !== p) return; // closed while waiting
      state.frame?.remove();
      state.frame = frameFor(path, token);
      p.append(state.frame);
    } catch (err) {
      showNote(err);
    }
  }

  async function open() {
    if (state.panel) return;
    state.panel = buildPanel();
    document.body.append(state.panel);
    launcher.setAttribute('aria-expanded', 'true');
    launcher.innerHTML = `${svg('close', 20)}<span>Close</span>`;
    await load('/embed');
  }

  function close() {
    collapse();
    state.panel?.remove();
    state.panel = null;
    state.frame = null;
    launcher.setAttribute('aria-expanded', 'false');
    launcher.innerHTML = `${svg('chat', 20)}<span>${label}</span>`;
    launcher.focus();
  }

  /** Keeps keyboard focus inside the full-screen panel (it is modal while expanded). */
  function trapFocus(e) {
    if (state.expanded && state.panel && !state.panel.contains(e.target)) {
      state.panel.querySelector('button')?.focus();
    }
  }

  function setToggle(expanded) {
    const t = state.panel?.querySelector('[data-toggle]');
    if (!t) return;
    const text = expanded ? 'Exit full screen' : 'Expand to full screen';
    t.innerHTML = svg(expanded ? 'collapse' : 'expand', 18);
    t.title = text;
    t.setAttribute('aria-label', text);
  }

  function expand() {
    if (!state.panel) void open(); // sets the panel at once; the frame loads meanwhile
    if (!state.panel || state.expanded) return;
    state.expanded = true;
    state.backdrop = document.createElement('div');
    style(state.backdrop, {
      position: 'fixed',
      inset: '0',
      zIndex: String(Z - 1),
      background: 'rgba(15,18,40,.45)',
    });
    state.backdrop.addEventListener('click', collapse);
    document.body.append(state.backdrop);
    style(state.panel, fullBox());
    state.panel.setAttribute('aria-modal', 'true');
    launcher.style.display = 'none';
    setToggle(true);
  }

  function collapse() {
    if (!state.expanded) return;
    state.expanded = false;
    state.backdrop?.remove();
    state.backdrop = null;
    if (state.panel) {
      style(state.panel, DOCKED);
      state.panel.removeAttribute('aria-modal');
    }
    launcher.style.display = 'inline-flex';
    setToggle(false);
  }

  /** Esc steps back: full screen → docked panel → closed. */
  function escape() {
    if (state.expanded) collapse();
    else if (state.panel) close();
  }

  /** The app's session ran out: sign in again with a fresh token, on the same screen. */
  function reauth(path) {
    const now = Date.now();
    state.reauths = state.reauths.filter((t) => now - t < 60_000);
    if (state.reauths.length >= REAUTH_LIMIT)
      return showNote(new Error('Please close help and open it again.'));
    state.reauths.push(now);
    void load(typeof path === 'string' && FRAME_PATH.test(path) ? path : '/embed');
  }

  /** Messages from our own frame only: checked by origin and by the sending window. */
  window.addEventListener('message', (e) => {
    if (e.origin !== supportUrl || !state.frame || e.source !== state.frame.contentWindow) return;
    const data = e.data;
    if (!data || typeof data.type !== 'string' || !data.type.startsWith(MSG)) return;
    const type = data.type.slice(MSG.length);
    if (type === 'reauth') reauth(data.path);
    else if (type === 'escape') escape();
    else if (type === 'expand') expand();
    else if (type === 'close') close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.panel) escape();
  });
  document.addEventListener('focusin', trapFocus);
  window.addEventListener(
    'resize',
    () => state.expanded && state.panel && style(state.panel, fullBox()),
  );

  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.setAttribute('aria-expanded', 'false');
  launcher.innerHTML = `${svg('chat', 20)}<span>${label}</span>`;
  style(launcher, {
    position: 'fixed',
    right: '16px',
    bottom: '16px',
    zIndex: String(Z),
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    height: '56px',
    padding: '0 22px 0 18px',
    border: '0',
    borderRadius: '999px',
    background: `linear-gradient(135deg, ${BRAND}, #13a86a)`,
    color: '#fff',
    font: '700 15px system-ui, sans-serif',
    cursor: 'pointer',
    boxShadow: '0 12px 28px -8px rgba(14,138,85,.55), 0 2px 6px rgba(23,26,51,.12)',
    transition: 'transform .15s ease, box-shadow .15s ease',
  });
  launcher.addEventListener('mouseenter', () => (launcher.style.transform = 'translateY(-2px)'));
  launcher.addEventListener('mouseleave', () => (launcher.style.transform = 'none'));
  launcher.addEventListener('click', () => (state.panel ? close() : void open()));
  document.body.append(launcher);

  window.BookLeafSupport = { open, close, expand, collapse };
})();
