import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

// Use the production module. Vite's env is not replaced: import.meta.env is
// undefined under Node, so the built-in base falls back to '' and every test
// injects its own apiBase — including '' to exercise the disabled path.
const { initAccountSecurity, maskUid, formatTimestamp } = await import(
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(readFileSync(new URL('../src/security-report.ts', import.meta.url), 'utf8'))).toString('base64')}`
);

class StubElement extends EventTarget {
  constructor(tag = 'div') {
    super();
    this.tagName = tag;
    this.children = [];
    this.textContent = '';
    this.className = '';
    this.hidden = false;
    this.attributes = {};
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  focus() { this.focused = true; }
}

function securityDoc() {
  const spec = {
    'account-security': { hidden: true },
    'security-toggle': { hidden: true },
    'security-status': {},
    'security-sessions': {},
    'security-empty': { hidden: true },
    'security-admin': { hidden: true },
    'security-admin-list': {},
    'security-admin-status': {},
    'security-retention': {}
  };
  const elements = new Map([...Object.entries(spec)].map(([id, initial]) => {
    const element = new StubElement(id === 'security-sessions' || id === 'security-admin-list' ? 'ul' : id === 'security-toggle' ? 'button' : 'div');
    Object.assign(element, initial);
    return [id, element];
  }));
  return {
    doc: { getElementById: id => elements.get(id) ?? null, createElement: tag => new StubElement(tag) },
    elements
  };
}

const tick = () => new Promise(setImmediate);
const flush = async (stages = 3) => { for (let index = 0; index < stages; index++) await tick(); };
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status });

function fakeFetch(routes) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const call = { url, options, method: options.method || 'GET', authorization: options.headers?.authorization, signal: options.signal };
    calls.push(call);
    const handler = routes[url.replace(/^https?:\/\/[^/]+/, '')] ?? routes.default;
    if (!handler) throw new Error(`unexpected fetch: ${url}`);
    return typeof handler === 'function' ? handler(call) : handler;
  };
  return { calls, fetchImpl };
}

const base = 'https://staging.example';
const controller = async (docAndElements, { apiBase = base, fetchImpl, getToken = async () => 'TOKEN-1' } = {}) => {
  const control = initAccountSecurity(docAndElements.doc, { apiBase, fetchImpl, getToken });
  await flush();
  return control;
};

test('maskUid never returns the full Firebase UID and formatTimestamp renders local time', () => {
  const uid = 'firebase-uid-abcdef123456';
  const masked = maskUid(uid);
  assert.equal(masked.includes(uid), false);
  assert.equal(masked, 'fire…3456');
  assert.equal(maskUid('short'), 'sh…');
  assert.equal(maskUid(''), 'unknown');
  assert.ok(formatTimestamp(1763712000).length > 0);
  assert.equal(formatTimestamp(0), '');
  assert.equal(formatTimestamp(Number.NaN), '');
});

test('a verified session is recorded once with the signed token and repeated auth-state changes cause no new requests', async () => {
  const { doc, elements } = securityDoc();
  const { calls, fetchImpl } = fakeFetch({
    '/api/session': jsonResponse({ recorded: true }),
    '/api/security-report': jsonResponse({ sessions: [{ auth_time: 1763712000, first_seen_at: 1763712005 }], retention_days: 30 }),
    '/api/admin/security-report': jsonResponse({ error: 'Administrator access required.' }, 403)
  });
  const control = await controller({ doc, elements }, { fetchImpl });
  assert.equal(control.disabled, false);
  assert.equal(elements.get('security-toggle').hidden, false, 'the entry point is available when the integration is configured');
  control.handleUser({ uid: 'user-a' });
  await flush();
  const sessionPosts = calls.filter(call => call.method === 'POST' && call.url === `${base}/api/session`);
  assert.equal(sessionPosts.length, 1, 'one recording per authentication session');
  assert.equal(sessionPosts[0].authorization, 'Bearer TOKEN-1');
  control.handleUser({ uid: 'user-a' });
  control.handleUser({ uid: 'user-a', email: 'user-a@example.com' });
  await flush();
  assert.equal(calls.filter(call => call.method === 'POST').length, 1, 'auth-state refires for the same account must not re-record');
});

test('with the security API unset the integration stays disabled and makes no requests', async () => {
  const { doc, elements } = securityDoc();
  const { calls, fetchImpl } = fakeFetch({ default: jsonResponse({}) });
  const control = await controller({ doc, elements }, { apiBase: '', fetchImpl });
  assert.equal(control.disabled, true);
  assert.equal(elements.get('security-toggle').hidden, true, 'no entry point without configuration');
  control.handleUser({ uid: 'user-a' });
  await flush();
  control.setOpen(true);
  await flush();
  assert.deepEqual(calls, [], 'a disabled integration must never contact any API');
  assert.equal(elements.get('account-security').hidden, true);
});

test('opening Account security retrieves the personal report and renders local timestamps', async () => {
  const { doc, elements } = securityDoc();
  const { calls, fetchImpl } = fakeFetch({
    '/api/session': jsonResponse({ recorded: true }),
    '/api/security-report': jsonResponse({
      sessions: [{ auth_time: 1763712000, first_seen_at: 1763712005 }, { auth_time: 1763625600, first_seen_at: 1763625600 }],
      retention_days: 30
    }),
    '/api/admin/security-report': jsonResponse({ error: 'Administrator access required.' }, 403)
  });
  const control = await controller({ doc, elements }, { fetchImpl });
  control.handleUser({ uid: 'user-a' });
  control.setOpen(true);
  await flush();
  assert.equal(elements.get('security-toggle').attributes['aria-expanded'], 'true');
  assert.equal(elements.get('account-security').hidden, false);
  const reportGets = calls.filter(call => call.url === `${base}/api/security-report`);
  assert.equal(reportGets.length, 1);
  assert.equal(reportGets[0].authorization, 'Bearer TOKEN-1');
  const list = elements.get('security-sessions');
  assert.equal(list.children.length, 2);
  const times = [...JSON.stringify(list.children).matchAll(/"dateTime":"([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(times, [
    '2025-11-21T08:00:00.000Z', '2025-11-21T08:00:05.000Z',
    '2025-11-20T08:00:00.000Z', '2025-11-20T08:00:00.000Z'
  ], 'each row shows auth_time and first_seen_at as local timestamps');
  assert.match(JSON.stringify(list.children), /First observed by Clearcutt/, 'both timestamps are labelled');
  assert.match(elements.get('security-status').textContent, /2 sessions in the last 30 days/);
  assert.equal(elements.get('security-empty').hidden, true);
  assert.equal(elements.get('security-retention').textContent, 'Login activity is kept for 30 days.');
  assert.equal(elements.get('security-admin').hidden, true, 'a 403 administrator response renders no administrator state');
});

test('an empty report shows a clear empty state', async () => {
  const { doc, elements } = securityDoc();
  const { fetchImpl } = fakeFetch({
    '/api/session': jsonResponse({ recorded: true }),
    '/api/security-report': jsonResponse({ sessions: [], retention_days: 30 }),
    '/api/admin/security-report': jsonResponse({}, 403)
  });
  const control = await controller({ doc, elements }, { fetchImpl });
  control.handleUser({ uid: 'user-a' });
  control.setOpen(true);
  await flush();
  assert.equal(elements.get('security-empty').hidden, false, 'the empty state is visible');
  assert.equal(elements.get('security-sessions').children.length, 0);
  const markup = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(markup, /No login sessions were recorded for your account in the last 30 days\./);
});

test('administrator report renders masked UIDs only after a successful authorization', async () => {
  const { doc, elements } = securityDoc();
  const fullUid = 'firebase-admin-uid-98765';
  const { fetchImpl } = fakeFetch({
    '/api/session': jsonResponse({ recorded: true }),
    '/api/security-report': jsonResponse({ sessions: [{ auth_time: 1763712000, first_seen_at: 1763712005 }], retention_days: 30 }),
    '/api/admin/security-report': jsonResponse({
      sessions: [{ uid: fullUid, auth_time: 1763712000, first_seen_at: 1763712005 }],
      retention_days: 30
    })
  });
  const control = await controller({ doc, elements }, { fetchImpl });
  control.handleUser({ uid: 'user-a' });
  control.setOpen(true);
  await flush();
  const admin = elements.get('security-admin');
  assert.equal(admin.hidden, false, 'HTTP 200 renders the administrator section');
  const adminText = JSON.stringify(elements.get('security-admin-list').children) + elements.get('security-admin-status').textContent;
  assert.equal(adminText.includes(fullUid), false, 'the full Firebase UID must never appear in the interface');
  assert.match(adminText, /fire…8765/);
  assert.match(elements.get('security-admin-status').textContent, /1 session across accounts · kept for 30 days/);
});

test('administrator denial is invisible to ordinary users and no allowlist exists client-side', async () => {
  const { doc, elements } = securityDoc();
  const { fetchImpl } = fakeFetch({
    '/api/session': jsonResponse({ recorded: true }),
    '/api/security-report': jsonResponse({ sessions: [{ auth_time: 1763712000, first_seen_at: 1763712005 }], retention_days: 30 }),
    '/api/admin/security-report': jsonResponse({ error: 'Administrator access requires a verified email, an allowlisted account and a recent sign-in.' }, 403)
  });
  const control = await controller({ doc, elements }, { fetchImpl });
  control.handleUser({ uid: 'user-a' });
  control.setOpen(true);
  await flush();
  assert.equal(elements.get('security-admin').hidden, true);
  assert.equal(elements.get('security-admin-list').children.length, 0);
  assert.doesNotMatch(elements.get('security-status').textContent, /[Aa]dministrator/, 'ordinary users see no administrator error or state');
  for (const file of ['src/security-report.ts', 'src/main.ts', 'index.html', '.env.example', 'wrangler.jsonc']) {
    assert.equal(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').includes('SECURITY_ADMIN_UIDS'), false, `${file} must not contain the administrator allowlist name`);
  }
  for (const file of ['wrangler.jsonc', 'wrangler.staging.jsonc']) {
    const vars = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').match(/"vars":\s*\{([^}]*)\}/)?.[1] ?? '';
    assert.equal(vars.includes('SECURITY_ADMIN_UIDS'), false, `${file} must never configure the administrator allowlist as a public variable`);
  }
});

test('signing out clears the displayed security data and closes the panel', async () => {
  const { doc, elements } = securityDoc();
  const { fetchImpl } = fakeFetch({
    '/api/session': jsonResponse({ recorded: true }),
    '/api/security-report': jsonResponse({ sessions: [{ auth_time: 1763712000, first_seen_at: 1763712005 }], retention_days: 30 }),
    '/api/admin/security-report': jsonResponse({}, 403)
  });
  const control = await controller({ doc, elements }, { fetchImpl });
  control.handleUser({ uid: 'user-a' });
  control.setOpen(true);
  await flush();
  assert.equal(elements.get('security-sessions').children.length, 1);
  control.handleUser(null);
  await flush();
  assert.equal(elements.get('security-sessions').children.length, 0, 'session history is cleared on sign-out');
  assert.equal(elements.get('security-admin').hidden, true);
  assert.equal(elements.get('account-security').hidden, true, 'the panel closes on sign-out');
  assert.equal(elements.get('security-toggle').attributes['aria-expanded'], 'false');
});

test('stale asynchronous responses cannot render after an account switch', async () => {
  const { doc, elements } = securityDoc();
  const calls = [];
  let resolveStale;
  let currentToken = 'TOKEN-user-a';
  const fetchImpl = async (url, options = {}) => {
    const call = { url, options, authorization: options.headers?.authorization, signal: options.signal };
    calls.push(call);
    if (url.endsWith('/api/session')) return jsonResponse({ recorded: true });
    if (url.endsWith('/api/admin/security-report')) return jsonResponse({ error: 'Administrator access required.' }, 403);
    if (call.authorization === 'Bearer TOKEN-user-a') {
      return new Promise(resolve => { resolveStale = resolve; });
    }
    return jsonResponse({ sessions: [{ auth_time: 1763712000, first_seen_at: 1763712005 }], retention_days: 30 });
  };
  const control = await controller({ doc, elements }, { fetchImpl, getToken: async () => currentToken });
  control.handleUser({ uid: 'user-a' });
  control.setOpen(true);
  await flush();
  currentToken = 'TOKEN-user-b';
  control.handleUser({ uid: 'user-b' });
  await flush();
  const staleReport = calls.find(call => call.authorization === 'Bearer TOKEN-user-a' && call.url.endsWith('/api/security-report'));
  assert.ok(staleReport, 'the superseded report request was captured');
  assert.equal(staleReport.signal.aborted, true, 'the superseded request is cancelled');
  // The stale user-a response arrives last; it must be ignored.
  resolveStale(jsonResponse({ sessions: [{ auth_time: 111, first_seen_at: 111 }], retention_days: 30 }));
  await flush();
  const list = elements.get('security-sessions');
  assert.equal(list.children.length, 1, 'only the current account\u2019s sessions are shown');
  assert.match(JSON.stringify(list.children), /2025-11-21T08:00:05\.000Z/);
  assert.equal(JSON.stringify(list.children).includes('1970'), false, 'the stale 1970-era payload never rendered');
  assert.match(elements.get('security-status').textContent, /1 session in the last 30 days/);
});

test('network and server failures degrade gracefully without disrupting the page', async () => {
  const { doc, elements } = securityDoc();
  let attempts = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith('/api/session')) throw new TypeError('network down');
    if (attempts++ === 0) throw new TypeError('network down');
    return jsonResponse({ error: 'boom' }, 500);
  };
  const control = await controller({ doc, elements }, { fetchImpl });
  control.handleUser({ uid: 'user-a' });
  await flush();
  assert.doesNotMatch(elements.get('security-status').textContent, /network down/, 'internal errors are never surfaced');
  control.setOpen(true);
  await flush();
  assert.match(elements.get('security-status').textContent, /Could not load login activity/, 'a network failure shows a clear retryable message');
  control.setOpen(false);
  control.setOpen(true);
  await flush();
  assert.match(elements.get('security-status').textContent, /temporarily unavailable/, 'a server failure shows a clear retryable message');
  assert.equal(elements.get('security-admin').hidden, true);
});

test('an expired Google session prompts sign-in again and the fixed explanation ships in the markup', async () => {
  const { doc, elements } = securityDoc();
  const { fetchImpl } = fakeFetch({
    '/api/session': jsonResponse({ error: 'Sign in with Google to continue.' }, 401),
    '/api/security-report': jsonResponse({ error: 'Sign in with Google to continue.' }, 401),
    '/api/admin/security-report': jsonResponse({ error: 'Administrator access required.' }, 403)
  });
  const control = await controller({ doc, elements }, { fetchImpl });
  control.handleUser({ uid: 'user-a' });
  control.setOpen(true);
  await flush();
  assert.match(elements.get('security-status').textContent, /Sign in again/);
  const markup = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(markup, /Login activity shows Google authentication sessions first observed by Clearcutt\. It is not a complete inventory of every Google account sign-in or device\./);
  assert.match(markup, /allowlisted Google account and a sign-in within the last 10 minutes/);
  assert.match(markup, /sign out and sign in again to refresh your administrator authentication/);
});

test('configuration ships safely: staging origin is CSP-permitted, env example is empty and no secrets exist client-side', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const connectSrc = html.match(/connect-src ([^;]*);/)?.[1] ?? '';
  assert.match(connectSrc, /https:\/\/clearcut-payments-staging\.clearcutt-payments\.workers\.dev/, 'the staging Worker origin must be permitted by connect-src');
  const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
  assert.match(envExample, /^VITE_SECURITY_API_BASE_URL=$/m, 'the security base URL ships empty in .env.example');
  assert.equal(/VITE_SECURITY_API_BASE_URL=https?:\/\//.test(envExample), false);
  const securitySource = readFileSync(new URL('../src/security-report.ts', import.meta.url), 'utf8');
  assert.equal(securitySource.includes('VITE_PAYMENT_API_BASE_URL'), false, 'the security module must not read payment configuration');
  for (const file of ['src/security-report.ts', 'src/main.ts']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.equal(/AIza|Bearer [A-Za-z0-9_\-]{20,}/.test(source), false, `${file} must not embed credentials`);
  }
});
