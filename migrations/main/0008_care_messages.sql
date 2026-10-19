-- Private messages scoped to existing bookings or job applications.
CREATE TABLE IF NOT EXISTS care_messages(
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('booking','job')),
 context_id TEXT NOT NULL,
 customer_id TEXT NOT NULL REFERENCES users(id),
 caregiver_id TEXT NOT NULL REFERENCES caregivers(id),
 sender_id TEXT NOT NULL REFERENCES users(id),
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 1500),
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS care_message_conversation ON care_messages(kind,context_id,caregiver_id,created_at DESC,id);
CREATE INDEX IF NOT EXISTS care_message_sender_limit ON care_messages(sender_id,created_at DESC);
