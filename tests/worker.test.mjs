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

function reviewDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  for (const name of ['0001_payments.sql', '0002_accounts.sql', '0003_reviews.sql']) {
    sqlite.exec(readFileSync(new URL(`../worker/migrations/${name}`, import.meta.url), 'utf8'));
  }
  const statement = (sql, args = []) => ({
    sql, args,
    async run() { sqlite.prepare(sql).run(...args); return { success: true }; },
    async first() { return sqlite.prepare(sql).get(...args) || null; },
    async all() { return { results: sqlite.prepare(sql).all(...args).map(row => ({ ...row })) }; }
  });
  return {
    sqlite,
    prepare(sql) {
      return { ...statement(sql), bind(...args) { return statement(sql, args); } };
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        for (const item of statements) sqlite.prepare(item.sql).run(...item.args);
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
      return [];
    }
  };
}

const validReview = { display_name: 'Clearcut user', rating: 5, body: 'The cutout was quick and the editor was easy to refine.' };
const reviewRequest = (path, options = {}) => worker.fetch(new Request(`https://api.example${path}`, {
  method: options.method || 'GET',
  headers: options.auth === false ? { ...(options.origin === false ? {} : { origin: 'https://clearcutt.in' }), 'content-type': 'application/json' }
    : { ...authHeaders(options.claims), ...(options.origin === false ? { origin: undefined } : {}) },
  ...(options.body ? { body: JSON.stringify(options.body) } : {})
}), options.workerEnv);

test('public reviews expose only approved display data and accurate aggregate values', async () => {
  const db = reviewDb();
  try {
    const insert = db.sqlite.prepare(`INSERT INTO reviews
      (id, uid, display_name, rating, body, status, created_at, updated_at, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    insert.run('11111111-1111-4111-8111-111111111111', 'private-user-1', 'Asha', 5, '<script>alert(1)</script> worked safely in this review.', 'approved', now - 100, now - 100, now - 50);
    insert.run('22222222-2222-4222-8222-222222222222', 'private-user-2', 'Ravi', 3, 'This approved review provides a second rating for the average.', 'approved', now - 90, now - 90, now - 40);
    insert.run('33333333-3333-4333-8333-333333333333', 'private-user-3', 'Pending', 1, 'This pending review must never be returned to public visitors.', 'pending', now, now, null);
    const response = await reviewRequest('/api/reviews', { auth: false, origin: false, workerEnv: env(keyFetch, db) });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /max-age=60/);
    assert.equal(result.count, 2);
    assert.equal(result.average, 4);
    assert.equal(result.reviews.length, 2);
    assert.equal(result.reviews.some(review => review.display_name === 'Pending'), false);
    assert.equal(JSON.stringify(result).includes('private-user'), false);
    assert.equal(JSON.stringify(result).includes('<script>alert(1)</script>'), true);
  } finally { db.sqlite.close(); }
});

test('review submission requires an allowed origin and valid constrained content', async () => {
  const db = reviewDb();
  try {
    const workerEnv = env(keyFetch, db);
    const wrongOrigin = await worker.fetch(new Request('https://api.example/api/reviews', {
      method: 'POST', headers: { ...authHeaders(), origin: 'https://attacker.example' }, body: JSON.stringify(validReview)
    }), workerEnv);
    assert.equal(wrongOrigin.status, 403);
    const invalid = await reviewRequest('/api/reviews', { method: 'POST', body: { display_name: 'X', rating: 6, body: 'too short' }, workerEnv });
    assert.equal(invalid.status, 400);
    const created = await reviewRequest('/api/reviews', { method: 'POST', body: validReview, workerEnv });
    assert.equal(created.status, 201);
    assert.deepEqual(await created.json(), { submitted: true, status: 'pending' });
    const stored = db.sqlite.prepare('SELECT uid, display_name, rating, body, status FROM reviews').get();
    assert.deepEqual({ ...stored }, { uid: 'clearcut-user', display_name: validReview.display_name, rating: 5, body: validReview.body, status: 'pending' });
  } finally { db.sqlite.close(); }
});

test('one review per account is throttled and an edit returns an approved review to moderation', async () => {
  const db = reviewDb();
  try {
    const workerEnv = env(keyFetch, db);
    const first = await reviewRequest('/api/reviews', { method: 'POST', body: validReview, workerEnv });
    assert.equal(first.status, 201);
    const throttled = await reviewRequest('/api/reviews', { method: 'POST', body: { ...validReview, rating: 4 }, workerEnv });
    assert.equal(throttled.status, 429);
    db.sqlite.prepare("UPDATE reviews SET status = 'approved', published_at = ?, updated_at = ?").run(now - 4000, now - 7200);
    const edited = await reviewRequest('/api/reviews', { method: 'POST', body: { ...validReview, rating: 4, body: 'I updated this genuine review after using the editor again.' }, workerEnv });
    assert.equal(edited.status, 200);
    const rows = db.sqlite.prepare('SELECT rating, status, published_at, COUNT(*) OVER () AS total FROM reviews').all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].rating, 4);
    assert.equal(rows[0].status, 'pending');
    assert.equal(rows[0].published_at, null);
  } finally { db.sqlite.close(); }
});

test('signed-in users can inspect and delete only their own review', async () => {
  const db = reviewDb();
  try {
    db.sqlite.prepare(`INSERT INTO reviews (id, uid, display_name, rating, body, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`).run('44444444-4444-4444-8444-444444444444', 'clearcut-user', 'Owner', 4, 'This review belongs to the currently authenticated account.', now, now);
    const workerEnv = { ...env(keyFetch, db), REVIEW_ADMIN_UIDS: 'clearcut-user' };
    const mine = await reviewRequest('/api/reviews/mine', { workerEnv });
    const result = await mine.json();
    assert.equal(result.review.body, 'This review belongs to the currently authenticated account.');
    assert.equal(result.is_admin, true);
    assert.equal(JSON.stringify(result).includes('clearcut-user'), false);
    const deleted = await reviewRequest('/api/reviews/delete', { method: 'POST', body: {}, workerEnv });
    assert.equal(deleted.status, 200);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM reviews').get().count, 0);
  } finally { db.sqlite.close(); }
});

test('only configured administrators can moderate reviews and every decision is audited', async () => {
  const db = reviewDb();
  try {
    const reviewId = '55555555-5555-4555-8555-555555555555';
    db.sqlite.prepare(`INSERT INTO reviews (id, uid, display_name, rating, body, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`).run(reviewId, 'reviewer-user', 'Reviewer', 5, 'A pending review that needs a human moderation decision.', now, now);
    const ordinaryEnv = env(keyFetch, db);
    const forbidden = await reviewRequest('/api/admin/reviews?status=pending', { workerEnv: ordinaryEnv });
    assert.equal(forbidden.status, 403);
    const adminEnv = { ...ordinaryEnv, REVIEW_ADMIN_UIDS: 'clearcut-user' };
    const queue = await reviewRequest('/api/admin/reviews?status=pending', { workerEnv: adminEnv });
    assert.equal((await queue.json()).reviews.length, 1);
    const approved = await reviewRequest('/api/admin/reviews/moderate', {
      method: 'POST', body: { review_id: reviewId, action: 'approve', reason: 'Relevant first-hand product feedback.' }, workerEnv: adminEnv
    });
    assert.equal(approved.status, 200);
    assert.equal((await approved.json()).status, 'approved');
    const review = db.sqlite.prepare('SELECT status, moderated_by, published_at FROM reviews WHERE id = ?').get(reviewId);
    assert.equal(review.status, 'approved');
    assert.equal(review.moderated_by, 'clearcut-user');
    assert.ok(review.published_at > 0);
    const audit = db.sqlite.prepare('SELECT review_id, moderator_uid, action, reason FROM review_moderation_audit').get();
    assert.deepEqual({ ...audit }, { review_id: reviewId, moderator_uid: 'clearcut-user', action: 'approved', reason: 'Relevant first-hand product feedback.' });
  } finally { db.sqlite.close(); }
});
