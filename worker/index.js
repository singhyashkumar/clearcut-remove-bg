const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const RAZORPAY_API = 'https://api.razorpay.com/v1';
const ACCESS_SECONDS = 30 * 24 * 60 * 60;
const DAILY_LIMIT = 20;
const BATCH_LIMIT = 5;

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers }
});

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return null;
  return { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'Authorization, Content-Type', 'vary': 'Origin' };
}

function b64urlBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function decodeSegment(value) {
  return JSON.parse(new TextDecoder().decode(b64urlBytes(value)));
}

export async function verifyFirebaseIdToken(token, projectId, fetchImpl = fetch, now = Math.floor(Date.now() / 1000)) {
  if (typeof token !== 'string' || token.length > 8192 || typeof projectId !== 'string' || !projectId) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  let header, claims;
  try { header = decodeSegment(parts[0]); claims = decodeSegment(parts[1]); } catch { return null; }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || claims.iss !== `https://securetoken.google.com/${projectId}`
    || claims.aud !== projectId || typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128
    || !Number.isInteger(claims.exp) || claims.exp <= now || !Number.isInteger(claims.iat) || claims.iat > now + 60
    || !Number.isInteger(claims.auth_time) || claims.auth_time > now + 60) return null;
  try {
    const keySet = await fetchImpl(FIREBASE_JWKS_URL, { signal: AbortSignal.timeout(10000) }).then(response => response.ok ? response.json() : null);
    const jwk = keySet?.keys?.find(key => key.kid === header.kid && key.kty === 'RSA');
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!valid) return null;
    const email = claims.email_verified === true && typeof claims.email === 'string' && claims.email.length <= 254
      && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email) ? claims.email : null;
    return { uid: claims.sub, email };
  } catch { return null; }
}

async function hmacValid(secret, message, signature) {
  if (typeof signature !== 'string' || !/^[a-f\d]{64}$/i.test(signature)) return false;
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    return crypto.subtle.verify('HMAC', key, Uint8Array.from(signature.match(/.{2}/g), byte => Number.parseInt(byte, 16)), new TextEncoder().encode(message));
  } catch { return false; }
}

function basicAuth(keyId, keySecret) {
  return `Basic ${btoa(`${keyId}:${keySecret}`)}`;
}

function configured(env) {
  const expectedPrefix = env.PAYMENT_MODE === 'live' ? 'rzp_live_' : 'rzp_test_';
  return typeof env.RAZORPAY_KEY_ID === 'string' && env.RAZORPAY_KEY_ID.startsWith(expectedPrefix)
    && typeof env.RAZORPAY_KEY_SECRET === 'string' && env.RAZORPAY_KEY_SECRET.length > 0
    && Number.isSafeInteger(Number(env.PLAN_AMOUNT_PAISE)) && Number(env.PLAN_AMOUNT_PAISE) >= 100
    && env.DB && typeof env.FIREBASE_PROJECT_ID === 'string';
}

async function requireUser(request, env, fetchImpl = fetch) {
  const match = /^Bearer ([^\s]+)$/.exec(request.headers.get('authorization') || '');
  if (!match) return null;
  return verifyFirebaseIdToken(match[1], env.FIREBASE_PROJECT_ID, fetchImpl);
}

async function readJson(request) {
  try {
    const text = await request.text();
    if (text.length > 16384) return null;
    return JSON.parse(text);
  } catch { return null; }
}

async function createOrder(request, env, uid, fetchImpl = fetch) {
  const body = await readJson(request);
  if (!body || body.plan !== 'plus-monthly') return json({ error: 'Choose the Clearcut Plus monthly plan.' }, 400);
  if (!configured(env)) return json({ error: 'Payment service is not configured for this mode.' }, 503);
  const recentOrders = await env.DB.prepare("SELECT COUNT(*) AS count FROM orders WHERE uid = ? AND created_at >= unixepoch() - 600").bind(uid).first();
  if ((recentOrders?.count || 0) >= 5) return json({ error: 'Too many checkout attempts. Wait a few minutes and try again.' }, 429);
  const receipt = `cc_${crypto.randomUUID().replaceAll('-', '')}`;
  let response, result;
  try {
    response = await fetchImpl(`${RAZORPAY_API}/orders`, {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { authorization: basicAuth(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET), 'content-type': 'application/json' },
      body: JSON.stringify({ amount: Number(env.PLAN_AMOUNT_PAISE), currency: 'INR', receipt, notes: { clearcut_uid: uid, clearcut_plan: 'plus-monthly-v1' } })
    });
    result = await response.json();
  } catch { return json({ error: 'Could not start checkout. Please retry.' }, 502); }
  if (!response.ok || typeof result?.id !== 'string' || result.amount !== Number(env.PLAN_AMOUNT_PAISE) || result.currency !== 'INR') {
    return json({ error: 'Could not start checkout. Please retry.' }, 502);
  }
  try {
    await env.DB.prepare('INSERT INTO orders (order_id, uid, amount_paise, currency, status, created_at) VALUES (?, ?, ?, ?, ?, unixepoch())')
      .bind(result.id, uid, result.amount, result.currency, 'pending').run();
  } catch { return json({ error: 'Could not save this checkout. Please retry.' }, 503); }
  return json({ order_id: result.id, amount: result.amount, currency: result.currency, key_id: env.RAZORPAY_KEY_ID, plan: 'plus-monthly' });
}

async function recordPaidOrder(db, orderId, paymentId, uid, amount) {
  const statements = [
    db.prepare("UPDATE orders SET status = 'paid', payment_id = ? WHERE order_id = ? AND uid = ? AND amount_paise = ? AND currency = 'INR' AND status = 'pending'").bind(paymentId, orderId, uid, amount),
    db.prepare(`INSERT INTO entitlements (uid, plan_id, expires_at, daily_limit, batch_limit, updated_at)
      SELECT uid, 'plus-monthly', unixepoch() + ?, ?, ?, unixepoch()
      FROM orders WHERE order_id = ? AND status = 'paid' AND entitlement_extended_at IS NULL
      ON CONFLICT(uid) DO UPDATE SET plan_id = 'plus-monthly', expires_at = MAX(entitlements.expires_at, unixepoch()) + ?, daily_limit = ?, batch_limit = ?, updated_at = unixepoch()`)
      .bind(ACCESS_SECONDS, DAILY_LIMIT, BATCH_LIMIT, orderId, ACCESS_SECONDS, DAILY_LIMIT, BATCH_LIMIT),
    db.prepare("UPDATE orders SET entitlement_extended_at = unixepoch() WHERE order_id = ? AND status = 'paid' AND entitlement_extended_at IS NULL").bind(orderId)
  ];
  await db.batch(statements);
  return db.prepare('SELECT plan_id, expires_at, daily_limit, batch_limit FROM entitlements WHERE uid = ?').bind(uid).first();
}

async function verifyPayment(request, env, uid, fetchImpl = fetch) {
  if (!configured(env)) return json({ error: 'Payment service is not configured for this mode.' }, 503);
  const body = await readJson(request);
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body || {};
  if (![orderId, paymentId, signature].every(value => typeof value === 'string' && value.length > 0)
    || !/^order_[a-z\d]+$/i.test(orderId) || !/^pay_[a-z\d]+$/i.test(paymentId)) return json({ error: 'Payment verification fields are missing or invalid.' }, 400);
  const stored = await env.DB.prepare('SELECT uid, amount_paise, currency, status, payment_id FROM orders WHERE order_id = ?').bind(orderId).first();
  if (!stored || stored.uid !== uid) return json({ error: 'This order does not belong to the signed-in account.' }, 403);
  if (!await hmacValid(env.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`, signature)) return json({ error: 'Payment signature is invalid.' }, 400);
  try {
    const authorization = { authorization: basicAuth(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET) };
    const [orderResponse, paymentResponse] = await Promise.all([
      fetchImpl(`${RAZORPAY_API}/orders/${encodeURIComponent(orderId)}`, { signal: AbortSignal.timeout(15000), headers: authorization }),
      fetchImpl(`${RAZORPAY_API}/payments/${encodeURIComponent(paymentId)}`, { signal: AbortSignal.timeout(15000), headers: authorization })
    ]);
    const [order, payment] = await Promise.all([orderResponse.json(), paymentResponse.json()]);
    const amount = Number(env.PLAN_AMOUNT_PAISE);
    if (!orderResponse.ok || !paymentResponse.ok || order?.id !== orderId || order?.notes?.clearcut_uid !== uid
      || order?.notes?.clearcut_plan !== 'plus-monthly-v1' || order?.amount !== amount || order?.currency !== 'INR'
      || order?.status !== 'paid' || order?.amount_paid !== amount || payment?.id !== paymentId || payment?.order_id !== orderId
      || payment?.status !== 'captured' || payment?.amount !== amount || payment?.currency !== 'INR') {
      return json({ error: 'Payment is not captured for the expected plan yet.' }, 409);
    }
    if (stored.status === 'paid' && stored.payment_id !== paymentId) return json({ error: 'This order is already linked to another payment.' }, 409);
    const entitlement = await recordPaidOrder(env.DB, orderId, paymentId, uid, amount);
    return entitlement ? json({ verified: true, entitlement }) : json({ error: 'Payment was checked, but access could not be updated.' }, 503);
  } catch { return json({ error: 'Could not confirm payment status. Please contact support before retrying.' }, 502); }
}

async function getEntitlement(env, uid) {
  const entitlement = await env.DB.prepare('SELECT plan_id, expires_at, daily_limit, batch_limit FROM entitlements WHERE uid = ? AND expires_at > unixepoch()').bind(uid).first();
  return json({ entitlement: entitlement || null });
}

async function webhook(request, env) {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !env.DB) return json({ error: 'Webhook is not configured.' }, 503);
  const signature = request.headers.get('x-razorpay-signature') || '';
  const eventId = request.headers.get('x-razorpay-event-id') || '';
  const raw = await request.text();
  if (raw.length > 65536 || !eventId || eventId.length > 128 || !await hmacValid(env.RAZORPAY_WEBHOOK_SECRET, raw, signature)) return json({ error: 'Invalid webhook.' }, 400);
  let event;
  try { event = JSON.parse(raw); } catch { return json({ error: 'Invalid webhook.' }, 400); }
  if (!['payment.captured', 'order.paid'].includes(event?.event)) return json({ received: true });
  const payment = event?.payload?.payment?.entity;
  if (!payment || payment.status !== 'captured' || typeof payment.order_id !== 'string' || typeof payment.id !== 'string') return json({ error: 'Payment event is incomplete.' }, 400);
  try {
    const prior = await env.DB.prepare('SELECT event_id FROM webhook_events WHERE event_id = ?').bind(eventId).first();
    if (prior) return json({ received: true, duplicate: true });
    const order = await env.DB.prepare('SELECT uid, amount_paise, currency, status FROM orders WHERE order_id = ?').bind(payment.order_id).first();
    if (!order || order.amount_paise !== payment.amount || order.currency !== payment.currency || payment.currency !== 'INR') return json({ error: 'Payment does not match a Clearcut order.' }, 409);
    const statements = [
      env.DB.prepare('INSERT INTO webhook_events (event_id, received_at) VALUES (?, unixepoch())').bind(eventId),
      env.DB.prepare("UPDATE orders SET status = 'paid', payment_id = ? WHERE order_id = ? AND status = 'pending' AND amount_paise = ?").bind(payment.id, payment.order_id, payment.amount),
      env.DB.prepare(`INSERT INTO entitlements (uid, plan_id, expires_at, daily_limit, batch_limit, updated_at)
        SELECT uid, 'plus-monthly', unixepoch() + ?, ?, ?, unixepoch()
        FROM orders WHERE order_id = ? AND status = 'paid' AND entitlement_extended_at IS NULL
        ON CONFLICT(uid) DO UPDATE SET plan_id = 'plus-monthly', expires_at = MAX(entitlements.expires_at, unixepoch()) + ?, daily_limit = ?, batch_limit = ?, updated_at = unixepoch()`)
        .bind(ACCESS_SECONDS, DAILY_LIMIT, BATCH_LIMIT, payment.order_id, ACCESS_SECONDS, DAILY_LIMIT, BATCH_LIMIT),
      env.DB.prepare("UPDATE orders SET entitlement_extended_at = unixepoch() WHERE order_id = ? AND status = 'paid' AND entitlement_extended_at IS NULL").bind(payment.order_id)
    ];
    await env.DB.batch(statements);
    return json({ received: true });
  } catch { return json({ error: 'Could not process webhook.' }, 503); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    const headers = corsHeaders(origin, env);
    if (url.pathname === '/api/webhook') return request.method === 'POST' ? webhook(request, env) : json({ error: 'Method not allowed.' }, 405);
    if (!headers) return json({ error: 'Origin is not allowed.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== (url.pathname === '/api/entitlement' ? 'GET' : 'POST')) return json({ error: 'Method not allowed.' }, 405, headers);
    const response = await (async () => {
      const fetchImpl = env.__testFetch || fetch;
      const user = await requireUser(request, env, fetchImpl);
      if (!user) return json({ error: 'Sign in with Google before using checkout.' }, 401);
      if (user.email && ['/api/createOrder', '/api/verifyPayment', '/api/entitlement'].includes(url.pathname)) {
        try {
          await env.DB.prepare(`INSERT INTO accounts (uid, email, updated_at) VALUES (?, ?, unixepoch())
            ON CONFLICT(uid) DO UPDATE SET email = excluded.email, updated_at = unixepoch()
            WHERE accounts.email != excluded.email`).bind(user.uid, user.email).run();
        } catch { return json({ error: 'Could not sync your account. Please retry; your saved membership is unchanged.' }, 503); }
      }
      if (url.pathname === '/api/createOrder') return createOrder(request, env, user.uid, fetchImpl);
      if (url.pathname === '/api/verifyPayment') return verifyPayment(request, env, user.uid, fetchImpl);
      if (url.pathname === '/api/entitlement') return getEntitlement(env, user.uid);
      return json({ error: 'Not found.' }, 404);
    })();
    const responseHeaders = new Headers(response.headers);
    for (const [name, value] of Object.entries(headers)) responseHeaders.set(name, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
  }
};
