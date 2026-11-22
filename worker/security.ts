// Security plumbing for the Clearcutt Worker (Workstream 3).
//
// Logging contract: logSecurityRequest accepts ONLY the fixed fields listed in
// SecurityLogFields. Never pass request headers, bodies, token claims, provider
// errors, email addresses, Firebase UIDs, IP addresses, user agents, query
// strings or exception messages to this module — callers cannot log them because
// the signature has nowhere to put them, and routeName() never lets a
// user-controlled path become the route label.

type SqlValue = string | number | null;
interface SecurityStatement {
  bind(...values: SqlValue[]): {
    run(): Promise<unknown>;
    all(): Promise<{ results?: Record<string, unknown>[] }>;
  };
}
export interface SecurityDatabase {
  prepare(query: string): SecurityStatement;
}

export interface VerifiedUser {
  uid: string;
  email: string | null;
  authTime: number;
}

export const JSON_BODY_LIMIT = 16 * 1024;
export const WEBHOOK_BODY_LIMIT = 64 * 1024;
export const SESSION_RETENTION_SECONDS = 30 * 24 * 60 * 60;
export const USER_REPORT_LIMIT = 100;
export const ADMIN_REPORT_LIMIT = 200;
export const ADMIN_AUTH_MAX_AGE_SECONDS = 600;

const KNOWN_ROUTES = new Set([
  '/api/entitlement',
  '/api/createOrder',
  '/api/verifyPayment',
  '/api/webhook',
  '/api/reviews',
  '/api/reviews/mine',
  '/api/reviews/delete',
  '/api/admin/reviews',
  '/api/admin/reviews/moderate',
  '/api/session',
  '/api/security-report',
  '/api/admin/security-report'
]);

export function routeName(pathname: string): string {
  return KNOWN_ROUTES.has(pathname) ? pathname : 'unknown';
}

export interface SecurityLogFields {
  requestId: string;
  route: string;
  status: number;
  outcome: 'accepted' | 'rejected';
}

// One structured line per request. Fixed fields only; route is forced through the
// allowlist so an attacker-chosen path is always logged as "unknown".
export function logSecurityRequest(fields: SecurityLogFields): void {
  console.info(JSON.stringify({
    type: 'security_request',
    request_id: fields.requestId,
    route: routeName(fields.route),
    status: fields.status,
    outcome: fields.outcome
  }));
}

// Record a verified session. uid and auth_time are signed Firebase claims — never
// client-supplied values. INSERT OR IGNORE plus the (uid, auth_time) primary key
// keeps repeated page loads and token refreshes from creating duplicates.
export async function recordVerifiedSession(db: SecurityDatabase, user: VerifiedUser): Promise<void> {
  await db.prepare('INSERT OR IGNORE INTO login_sessions (uid, auth_time, first_seen_at) VALUES (?, ?, unixepoch())')
    .bind(user.uid, user.authTime).run();
}

// The signed-in user's own sessions, newest first, capped and windowed.
// uid is the verified identity from the token, so ?uid= parameters are ignored.
export async function sessionReport(db: SecurityDatabase, uid: string): Promise<Record<string, unknown>[]> {
  const result = await db.prepare(`SELECT auth_time, first_seen_at FROM login_sessions
    WHERE uid = ? AND first_seen_at >= unixepoch() - ?
    ORDER BY first_seen_at DESC, auth_time DESC LIMIT ?`)
    .bind(uid, SESSION_RETENTION_SECONDS, USER_REPORT_LIMIT).all();
  return result.results || [];
}

// Allowlisted administrator report across accounts, capped and windowed.
export async function adminSessionReport(db: SecurityDatabase): Promise<Record<string, unknown>[]> {
  const result = await db.prepare(`SELECT uid, auth_time, first_seen_at FROM login_sessions
    WHERE first_seen_at >= unixepoch() - ?
    ORDER BY first_seen_at DESC, uid LIMIT ?`)
    .bind(SESSION_RETENTION_SECONDS, ADMIN_REPORT_LIMIT).all();
  return result.results || [];
}

// Daily retention: delete records first observed more than 30 days ago.
export async function pruneSessions(db: SecurityDatabase): Promise<void> {
  await db.prepare('DELETE FROM login_sessions WHERE first_seen_at < unixepoch() - ?')
    .bind(SESSION_RETENTION_SECONDS).run();
}

// Read the request body as exact bytes, refusing anything beyond maxBytes.
// Content-Length is rejected up front when it already exceeds the limit; the
// stream is still enforced chunk-by-chunk so missing or lying Content-Length
// headers cannot smuggle through. Oversized streams are cancelled, not buffered.
// The returned bytes are the exact bytes received, which keeps webhook HMAC
// signature verification byte-exact.
export async function readLimitedBytes(request: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const declared = request.headers.get('content-length');
  if (declared !== null) {
    const parsed = Number(declared);
    if (Number.isFinite(parsed) && parsed > maxBytes) return null;
  }
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
