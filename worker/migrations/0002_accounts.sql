CREATE TABLE accounts (
  uid TEXT PRIMARY KEY,
  email TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  updated_at INTEGER NOT NULL
);
