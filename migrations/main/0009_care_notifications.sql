-- In-app marketplace notifications: no PHI or private contact fields.
-- Event IDs are deterministic, making a retried booking mutation idempotent.
CREATE TABLE IF NOT EXISTS care_notifications (
  id TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,
  context_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 300),
  link TEXT NOT NULL CHECK(length(link) BETWEEN 1 AND 300),
  created_at TEXT NOT NULL,
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS care_notifications_recipient ON care_notifications(recipient_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS care_notifications_unread ON care_notifications(recipient_id,read_at,created_at DESC);
