CREATE TABLE login_sessions (
  uid TEXT NOT NULL CHECK (length(uid) BETWEEN 1 AND 128),
  auth_time INTEGER NOT NULL,
  first_seen_at INTEGER NOT NULL,
  PRIMARY KEY (uid, auth_time)
);
CREATE INDEX login_sessions_seen ON login_sessions(first_seen_at);
