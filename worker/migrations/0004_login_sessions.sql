-- 0004: additive login-session ledger (Workstream 3).
-- One row per (uid, auth_time): a Firebase session first observed by Clearcutt.
-- Repeated page loads and token refreshes carry the same signed auth_time, so the
-- composite primary key deduplicates them. Migrations 0001-0003 are untouched.
CREATE TABLE login_sessions (
  uid TEXT NOT NULL CHECK (length(uid) BETWEEN 1 AND 128),
  auth_time INTEGER NOT NULL,
  first_seen_at INTEGER NOT NULL,
  PRIMARY KEY (uid, auth_time)
);
CREATE INDEX login_sessions_seen ON login_sessions(first_seen_at);
