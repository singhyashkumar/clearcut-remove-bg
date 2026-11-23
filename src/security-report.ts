// Account security: login-session reporting UI (Workstream 3 frontend).
//
// All security requests go to the dedicated security API base URL variable —
// deliberately separate from the payment API base URL and untouched payment
// flow. When that variable is unset the whole integration stays disabled and
// the application behaves exactly as before. The backend remains the sole
// authority: administrator UID allowlists, credentials and tokens never live in
// frontend code, Vite variables or public configuration, and the administrator
// section is rendered only after a successful (HTTP 200) backend authorization.

export type SecurityUser = { uid?: string | null } | null;
export type SessionEntry = { auth_time: number; first_seen_at: number };
export type AdminSessionEntry = SessionEntry & { uid: string };

type FetchLike = (input: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface AccountSecurityController {
  handleUser(user: SecurityUser): void;
  setOpen(open: boolean): void;
  readonly disabled: boolean;
}

export const SECURITY_EXPLANATION =
  'Login activity shows Google authentication sessions first observed by Clearcutt. It is not a complete inventory of every Google account sign-in or device.';
const DEFAULT_RETENTION_DAYS = 30;

// UIDs are shown masked in the interface; the full value never reaches the DOM.
export function maskUid(uid: string): string {
  const value = typeof uid === 'string' ? uid : '';
  if (!value) return 'unknown';
  if (value.length <= 8) return `${value.slice(0, 2)}…`;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

// Timestamps are rendered in the user's local timezone.
export function formatTimestamp(seconds: number): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return '';
  return new Date(seconds * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

async function defaultGetToken(): Promise<string> {
  const { getGoogleAuthToken } = await import('./firebase-auth.ts');
  return getGoogleAuthToken();
}

export function initAccountSecurity(doc: Document, {
  apiBase = (import.meta.env?.VITE_SECURITY_API_BASE_URL || '').replace(/\/$/, ''),
  fetchImpl,
  getToken = defaultGetToken
}: {
  apiBase?: string;
  fetchImpl?: FetchLike;
  getToken?: () => Promise<string>;
} = {}): AccountSecurityController | null {
  const section = doc.getElementById('account-security');
  const toggle = doc.getElementById('security-toggle');
  const status = doc.getElementById('security-status');
  const list = doc.getElementById('security-sessions');
  const emptyNote = doc.getElementById('security-empty');
  const admin = doc.getElementById('security-admin');
  const adminList = doc.getElementById('security-admin-list');
  const adminStatus = doc.getElementById('security-admin-status');
  const retention = doc.getElementById('security-retention');
  if (!section || !toggle || !status || !list || !emptyNote || !admin || !adminList || !adminStatus || !retention) return null;
  // Non-null aliases: the closures below outlive the compiler's narrowing.
  const panel: HTMLElement = section;
  const toggleButton: HTMLElement = toggle;
  const statusLine: HTMLElement = status;
  const listRef: HTMLElement = list;
  const emptyNoteRef: HTMLElement = emptyNote;
  const adminRef: HTMLElement = admin;
  const adminListRef: HTMLElement = adminList;
  const adminStatusRef: HTMLElement = adminStatus;
  const retentionRef: HTMLElement = retention;

  const doFetch: FetchLike = fetchImpl ?? ((input, init) => fetch(input, init));
  const disabled = !apiBase;
  let open = false, generation = 0, recordedUid: string | null = null;
  let recording: AbortController | null = null, loading: AbortController | null = null;
  toggleButton.hidden = disabled;
  if (disabled) return { handleUser() {}, setOpen() {}, disabled };

  // Closing the panel only stops report rendering; the independent session
  // recording keeps running. A genuine identity change aborts everything.
  const abortLoading = () => { loading?.abort(); loading = null; };
  const abortAll = () => {
    recording?.abort();
    loading?.abort();
    recording = loading = null;
  };
  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
  const clearPanel = (message: string) => {
    listRef.replaceChildren();
    adminListRef.replaceChildren();
    adminRef.hidden = true;
    emptyNoteRef.hidden = true;
    statusLine.textContent = message;
  };
  const isStale = (revision: number) => revision !== generation;

  // One best-effort POST per authentication session; the backend deduplicates
  // repeated page loads and token refreshes by (uid, auth_time).
  async function recordSession(revision: number) {
    const request = new AbortController();
    recording?.abort();
    recording = request;
    try {
      const token = await getToken();
      if (isStale(revision) || request.signal.aborted) return;
      await doFetch(`${apiBase}/api/session`, { method: 'POST', headers: bearer(token), signal: request.signal });
    } catch { /* Network failures are non-fatal; the next sign-in records again. */ }
    finally { if (recording === request) recording = null; }
  }

  function sessionRow(entry: SessionEntry, uid: string | null) {
    const row = doc.createElement('li');
    row.className = 'security-session';
    if (uid !== null) {
      const who = doc.createElement('span');
      who.className = 'security-uid';
      who.append('Account ');
      const code = doc.createElement('code');
      code.textContent = maskUid(uid);
      who.append(code);
      row.append(who);
    }
    for (const [label, seconds] of [['Authenticated', entry.auth_time], ['First observed by Clearcutt', entry.first_seen_at]] as const) {
      const line = doc.createElement('span');
      line.className = 'security-when';
      line.append(`${label} `);
      const time = doc.createElement('time');
      const date = new Date(Number(seconds) * 1000);
      time.dateTime = date.toISOString();
      time.textContent = formatTimestamp(Number(seconds));
      line.append(time);
      row.append(line);
    }
    return row;
  }

  function renderPersonal(data: { sessions?: SessionEntry[] } | null) {
    const sessions = Array.isArray(data?.sessions)
      ? data!.sessions.filter(entry => entry && Number.isFinite(Number(entry.first_seen_at)) && Number(entry.first_seen_at) > 0)
      : [];
    listRef.replaceChildren();
    for (const entry of sessions) listRef.append(sessionRow(entry, null));
    if (sessions.length) {
      emptyNoteRef.hidden = true;
      statusLine.textContent = `${sessions.length} session${sessions.length === 1 ? '' : 's'} in the last 30 days.`;
    } else {
      emptyNoteRef.hidden = false;
      statusLine.textContent = '';
    }
  }

  function renderAdmin(sessions: AdminSessionEntry[], retentionDays: number) {
    adminRef.hidden = false;
    adminListRef.replaceChildren();
    let shown = 0;
    for (const entry of Array.isArray(sessions) ? sessions : []) {
      if (!entry || !Number.isFinite(Number(entry.first_seen_at)) || Number(entry.first_seen_at) <= 0) continue;
      adminListRef.append(sessionRow(entry, typeof entry.uid === 'string' && entry.uid ? entry.uid : ''));
      shown++;
    }
    adminStatusRef.textContent = `${shown} session${shown === 1 ? '' : 's'} across accounts · kept for ${retentionDays} days.`;
  }

  function renderLoadFailure(responseStatus: number) {
    listRef.replaceChildren();
    adminListRef.replaceChildren();
    adminRef.hidden = true;
    emptyNoteRef.hidden = true;
    statusLine.textContent = responseStatus === 401
      ? 'Your Google session expired. Sign in again to see your login activity.'
      : 'Login activity is temporarily unavailable. Reopen Account security to try again.';
  }

  // The personal report is the primary content and must survive administrator
  // endpoint failures: the two requests settle independently. The administrator
  // section renders only on HTTP 200; a 403 (ordinary user) or any
  // administrator-side failure simply leaves the section hidden.
  async function loadReports(revision: number) {
    const request = new AbortController();
    loading?.abort();
    loading = request;
    clearPanel('Loading login activity…');
    try {
      const token = await getToken();
      if (isStale(revision)) return;
      const [personalResult, adminResult] = await Promise.allSettled([
        doFetch(`${apiBase}/api/security-report`, { headers: bearer(token), signal: request.signal }),
        doFetch(`${apiBase}/api/admin/security-report`, { headers: bearer(token), signal: request.signal })
      ]);
      if (isStale(revision)) return;
      if (personalResult.status === 'rejected') {
        if (personalResult.reason instanceof Error && personalResult.reason.name === 'AbortError') return;
        statusLine.textContent = 'Could not load login activity. Reopen Account security to try again.';
        listRef.replaceChildren();
        emptyNoteRef.hidden = true;
        adminRef.hidden = true;
        return;
      }
      const personal = personalResult.value;
      if (!personal.ok) { renderLoadFailure(personal.status); return; }
      const personalData = await personal.json().catch(() => null) as { sessions?: SessionEntry[]; retention_days?: number } | null;
      if (isStale(revision)) return;
      renderPersonal(personalData);
      const retentionDays = Number(personalData?.retention_days) || DEFAULT_RETENTION_DAYS;
      retentionRef.textContent = `Login activity is kept for ${retentionDays} days.`;
      if (adminResult.status === 'fulfilled' && adminResult.value.status === 200) {
        const adminData = await adminResult.value.json().catch(() => null) as { sessions?: AdminSessionEntry[] } | null;
        if (isStale(revision)) return;
        renderAdmin(adminData?.sessions ?? [], retentionDays);
      } else {
        adminRef.hidden = true;
        adminListRef.replaceChildren();
      }
    } catch (error) {
      if (isStale(revision) || (error instanceof Error && error.name === 'AbortError')) return;
      statusLine.textContent = 'Could not load login activity. Reopen Account security to try again.';
      listRef.replaceChildren();
      emptyNoteRef.hidden = true;
      adminRef.hidden = true;
    } finally { if (loading === request) loading = null; }
  }

  // Auth-state notifications arrive repeatedly for the same account (page
  // loads, token refreshes, focus events). Only a genuine identity change —
  // including sign-out — bumps the generation and aborts in-flight work. A
  // repeated notification for the current account returns early so it can
  // never cancel a pending recording or report request, and the generation
  // bump on a real change keeps stale responses from rendering.
  function handleUser(user: SecurityUser) {
    const uid = typeof user?.uid === 'string' && user.uid ? user.uid : null;
    if (uid === recordedUid) return;
    generation++;
    abortAll();
    if (!uid) {
      // Sign-out: clear every piece of displayed security data.
      recordedUid = null;
      open = false;
      panel.hidden = true;
      toggleButton.setAttribute('aria-expanded', 'false');
      clearPanel('');
      return;
    }
    // One recording per authentication session; the backend deduplicates
    // repeated page loads and token refreshes by (uid, auth_time).
    recordedUid = uid;
    void recordSession(generation);
    // An open panel belongs to the previous account: reload for the new one.
    if (open) void loadReports(generation);
  }

  function setOpen(next: boolean) {
    if (disabled || next === open) return;
    open = next;
    toggleButton.setAttribute('aria-expanded', String(next));
    panel.hidden = !next;
    if (next) void loadReports(generation);
    else abortLoading();
  }

  toggleButton.addEventListener('click', () => setOpen(!open));
  return { handleUser, setOpen, disabled };
}
