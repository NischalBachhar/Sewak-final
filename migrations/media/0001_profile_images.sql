CREATE TABLE media (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  owner_type TEXT NOT NULL CHECK(owner_type IN ('user','caregiver','admin')),
  media_type TEXT NOT NULL DEFAULT 'profile' CHECK(media_type = 'profile'),
  mime_type TEXT NOT NULL CHECK(mime_type IN ('image/webp','image/jpeg')),
  file_size INTEGER NOT NULL CHECK(file_size BETWEEN 1 AND 200000),
  width INTEGER NOT NULL CHECK(width BETWEEN 1 AND 512),
  height INTEGER NOT NULL CHECK(height BETWEEN 1 AND 512),
  data BLOB NOT NULL CHECK(typeof(data) = 'blob' AND length(data) = file_size),
  digest TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(owner_id,media_type)
);
CREATE INDEX idx_media_owner ON media(owner_id,owner_type);
