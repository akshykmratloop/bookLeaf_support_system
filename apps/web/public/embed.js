/**
 * BookLeaf support widget. A host product adds one tag to its pages:
 *
 *   <script src="https://support.example.com/embed.js" data-token-url="/support-token" defer></script>
 *
 * data-token-url  host endpoint (same origin as the page, POST, cookies sent) that returns
 *                 { "token": "<hand-over token>" } for the signed-in user. Required.
 * data-label      button text. Default "Help".
 *
 * Load it with `defer` (or at the end of <body>). It draws a floating button. Opening it asks the host for a fresh token and shows the
 * support app in an iframe. Remove the tag and the widget is gone: nothing else to undo.
 */
(() => {
  if (window.BookLeafSupport) return; // the tag was added twice
  const script = document.currentScript;
  const supportUrl = new URL(script.src).origin;
  const tokenUrl = script.dataset.tokenUrl;
  if (!tokenUrl) throw new Error('BookLeaf support: add data-token-url to the embed.js tag.');
  const label = script.dataset.label || 'Help';
  const z = '2147483000';
  let panel = null;

  const style = (el, css) => Object.assign(el.style, css);

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

  function showNote(p, err) {
    const note = document.createElement('p');
    note.setAttribute('role', 'alert');
    note.textContent = err instanceof Error ? err.message : 'Help is not available right now.';
    style(note, { padding: '16px', font: '14px system-ui, sans-serif' });
    p.append(note);
  }

  function headerButton(text, title, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.title = title;
    b.setAttribute('aria-label', title);
    style(b, {
      border: '0',
      background: 'none',
      color: 'inherit',
      cursor: 'pointer',
      fontSize: '16px',
    });
    b.addEventListener('click', onClick);
    return b;
  }

  function frame(token) {
    const f = document.createElement('iframe');
    f.title = 'BookLeaf support';
    f.allow = 'microphone';
    f.src = `${supportUrl}/embed#t=${encodeURIComponent(token)}`;
    style(f, { border: '0', width: '100%', flex: '1' });
    return f;
  }

  async function openInNewTab() {
    const p = panel;
    const tab = window.open('', '_blank');
    if (!tab) return; // pop-up blocked: the panel stays open
    tab.opener = null;
    try {
      tab.location = `${supportUrl}/auth/host#t=${encodeURIComponent(await freshToken())}`;
    } catch (err) {
      tab.close();
      if (p) showNote(p, err);
    }
  }

  function buildPanel() {
    const p = document.createElement('div');
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', 'BookLeaf support');
    style(p, {
      position: 'fixed',
      right: '16px',
      bottom: '80px',
      zIndex: z,
      display: 'flex',
      flexDirection: 'column',
      width: 'min(420px, calc(100vw - 32px))',
      height: 'min(680px, calc(100vh - 112px))',
      background: '#fff',
      color: '#1d1d1b',
      borderRadius: '14px',
      overflow: 'hidden',
      boxShadow: '0 12px 40px rgba(0,0,0,.25)',
    });
    const bar = document.createElement('div');
    style(bar, { display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '6px 12px' });
    bar.append(
      headerButton('↗', 'Open support in a new tab', openInNewTab),
      headerButton('×', 'Close help', close),
    );
    p.append(bar);
    return p;
  }

  async function open() {
    if (panel) return;
    const p = buildPanel();
    panel = p;
    document.body.append(p);
    try {
      const token = await freshToken();
      if (panel === p) p.append(frame(token)); // not closed while waiting
    } catch (err) {
      showNote(p, err);
    }
  }

  function close() {
    panel?.remove();
    panel = null;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  style(button, {
    position: 'fixed',
    right: '16px',
    bottom: '16px',
    zIndex: z,
    padding: '12px 20px',
    border: '0',
    borderRadius: '999px',
    background: '#2f5d50',
    color: '#fff',
    font: '600 14px system-ui, sans-serif',
    cursor: 'pointer',
    boxShadow: '0 6px 20px rgba(0,0,0,.2)',
  });
  button.addEventListener('click', () => (panel ? close() : void open()));
  document.body.append(button);

  window.BookLeafSupport = { open, close };
})();
