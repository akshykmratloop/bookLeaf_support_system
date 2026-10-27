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

async function show() {
  const res = await fetch('/me');
  const signedIn = res.ok;
  $('login').hidden = signedIn;
  $('home').hidden = !signedIn;
  if (signedIn) $('name').textContent = (await res.json()).name;
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
  await show();
});

void show();
