-- New application identities only. Never import/adopt Firebase dummy accounts.
CREATE TABLE cf_credentials (
 user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id),
 email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT,
 disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1)),
 credential_version INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL,
 password_changed_at INTEGER
);
CREATE TABLE cf_sessions (
 id TEXT PRIMARY KEY NOT NULL,
 token_hash TEXT UNIQUE NOT NULL,
 user_id TEXT NOT NULL REFERENCES cf_credentials(user_id) ON DELETE CASCADE,
 audience TEXT NOT NULL,
 transport TEXT NOT NULL CHECK(transport IN ('cookie','bearer')),
 credential_version INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 last_seen_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX cf_sessions_user ON cf_sessions(user_id);
CREATE INDEX cf_sessions_expiry ON cf_sessions(expires_at);
CREATE TABLE cf_auth_limits (bucket TEXT PRIMARY KEY NOT NULL, hits INTEGER NOT NULL, reset_at INTEGER NOT NULL);
CREATE INDEX cf_auth_limits_expiry ON cf_auth_limits(reset_at);
CREATE TABLE cf_invitations (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES cf_credentials(user_id) ON DELETE CASCADE,
 token_hash TEXT UNIQUE NOT NULL,
 expires_at INTEGER NOT NULL,
 purpose TEXT NOT NULL DEFAULT 'activate' CHECK(purpose IN ('activate','recover')),
 credential_version INTEGER NOT NULL DEFAULT 1,
 used_at INTEGER,
 created_by TEXT NOT NULL
);
CREATE INDEX cf_invitations_user ON cf_invitations(user_id);
CREATE TABLE cf_bootstrap (
 id INTEGER PRIMARY KEY CHECK(id=1),
 email TEXT NOT NULL,
 token_hash TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 used_at INTEGER
);
