# Separate profile-image database

`MEDIA_DB` binds `sewak-media`. Application table `media` is defined in `migrations/media/0001_profile_images.sql`; remote setup also creates a schema journal. No structured app tables or arbitrary attachments belong here.

| Column | Constraint / meaning |
|---|---|
| id | Stable `profile_<application user ID>` primary key |
| owner_id | Required existing profile UID, validated in app |
| owner_type | user, caregiver or admin |
| media_type | profile only; unique owner/type pair |
| mime_type | image/webp or image/jpeg |
| file_size | 1–200,000 bytes |
| width, height | 1–512 pixels each |
| data | BLOB; typeof is blob and length equals file_size |
| digest | SHA-256 digest for ETag and consistency |
| created_at, updated_at | Media creation/replacement timestamps |

An owner/type index supports metadata checks. Main DB users/caregivers store `profile_image_id`; cross-database ownership/reference checks are in application/validation code, not SQL FKs. Upload binds ArrayBuffer; D1's returned byte array is converted to Uint8Array for the HTTP body. Actual workerd tests verify BLOB type/size and byte-for-byte serving. No image is persisted as base64, data URL, JSON or hexadecimal text.

Replacement upserts one stable owner row. Main linking uses optimistic guards; separate D1 databases cannot participate in one atomic transaction. Interrupted linking leaves at most one recoverable unlinked owner row, which validation reports. Deletion unlinks first and removes only the previous digest. Missing images fall back safely. Reconcile after interrupted operations.

Private user/admin images require authorization and use private, no-store. Public images require an approved active caregiver and active organization. Main visibility is checked before cache lookup; the public binary cache uses the current digest, 60-second TTL and ETag. A previously cached browser copy can remain visible for that TTL after unpublishing. Only a requested image selects `data`; lists and diagnostics read metadata.
