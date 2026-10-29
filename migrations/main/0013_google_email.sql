-- Additive: existing passwords, roles, sessions and care records are preserved.
ALTER TABLE cf_credentials ADD COLUMN email_verified_at INTEGER;
ALTER TABLE cf_credentials ADD COLUMN google_sub TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS cf_credentials_google ON cf_credentials(google_sub) WHERE google_sub IS NOT NULL;
CREATE TABLE IF NOT EXISTS cf_google_states (
 token_hash TEXT PRIMARY KEY NOT NULL,
 verifier TEXT NOT NULL,
 nonce TEXT NOT NULL,
 audience TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 link_user_id TEXT,
 credential_version INTEGER
);
CREATE TABLE IF NOT EXISTS cf_email_tokens (
 token_hash TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES cf_credentials(user_id) ON DELETE CASCADE,
 purpose TEXT NOT NULL CHECK(purpose IN ('verify','reset')),
 credential_version INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 used_at INTEGER
);
CREATE INDEX IF NOT EXISTS cf_email_tokens_user ON cf_email_tokens(user_id,purpose);
ALTER TABLE care_notification_preferences ADD COLUMN email_updates INTEGER NOT NULL DEFAULT 0 CHECK(email_updates IN (0,1));
ALTER TABLE care_notification_preferences ADD COLUMN email_enabled_at TEXT;
CREATE TABLE IF NOT EXISTS care_email_deliveries (
 notification_id TEXT PRIMARY KEY NOT NULL REFERENCES care_notifications(id) ON DELETE CASCADE,
 attempts INTEGER NOT NULL DEFAULT 0,
 retry_at INTEGER NOT NULL DEFAULT 0,
 accepted_at INTEGER,
 failed_at INTEGER
);
