// The demo product's page. Opening support: ask BookLeaf's own server for a fresh hand-over
// token, then open the support module with it in the URL fragment (never sent to a server).
const supportUrl = document.querySelector('meta[name="support-url"]').content;
const $ = (id) => document.getElementById(id);

async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? 'Request failed');
  return res.json();
}

// The support widget: one script tag, added once the author is signed in.
function addSupportWidget() {
  if (document.getElementById('support-widget')) return;
  const tag = document.createElement('script');
  tag.id = 'support-widget';
  tag.src = `${supportUrl}/embed.js`;
  tag.dataset.tokenUrl = '/support-token';
  document.body.append(tag);
}

async function show() {
  const res = await fetch('/me');
  const signedIn = res.ok;
  $('login').hidden = signedIn;
  $('home').hidden = !signedIn;
  if (!signedIn) return;
  $('name').textContent = (await res.json()).name;
  addSupportWidget();
}

$('login').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await post('/login', { email: $('email').value, password: $('password').value });
    await show();
  } catch (err) {
    $('error').textContent = err.message;
  }
});

$('support').addEventListener('click', async () => {
  const tab = window.open('', '_blank');
  const { token } = await post('/support-token');
  tab.location = `${supportUrl}/auth/host#t=${encodeURIComponent(token)}`;
});

$('logout').addEventListener('click', async () => {
  await post('/logout');
  location.reload(); // also removes the widget
});

void show();
