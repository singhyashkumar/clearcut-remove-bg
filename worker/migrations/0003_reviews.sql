CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 2 AND 50),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 20 AND 1000),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER,
  moderated_at INTEGER,
  moderated_by TEXT
);

CREATE INDEX reviews_status_published ON reviews(status, published_at DESC);

CREATE TABLE review_moderation_audit (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL,
  moderator_uid TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('approved', 'rejected')),
  reason TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX review_audit_review_created ON review_moderation_audit(review_id, created_at DESC);
