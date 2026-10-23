import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync, sign } from 'node:crypto';
import worker from '../worker/index.js';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const projectId = 'clearcut-remove-bg';
const now = Math.floor(Date.now() / 1000);
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', kty: 'RSA', alg: 'RS256', use: 'sig' };
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function token(claimOverrides = {}) {
  const head = b64({ alg: 'RS256', kid: 'test-key', typ: 'JWT' });
  const claims = b64({ iss: `https://securetoken.google.com/${projectId}`, aud: projectId, sub: 'clearcut-user', iat: now, auth_time: now, exp: now + 3600, ...claimOverrides });
  const input = `${head}.${claims}`;
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
}

function fakeDb() {
  const calls = [];
  const webhookEvents = new Set();
  const db = {
    prepare(sql) {
      return {
        sql,
        bind(...args) {
          return {
            sql,
            args,
            async run() { calls.push({ sql, args }); return { success: true }; },
            async first() {
              if (sql.includes('FROM webhook_events')) return webhookEvents.has(args[0]) ? { event_id: args[0] } : null;
              if (sql.includes('FROM orders WHERE order_id')) return { uid: 'clearcut-user', amount_paise: 9000, currency: 'INR', status: 'pending', payment_id: null };
              if (sql.includes('FROM entitlements')) return { plan_id: 'plus-monthly', expires_at: now + 2592000, daily_limit: 20, batch_limit: 5 };
              return null;
            }
          };
        }
      };
    },
    async batch(statements) {
      calls.push({ batch: statements.map(({ sql, args }) => ({ sql, args })) });
      if (statements[0]?.sql.startsWith('INSERT INTO webhook_events')) webhookEvents.add(statements[0].args[0]);
      return [];
    },
    calls
  };
  return db;
}

function env(fetchImpl, db = fakeDb()) {
  return {
    __testFetch: fetchImpl, DB: db, FIREBASE_PROJECT_ID: projectId,
    PAYMENT_MODE: 'live', RAZORPAY_KEY_ID: 'rzp_live_public', RAZORPAY_KEY_SECRET: 'server-only-secret',
    RAZORPAY_WEBHOOK_SECRET: 'webhook-only-secret',
    PLAN_AMOUNT_PAISE: '9000', ALLOWED_ORIGINS: 'https://clearcutt.in'
  };
}

function authHeaders(claims = {}) {
  return { origin: 'https://clearcutt.in', authorization: `Bearer ${token(claims)}`, 'content-type': 'application/json' };
}

test('live order uses server-fixed ₹90 price and never returns the secret', async () => {
  let providerOrder;
  const db = fakeDb();
  const fetchImpl = async (url, options) => {
    if (url.startsWith('https://www.googleapis.com/')) return Response.json({ keys: [jwk] });
    providerOrder = JSON.parse(options.body);
    return Response.json({ id: 'order_live123', amount: 9000, currency: 'INR' });
  };
  const response = await worker.fetch(new Request('https://api.example/api/createOrder', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ plan: 'plus-monthly', amount: 1 }) }), env(fetchImpl, db));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://clearcutt.in');
  assert.equal(providerOrder.amount, 9000);
  assert.equal(providerOrder.notes.clearcut_uid, 'clearcut-user');
  assert.equal(result.amount, 9000);
  assert.equal(JSON.stringify(result).includes('server-only-secret'), false);
  assert.equal(db.calls.some(call => call.sql?.startsWith('INSERT INTO orders')), true);
});

test('wrong origin and invalid Firebase tokens are rejected', async () => {
  const response = await worker.fetch(new Request('https://api.example/api/createOrder', { method: 'POST', headers: { origin: 'https://attacker.example' }, body: '{}' }), env(async () => { throw Error('must not call provider'); }));
  assert.equal(response.status, 403);
  const badToken = token({ aud: 'another-project' });
  const invalid = await worker.fetch(new Request('https://api.example/api/createOrder', { method: 'POST', headers: { origin: 'https://clearcutt.in', authorization: `Bearer ${badToken}`, 'content-type': 'application/json' }, body: '{"plan":"plus-monthly"}' }), env(async url => url.startsWith('https://www.googleapis.com/') ? Response.json({ keys: [jwk] }) : Response.json({ id: 'never' })));
  assert.equal(invalid.status, 401);
});

test('payment verification rejects bad signatures and only grants on captured exact order', async () => {
  const signature = createHmac('sha256', 'server-only-secret').update('order_live123|pay_live123').digest('hex');
  const db = fakeDb();
  const fetchImpl = async url => {
    if (url.startsWith('https://www.googleapis.com/')) return Response.json({ keys: [jwk] });
    if (url.endsWith('/orders/order_live123')) return Response.json({ id: 'order_live123', notes: { clearcut_uid: 'clearcut-user', clearcut_plan: 'plus-monthly-v1' }, status: 'paid', amount: 9000, amount_paid: 9000, currency: 'INR' });
    return Response.json({ id: 'pay_live123', order_id: 'order_live123', status: 'captured', amount: 9000, currency: 'INR' });
  };
  const bad = await worker.fetch(new Request('https://api.example/api/verifyPayment', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ razorpay_order_id: 'order_live123', razorpay_payment_id: 'pay_live123', razorpay_signature: '0'.repeat(64) }) }), env(fetchImpl, db));
  assert.equal(bad.status, 400);
  const good = await worker.fetch(new Request('https://api.example/api/verifyPayment', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ razorpay_order_id: 'order_live123', razorpay_payment_id: 'pay_live123', razorpay_signature: signature }) }), env(fetchImpl, db));
  const result = await good.json();
  assert.equal(good.status, 200);
  assert.equal(result.verified, true);
  assert.equal(result.entitlement.daily_limit, 20);
  assert.equal(result.entitlement.batch_limit, 5);
  const entitlementBatch = db.calls.find(call => Array.isArray(call.batch))?.batch;
  assert.equal(entitlementBatch.length, 3);
  const entitlementSql = entitlementBatch[1].sql;
  assert.match(entitlementSql, /SELECT uid, 'plus-monthly', unixepoch\(\) \+ \?/);
  assert.match(entitlementSql, /expires_at = MAX\(entitlements\.expires_at, unixepoch\(\)\) \+ \?/);
});

test('webhook signature is required and a replayed event does not grant access twice', async () => {
  const db = fakeDb();
  const payload = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: {
    id: 'pay_live123', order_id: 'order_live123', status: 'captured', amount: 9000, currency: 'INR'
  } } } });
  const signature = createHmac('sha256', 'webhook-only-secret').update(payload).digest('hex');
  const send = signatureValue => worker.fetch(new Request('https://api.example/api/webhook', {
    method: 'POST', headers: { 'x-razorpay-signature': signatureValue, 'x-razorpay-event-id': 'evt_live123' }, body: payload
  }), env(async () => { throw Error('Webhook must not call external APIs'); }, db));

  const invalid = await send('0'.repeat(64));
  assert.equal(invalid.status, 400);
  const first = await send(signature);
  assert.equal(first.status, 200);
  const duplicate = await send(signature);
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).duplicate, true);
  assert.equal(db.calls.filter(call => Array.isArray(call.batch)).length, 1);
});


function accountDb() {
  const sqlite = new DatabaseSync(':memory:');
  for (const name of ['0001_payments.sql', '0002_accounts.sql']) sqlite.exec(readFileSync(new URL(`../worker/migrations/${name}`, import.meta.url), 'utf8'));
  sqlite.prepare("INSERT INTO entitlements VALUES (?, 'plus-monthly', ?, 20, 5, ?)").run('clearcut-user', now + 86400, now);
  return { sqlite, prepare(sql) { return { bind(...args) { return {
    async run() { sqlite.prepare(sql).run(...args); return { success: true }; },
    async first() { return sqlite.prepare(sql).get(...args) || null; }
  }; } }; } };
}
const keyFetch = async () => Response.json({ keys: [jwk] });
const getMembership = (db, claims) => worker.fetch(new Request('https://api.example/api/entitlement', {
  headers: authHeaders(claims)
}), env(keyFetch, db));

test('paid membership survives new authenticated requests and saves only the verified email', async () => {
  const db = accountDb();
  try {
    const claims = { email: 'member@example.com', email_verified: true };
    const first = await getMembership(db, claims);
    assert.equal(first.status, 200);
    assert.equal((await first.json()).entitlement.plan_id, 'plus-monthly');
    const restored = await getMembership(db, claims);
    assert.equal((await restored.json()).entitlement.expires_at, now + 86400);
    const saved = db.sqlite.prepare('SELECT uid, email FROM accounts').all();
    assert.deepEqual(saved.map(row => ({ ...row })), [{ uid: 'clearcut-user', email: 'member@example.com' }]);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM entitlements').get().n, 1);
  } finally { db.sqlite.close(); }
});

test('email alone never transfers paid access to another Google account', async () => {
  const db = accountDb();
  try {
    await getMembership(db, { email: 'member@example.com', email_verified: true });
    const other = await getMembership(db, { sub: 'different-user', email: 'member@example.com', email_verified: true });
    assert.equal(other.status, 200);
    assert.equal((await other.json()).entitlement, null);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM entitlements').get().n, 1);
  } finally { db.sqlite.close(); }
});

test('unverified email and forged tokens cannot overwrite the stored verified account', async () => {
  const db = accountDb();
  try {
    await getMembership(db, { email: 'member@example.com', email_verified: true });
    await getMembership(db, { email: 'unverified@example.com', email_verified: false });
    const parts = token({ email: 'member@example.com', email_verified: true }).split('.');
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url'));
    parts[1] = b64({ ...claims, email: 'forged@example.com' });
    const response = await worker.fetch(new Request('https://api.example/api/entitlement', {
      headers: { ...authHeaders(), authorization: `Bearer ${parts.join('.')}` }
    }), env(keyFetch, db));
    assert.equal(response.status, 401);
    assert.equal(db.sqlite.prepare('SELECT email FROM accounts').get().email, 'member@example.com');
  } finally { db.sqlite.close(); }
});
