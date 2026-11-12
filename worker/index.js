const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const RAZORPAY_API = 'https://api.razorpay.com/v1';
const ACCESS_SECONDS = 30 * 24 * 60 * 60;
const DAILY_LIMIT = 20;
const BATCH_LIMIT = 5;
const REVIEW_UPDATE_SECONDS = 60 * 60;

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

function responseWithHeaders(response, headers) {
  const responseHeaders = new Headers(response.headers);
  for (const [name, value] of Object.entries(headers || {})) responseHeaders.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
}

function adminUids(env) {
  return new Set((env.REVIEW_ADMIN_UIDS || '').split(',').map(value => value.trim()).filter(Boolean));
}

function reviewInput(body) {
  const displayName = typeof body?.display_name === 'string' ? body.display_name.trim() : '';
  const reviewBody = typeof body?.body === 'string' ? body.body.trim() : '';
  const rating = body?.rating;
  const controls = /[\u0000-\u001f\u007f]/u;
  if (Array.from(displayName).length < 2 || Array.from(displayName).length > 50 || controls.test(displayName)) return null;
  if (Array.from(reviewBody).length < 20 || Array.from(reviewBody).length > 1000 || controls.test(reviewBody)) return null;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  return { displayName, reviewBody, rating };
}

async function publicReviews(env) {
  if (!env.DB) return json({ error: 'Reviews are temporarily unavailable.' }, 503);
  try {
    const [list, aggregate] = await Promise.all([
      env.DB.prepare(`SELECT id, display_name, rating, body, published_at
        FROM reviews WHERE status = 'approved' ORDER BY published_at DESC LIMIT 50`).all(),
      env.DB.prepare("SELECT COUNT(*) AS count, ROUND(AVG(rating), 1) AS average FROM reviews WHERE status = 'approved'").first()
    ]);
    return json({ reviews: list?.results || [], count: Number(aggregate?.count || 0), average: aggregate?.average == null ? null : Number(aggregate.average) });
  } catch { return json({ error: 'Reviews are temporarily unavailable.' }, 503); }
}

async function ownReview(env, uid) {
  try {
    const review = await env.DB.prepare(`SELECT id, display_name, rating, body, status, created_at, updated_at
      FROM reviews WHERE uid = ?`).bind(uid).first();
    return json({ review: review || null, is_admin: adminUids(env).has(uid) });
  } catch { return json({ error: 'Could not load your review.' }, 503); }
}

async function saveReview(request, env, uid) {
  const input = reviewInput(await readJson(request));
  if (!input) return json({ error: 'Use a display name of 2–50 characters, a rating from 1–5, and a review of 20–1000 characters.' }, 400);
  try {
    const existing = await env.DB.prepare('SELECT id, updated_at FROM reviews WHERE uid = ?').bind(uid).first();
    const now = Math.floor(Date.now() / 1000);
    if (existing && Number(existing.updated_at) > now - REVIEW_UPDATE_SECONDS) {
      return json({ error: 'Please wait an hour before editing and resubmitting your review.' }, 429);
    }
    if (existing) {
      await env.DB.prepare(`UPDATE reviews SET display_name = ?, rating = ?, body = ?, status = 'approved',
        updated_at = unixepoch(), published_at = unixepoch(), moderated_at = NULL, moderated_by = NULL WHERE uid = ?`)
        .bind(input.displayName, input.rating, input.reviewBody, uid).run();
    } else {
      await env.DB.prepare(`INSERT INTO reviews
        (id, uid, display_name, rating, body, status, created_at, updated_at, published_at)
        VALUES (?, ?, ?, ?, ?, 'approved', unixepoch(), unixepoch(), unixepoch())`)
        .bind(crypto.randomUUID(), uid, input.displayName, input.rating, input.reviewBody).run();
    }
    return json({ submitted: true, status: 'approved' }, existing ? 200 : 201);
  } catch { return json({ error: 'Could not save your review. Please retry.' }, 503); }
}

async function deleteReview(env, uid) {
  try {
    await env.DB.prepare('DELETE FROM reviews WHERE uid = ?').bind(uid).run();
    return json({ deleted: true });
  } catch { return json({ error: 'Could not delete your review. Please retry.' }, 503); }
}

async function reviewQueue(env, uid, status) {
  if (!adminUids(env).has(uid)) return json({ error: 'Administrator access required.' }, 403);
  if (!['pending', 'approved', 'rejected'].includes(status)) return json({ error: 'Unknown review status.' }, 400);
  try {
    const result = await env.DB.prepare(`SELECT id, display_name, rating, body, status, created_at, updated_at,
      published_at, moderated_at FROM reviews WHERE status = ? ORDER BY updated_at ASC LIMIT 100`).bind(status).all();
    return json({ reviews: result?.results || [] });
  } catch { return json({ error: 'Could not load the moderation queue.' }, 503); }
}

async function moderateReview(request, env, uid) {
  if (!adminUids(env).has(uid)) return json({ error: 'Administrator access required.' }, 403);
  const body = await readJson(request);
  const reviewId = typeof body?.review_id === 'string' ? body.review_id : '';
  const action = body?.action;
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (!/^[a-f\d]{8}-[a-f\d]{4}-[1-5][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(reviewId)
    || !['approve', 'reject'].includes(action) || Array.from(reason).length > 300
    || /[\u0000-\u001f\u007f]/u.test(reason)) return json({ error: 'Moderation request is invalid.' }, 400);
  try {
    const review = await env.DB.prepare('SELECT id FROM reviews WHERE id = ?').bind(reviewId).first();
    if (!review) return json({ error: 'Review not found.' }, 404);
    const approved = action === 'approve';
    await env.DB.batch([
      env.DB.prepare(`UPDATE reviews SET status = ?, updated_at = unixepoch(), moderated_at = unixepoch(),
        moderated_by = ?, published_at = ${approved ? 'unixepoch()' : 'NULL'} WHERE id = ?`)
        .bind(approved ? 'approved' : 'rejected', uid, reviewId),
      env.DB.prepare(`INSERT INTO review_moderation_audit
        (id, review_id, moderator_uid, action, reason, created_at) VALUES (?, ?, ?, ?, ?, unixepoch())`)
        .bind(crypto.randomUUID(), reviewId, uid, approved ? 'approved' : 'rejected', reason || null)
    ]);
    return json({ moderated: true, status: approved ? 'approved' : 'rejected' });
  } catch { return json({ error: 'Could not moderate this review.' }, 503); }
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
    if (url.pathname === '/api/reviews' && request.method === 'GET') return responseWithHeaders(await publicReviews(env), headers);
    if (!headers) return json({ error: 'Origin is not allowed.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const getRoutes = ['/api/entitlement', '/api/reviews/mine', '/api/admin/reviews'];
    if (request.method !== (getRoutes.includes(url.pathname) ? 'GET' : 'POST')) return json({ error: 'Method not allowed.' }, 405, headers);
    const response = await (async () => {
      const fetchImpl = env.__testFetch || fetch;
      const user = await requireUser(request, env, fetchImpl);
      if (!user) return json({ error: 'Sign in with Google to continue.' }, 401);
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
      if (url.pathname === '/api/reviews/mine') return ownReview(env, user.uid);
      if (url.pathname === '/api/reviews') return saveReview(request, env, user.uid);
      if (url.pathname === '/api/reviews/delete') return deleteReview(env, user.uid);
      if (url.pathname === '/api/admin/reviews') return reviewQueue(env, user.uid, url.searchParams.get('status') || 'pending');
      if (url.pathname === '/api/admin/reviews/moderate') return moderateReview(request, env, user.uid);
      return json({ error: 'Not found.' }, 404);
    })();
    return responseWithHeaders(response, headers);
  }
};
