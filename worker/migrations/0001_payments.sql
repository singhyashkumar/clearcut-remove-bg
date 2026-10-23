CREATE TABLE orders (
  order_id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise >= 100),
  currency TEXT NOT NULL CHECK (currency = 'INR'),
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid')),
  payment_id TEXT,
  created_at INTEGER NOT NULL,
  entitlement_extended_at INTEGER
);

CREATE INDEX orders_uid_created ON orders(uid, created_at);

CREATE TABLE entitlements (
  uid TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  daily_limit INTEGER NOT NULL,
  batch_limit INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE webhook_events (
  event_id TEXT PRIMARY KEY,
  received_at INTEGER NOT NULL
);
