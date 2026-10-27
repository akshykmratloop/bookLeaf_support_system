/**
 * BookLeaf support widget. A host product adds one tag to its pages:
 *
 *   <script src="https://support.example.com/embed.js" data-token-url="/support-token" defer></script>
 *
 * data-token-url  host endpoint (same origin as the page, POST, cookies sent) that returns
 *                 { "token": "<hand-over token>" } for the signed-in user. Required.
 * data-label      launcher text. Default "Help".
 * data-title      panel title. Default "BookLeaf Help".
 * data-theme      "light", "dark" or "auto" (default). Auto follows the host page: class "dark" or
 *                 data-theme="dark" (or "light") on <html>, else the visitor's system setting. It
 *                 restyles live when the host switches. The support app inside the frame
 *                 follows too (the theme is in the frame address and sent on every switch).
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
  const themeMode = ['light', 'dark'].includes(script.dataset.theme)
    ? script.dataset.theme
    : 'auto';
  const Z = 2147483000;
  // BookLeaf Publishing coral (bookleafpub.in). The deeper shades keep white text above 4.5:1.
  const BRAND = '#d13f53';
  const FONT = "'Avenir Next', Avenir, 'Nunito Sans', system-ui, sans-serif";
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

  // Colours match the support app's tokens (apps/web/src/styles/tokens.css), light and dark.
  const THEMES = {
    light: {
      '--bl-panel': '#ffffff',
      '--bl-bg': '#f6f5f7',
      '--bl-line': '#ece7ea',
      '--bl-ink': '#2f2e2e',
      '--bl-ink-2': '#5e5e5e',
      '--bl-hover': '#fdecee',
      '--bl-shadow': '0 24px 64px -16px rgba(53,70,92,.38), 0 2px 6px rgba(47,46,46,.08)',
      '--bl-launch-shadow': '0 12px 28px -8px rgba(209,63,83,.55), 0 2px 6px rgba(47,46,46,.12)',
      colorScheme: 'light',
    },
    dark: {
      '--bl-panel': '#182030',
      '--bl-bg': '#10141c',
      '--bl-line': '#263043',
      '--bl-ink': '#f2eff0',
      '--bl-ink-2': '#b3b0b6',
      '--bl-hover': 'rgba(241,104,118,.14)',
      '--bl-shadow': '0 24px 64px -16px rgba(0,0,0,.7), 0 0 0 1px #263043',
      '--bl-launch-shadow': '0 12px 28px -8px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.08)',
      colorScheme: 'dark',
    },
  };
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const root = document.documentElement;

  /** Which theme the widget wears now: the tag's choice, else the host page's, else the system's. */
  function currentTheme() {
    if (themeMode !== 'auto') return themeMode;
    const mark = root.dataset.theme;
    if (mark === 'dark' || root.classList.contains('dark')) return 'dark';
    if (mark === 'light' || root.classList.contains('light')) return 'light';
    return darkQuery.matches ? 'dark' : 'light';
  }

  /** Sets the theme's colour variables on an element; its children read them. */
  function paint(el) {
    if (!el) return;
    const { colorScheme, ...vars } = THEMES[currentTheme()];
    for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
    el.style.colorScheme = colorScheme;
  }
  /** Repaints the frame around the support app and tells the app inside, so both match. */
  const repaint = () => {
    [launcher, state.panel].forEach(paint);
    const theme = currentTheme();
    state.frame?.contentWindow?.postMessage({ type: 'bookleaf-support:theme', theme }, supportUrl);
  };

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
      font: `14px/1.5 ${FONT}`,
      color: 'var(--bl-ink-2)',
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
      background: 'transparent',
      color: 'var(--bl-ink-2)',
      cursor: 'pointer',
    });
    b.addEventListener('mouseenter', () => (b.style.background = 'var(--bl-hover)'));
    b.addEventListener('mouseleave', () => (b.style.background = 'transparent'));
    b.addEventListener('click', onClick);
    return b;
  }

  /** BookLeaf Publishing's mark, as on bookleafpub.in: a thin white slash on a coral square. */
  function mark() {
    const m = document.createElement('span');
    m.setAttribute('aria-hidden', 'true');
    m.innerHTML =
      '<svg width="28" height="28" viewBox="0 0 32 32"><rect width="32" height="32" fill="#f16977"/><path d="M19.6 7.2 12.6 24.6" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>';
    style(m, { display: 'grid', flexShrink: '0' });
    return m;
  }

  function header() {
    const bar = document.createElement('div');
    style(bar, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 12px 10px 16px',
      background: 'var(--bl-panel)',
      borderBottom: '1px solid var(--bl-line)',
      color: 'var(--bl-ink)',
      font: `600 15px ${FONT}`,
    });
    const name = document.createElement('span');
    name.textContent = title;
    style(name, { flex: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
    const toggle = iconButton('expand', 'Expand to full screen', () =>
      state.expanded ? collapse() : expand(),
    );
    toggle.dataset.toggle = '';
    bar.append(mark(), name, toggle, iconButton('close', 'Close help', close));
    return bar;
  }

  function frameFor(path, token) {
    const f = document.createElement('iframe');
    f.title = title;
    f.allow = 'microphone';
    f.src = `${supportUrl}${path}#t=${encodeURIComponent(token)}&theme=${currentTheme()}`;
    style(f, { border: '0', width: '100%', flex: '1', background: 'var(--bl-bg)' });
    return f;
  }

  const PANEL = {
    position: 'fixed',
    zIndex: String(Z),
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bl-panel)',
    overflow: 'hidden',
    boxShadow: 'var(--bl-shadow)',
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
    paint(p);
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
    setLauncher('close', 'Close');
    await load('/embed');
  }

  function close() {
    collapse();
    state.panel?.remove();
    state.panel = null;
    state.frame = null;
    launcher.setAttribute('aria-expanded', 'false');
    setLauncher('chat', label);
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
      background: 'rgba(32,45,62,.5)',
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
  /** The launcher's icon and words; the words are set as text, never as markup. */
  function setLauncher(icon, words) {
    const span = document.createElement('span');
    span.textContent = words;
    launcher.innerHTML = svg(icon, 20);
    launcher.append(span);
  }
  launcher.type = 'button';
  launcher.setAttribute('aria-expanded', 'false');
  setLauncher('chat', label);
  style(launcher, {
    position: 'fixed',
    right: '16px',
    bottom: '16px',
    zIndex: String(Z),
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    height: '56px',
    padding: '0 24px 0 18px',
    border: '0',
    borderRadius: '30px',
    background: BRAND,
    color: '#fff',
    font: `600 15px ${FONT}`,
    letterSpacing: '.01em',
    cursor: 'pointer',
    boxShadow: 'var(--bl-launch-shadow)',
    transition: 'transform .15s ease, box-shadow .15s ease',
  });
  launcher.addEventListener('mouseenter', () => (launcher.style.transform = 'translateY(-2px)'));
  launcher.addEventListener('mouseleave', () => (launcher.style.transform = 'none'));
  launcher.addEventListener('click', () => (state.panel ? close() : void open()));
  document.body.append(launcher);
  paint(launcher);
  // Restyle live when the host flips its theme or the system setting changes. The frame is not reloaded.
  new MutationObserver(repaint).observe(root, {
    attributes: true,
    attributeFilter: ['class', 'data-theme'],
  });
  darkQuery.addEventListener('change', repaint);

  window.BookLeafSupport = { open, close, expand, collapse };
})();
