-- Retain imported Firebase Auth revocation state independently of document fields.
-- Passwords, credential hashes, salts and tokens are never copied.
CREATE TABLE auth_accounts (
 uid TEXT PRIMARY KEY NOT NULL,
 disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1)),
 valid_since INTEGER NOT NULL DEFAULT 0 CHECK(valid_since>=0),
 imported_at TEXT NOT NULL
);
