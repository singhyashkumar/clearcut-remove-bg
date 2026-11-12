const ROUTES = new Set(['/api/entitlement','/api/createOrder','/api/verifyPayment','/api/webhook','/api/session','/api/security-report','/api/admin/security-report']);
export const routeName = path => ROUTES.has(path) ? path : 'unknown';

// Deliberately accept only fixed fields. Never pass request headers, bodies,
// token claims, provider errors, email addresses, IPs or query strings here.
export function logSecurityRequest({requestId, route, status, outcome}) {
 console.info(JSON.stringify({type:'security_request',request_id:requestId,route:routeName(route),status,outcome}));
}

export async function recordVerifiedSession(db, user) {
 // authTime is signed by Firebase. Refreshes/reloads do not invent new logins.
 await db.prepare(`INSERT OR IGNORE INTO login_sessions (uid, auth_time, first_seen_at)
   VALUES (?, ?, unixepoch())`).bind(user.uid,user.authTime).run();
}

export async function sessionReport(db, uid) {
 const result=await db.prepare(`SELECT auth_time, first_seen_at FROM login_sessions
   WHERE uid = ? AND first_seen_at >= unixepoch() - 2592000
   ORDER BY first_seen_at DESC, auth_time DESC LIMIT 100`).bind(uid).all();
 return result.results;
}

export async function adminSessionReport(db) {
 const result=await db.prepare(`SELECT uid, auth_time, first_seen_at FROM login_sessions
   WHERE first_seen_at >= unixepoch() - 2592000
   ORDER BY first_seen_at DESC, uid LIMIT 200`).bind().all();
 return result.results;
}

export async function pruneSessions(db) {
 await db.prepare('DELETE FROM login_sessions WHERE first_seen_at < unixepoch() - 2592000').bind().run();
}

// Bound bytes as they arrive, including chunked bodies without Content-Length.
export async function readLimitedText(request, maxBytes) {
 const declared=request.headers.get('content-length');
 if(declared && Number(declared)>maxBytes) return null;
 if(!request.body) return '';
 const reader=request.body.getReader(), decoder=new TextDecoder();
 let bytes=0, text='';
 try {
  while(true) {
   const {done,value}=await reader.read();
   if(done) return text+decoder.decode();
   bytes+=value.byteLength;
   if(bytes>maxBytes){await reader.cancel();return null;}
   text+=decoder.decode(value,{stream:true});
  }
 } finally {reader.releaseLock();}
}
