-- Demo-only plan preferences; no payment credentials, charges, or entitlements.
-- This data is not a paid subscription and must never gate booking or care.
CREATE TABLE IF NOT EXISTS care_membership_preferences (
  user_id TEXT NOT NULL PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'plus_preview')),
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS membership_preferences_tier ON care_membership_preferences(tier);
