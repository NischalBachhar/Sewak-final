# Profile image pipeline

The live initial export has zero user/vendor/Auth photo references; migrated/failed counts are zero and source/output averages are not applicable. No Storage original was deleted or bulk-enumerated.

The browser accepts JPEG/WebP/PNG source files up to 10 MiB. createImageBitmap handles orientation; Canvas fits inside 512 x 512 without enlarging, flattens white, and encodes WebP with JPEG fallback. A binary container pass removes browser-added ICC/EXIF/XMP metadata and updates WebP lengths/flags. Quality steps target at most 150,000 bytes and enforce a hard 200,000-byte ceiling. Small results are not padded to 50 KB. Source pixel budget is 40 million. Previews use revocable object URLs.

`PUT /api/profiles/:uid/image` sends raw bytes, image MIME and a Cloudflare cookie/CSRF or opaque Bearer session. The Worker independently verifies owner/admin/owning-organization permission, active state, streamed size, MIME, WebP/JPEG container/frame structure and dimensions. It rejects unsupported content, animation, metadata attachment chunks, truncation, extra trailing content and oversized files/dimensions. SQL repeats binary/type/size/dimension checks. This is a bounded structure parser, not a full entropy decoder or antivirus scanner: some corrupt compressed streams may pass structure checks and fail display. Browser/offline processing fully decodes the source; the display fallback handles failures. Paid image processing is absent.

Customer profile, caregiver profile and authorized caregiver editor use the same API. Serving fetches binary data and creates disposable object URLs. `DELETE /api/profiles/:uid/image` checks the same owner permissions. General files and private verification documents are not accepted.

## Media read status contract

`GET /api/media/:id` requires the `profile_` ID prefix and a maximum length of 160 characters. Malformed IDs return 400. For syntactically valid IDs, authorization is checked before existence: anonymous or unauthorized requests for private/missing images return 403, preventing an existence oracle. An authorized owner or administrator receives 404 when its profile link or media row is absent. An available public image, or an authorized private image, returns 200 with binary content, image MIME type, `nosniff`, ETag and appropriate cache headers. The application does not explicitly set Content-Length; transport length handling belongs to the runtime, and the Node test harness does not expose it automatically. Verify the actual bytes rather than requiring that header in the Node harness. Do not weaken the authorization order to make an anonymous missing-image probe return 404.

Regression tests cover these cases separately using isolated SQLite/Miniflare fixtures. Staging currently contains no media, so its successful existing-image case is not applicable; no remote fixture should be inserted to satisfy QA.

## Browser byte-validation boundary

The isolated browser test identifies each successful media response with a random test-only response header. The local server buffers the real Worker response and records its length and SHA-256 before sending it. Test instrumentation observes the Blob returned by the application's own `Response.blob()` call, reads that Blob's ArrayBuffer, and correlates the same Blob with the application's `URL.createObjectURL()` call. It returns the original Blob and original object URL without replacing content or refetching a blob URL. These observation headers and instrumentation are confined to the guarded demo server and browser tests.

On 2026-09-23, request `9218e91a-9a4f-4b7c-8a2a-c39805901bf4` returned authenticated HTTP 200 / image/webp. Both the server and the application received **360 bytes**, with SHA-256 `860d9e2fe7259a7eea98254436fd7af50d3bf0fcdff566c20e1cb29adac07385`. Playwright `response.body()` captured **0 bytes**, while the saved trace recorded `bodySize: 372` and captured-content size 0. Thus the empty capture was not an empty application response. Transfer accounting and decoded payload length are separate measurements; the 372-byte trace figure is not substituted for the image length.

Inspection of installed Playwright 1.63.0's Chromium `createResponseBodyCallback` shows it uses DevTools `Network.getResponseBody`. When that returns empty and Content-Length is absent, it directly returns an empty Buffer; its refetch fallback is also restricted to selected resource types, excluding ordinary fetch requests. The precise upstream Chromium reason for omitting this body is not established, and no general browser defect is claimed. Reproduction in the focused journey excludes unrelated tests' route interception. Awaiting `response.finished()` and buffering the isolated server response before sending headers did not change the result.

The required assertions therefore use the closest reliable boundary actually consumed by the app: that exact Blob/ArrayBuffer before object-URL creation. They require nonempty bounded bytes, equality with upload size, equality of server and application SHA-256, successful independent image decoding, visible image rendering, matching positive natural dimensions, and a blob object URL. HTTP 200, image MIME, bearer authentication and private-image rejection are checked separately. Playwright capture and network sizes remain diagnostics; nonempty Playwright captures must also exactly match the app bytes. CSP is unchanged, Content-Length is not required, and no test-only blob fetch is performed. Diagnostic evidence is preserved under `.local-tools/cutover-2026-09-23-media-boundary/`.

## Existing photos

`scripts/firebase-to-d1/images.mjs` discovers profilePicture/profileImage/photoURL/photoUrl/image on users/vendors, and Auth photoURL when the database has no current photo. Conflicting aliases or Auth photos without a structured owner fail explicitly. Downloads allow only HTTPS Firebase Storage URLs in the selected project's profile_pictures path, reject credentials/ports/redirects and cap time/bytes. Unfamiliar origins require a reviewed mapping, never a wildcard. Signed source URLs are not logged.

Offline sharp decodes still JPEG/PNG/WebP, rotates, strips metadata, resizes and compresses under the same limits. Optional binary intermediates remain private under `.local-tools`. Main profile timestamps and source URLs/originals are preserved for rollback.

```powershell
# Dry run: download/compress/report without D1 writes
node scripts/firebase-to-d1/images.mjs --input .local-tools/d1-migration/firebase-final.json --report .local-tools/d1-migration/image-plan.json
# Local apply
node scripts/firebase-to-d1/images.mjs --input .local-tools/d1-migration/firebase-final.json --apply --report .local-tools/d1-migration/local-images.json
# Remote apply
node scripts/firebase-to-d1/images.mjs --input .local-tools/d1-migration/firebase-final.json --apply --origin '<reviewed HTTPS Worker origin>' --output .local-tools/d1-migration --report .local-tools/d1-migration/remote-images.json
```

Remote apply requires a random 32-byte-or-stronger Worker `MIGRATION_TOKEN` secret, the same operator `SEWAK_MIGRATION_TOKEN` environment value, `MIGRATION_ENABLED="true"`, and `APP_WRITES_ENABLED="false"`. Never put literal secrets in history or chat. The temporary endpoint only processes existing profile owners, not SQL/arbitrary records. Remove its secret/flag after reconciliation; opening app writes also makes it unavailable. No secret/endpoint is needed for the current zero-photo snapshot.

Reports contain discovered/migrated counts, owner-specific failure reasons, dimensions and average/largest output bytes, without binary content. Repeat main/media validation afterward. No tooling deletes Firebase originals; retention cleanup requires a separate reviewed decision after rollback needs end.
