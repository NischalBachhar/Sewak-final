# Rollback and retention

## Cloudflare-only recovery (2026-09-29)

D1 is authoritative. The user explicitly authorized retiring care-53593 after Cloudflare-only verification and private backup inventory. Historical Firebase commands below are archived context, not executable recovery instructions. Do not restore Firebase dependencies, unfreeze the source, create signing credentials or compare application records with Firebase again.

For a Cloudflare incident, close application writes in wrangler.production.toml, use the guarded maintenance deployment, and securely export both current D1 databases before investigating. Preserve current D1 accounts, password hashes, sessions and application writes; historical Firebase exports cannot recover them. Worker version rollback does not roll back D1 schema or data. Do not delete databases as routine recovery.

Private snapshots, raw exports, rules manifests and SQL backups remain outside Git. Staging uses separate staging databases; production uses sewak-db and sewak-media. Current deployment and retirement receipts are summarized in FIREBASE_TO_D1_MIGRATION.md.

## Historical Firebase-Auth rollback reference (superseded)

Firebase data, Auth identities and Storage originals remain intact. Keep immutable initial/final exports, typed raw backups, image reports, Cloudflare IDs, the old frontend release and live rules manifest privately. Never commit those records or credentials.

The existing frontend is the `sewak-final` Worker at `https://sewak-final.nischalbachhar9.workers.dev`. Its pre-migration deployment metadata is saved in `.local-tools/d1-migration/cloudflare-existing-host.json`; the observed version was `8dc54932-f57a-4808-9b51-e4b7e08b1e52`. Staging uses `sewak` without overwriting this frontend. Final deployment explicitly targets `sewak-final`; preserve the recorded old version for frontend recovery, subject to the data restrictions below. Do not assume a Worker rollback reverses D1 or Auth changes.

Before D1 writes open, leave `APP_WRITES_ENABLED="false"` if any check fails. Repair and rerun; unchanged document hashes resume, while unrelated/edited D1 rows are refused. Do not delete databases as routine recovery. If source rules were frozen, restore their backed-up live release:

```powershell
node scripts/firebase-to-d1/freeze.mjs --project care-53593 --restore --output .local-tools/d1-migration/freeze-new
```

Use the actual applied manifest directory. This restores ruleset references, not data, and refuses unrelated rule changes. Return traffic to the retained Firebase frontend if necessary. Auth needs no credential migration. Remove temporary migration secrets and retain D1 for diagnosis.

**After D1 accepts writes, the old Firebase copy is stale.** Close D1 writes, securely export both databases and new image binaries, and reconcile all post-cutover users/bookings/care/tasks/reviews/reports/roles/media before reopening a rollback destination. There is no automated reverse sync or instant data rollback. A Worker version rollback does not roll back databases or Auth changes. Preserve new data before reverting schemas.

Auth setup records dedicated account/role/key resource metadata in `.local-tools/d1-migration/auth-admin-sewak.json` for staging and `auth-admin-sewak-final.json` for production, never the private key. Each target receives its own key for the same narrowly scoped identity. Rotate by installing/verifying a new dedicated key, then deleting only the prior recorded key. Do not delete the project's existing firebase-adminsdk identity or unrelated keys/roles. Review provisioning journals before reversing an account the user may have started using.

Staging Auth setup succeeded on 2026-09-22T16:36:06Z. Its active key metadata is recorded in `.local-tools/d1-migration/auth-admin-sewak.json`, and both staging Auth secret names were verified. Do not delete that installed credential during QA or policy restoration. Restore the temporary project key-creation exception only after the required production credentials are installed and verified. Keep all earlier failed-attempt reports as historical evidence.

The first temporary QA key was deleted on 2026-09-23T03:48:58.983Z after a runner failure, and independently verified absent at 03:49:48.709Z. The separately authorized replacement key passed fresh four-role staging QA, was deleted at 09:58:11.066Z, and independently verified absent at 09:58:23.153Z. Both one-shot authorizations are consumed; do not create another temporary QA key. The installed staging credential remains intact.

The source freeze **is now applied**: `freeze-new/manifest.json` records frozen ruleset `7dcc230e-50e7-46ce-b6ec-70ac4aface6d`, released 2026-09-23T15:02:27.921455Z. The final snapshot and exact remote validation contain 18 application records / 8 Auth identities, no final delta, and no media. Private pre-cutover D1 SQL backups are `.local-tools/cutover-2026-09-23-media-boundary/precutover-main.sql` and `precutover-media.sql`; checksums and original production version metadata are preserved alongside them. On September 28, the unchanged source/data/key/deployment checkpoint was reverified before production maintenance version `c8301254-32ef-4ddf-b154-79c2d06012d9` was deployed. Production writes remain disabled at this checkpoint. Consult the main migration runbook for subsequent activation and smoke-test results before performing any rollback.

The Shoe Doctor account received no Sewak resources, migration, secret or deployment; nothing there needs deletion. Any later cleanup must identify exact Sewak IDs and backups before deleting, preserving unrelated Shoe Doctor resources.

## September 28 containment checkpoint

Production Auth is installed and verified; the secure inherited key-creation restriction is restored. Both installed Worker credentials must be retained. The final write-enabled release briefly ran one controlled inactive-service test. Its API write/read succeeded, but a runner query used an invalid limit and stopped the test. The synthetic row was removed with exact identity/version/reference guards, leaving its legitimate audit record. Production was returned to read-only version `c896825e-ae34-4527-8254-8f50d346663a`; Firestore remains frozen. Do not treat this as a completed cutover or discard the additional audit evidence. Completing the corrected authenticated smoke test requires a new authorized sign-in path; do not create another temporary key under the consumed approval.

## September 28 keyless signing cleanup

The approved signing attempt returned 403 before issuing a token or opening production writes. Its sole temporary service-account binding was removed at 14:38:22.692Z, the custom role was deleted at 14:38:25.093Z, and IAM Credentials API returned to DISABLED at 14:38:29.971Z. Independent verification confirmed all cleanup and no key-set or key-creation-policy changes. A later retry was rejected by automatic approval review and never ran. Production remains on the read-only containment version above, with the original 18 application records and only the earlier smoke audit row. All source freezes and rollback backups remain intact. Do not reopen source writes or delete installed Worker credentials to work around this access blocker.

## Single signing verification cleanup - 2026-09-28

The one authorized signing retry returned HTTP 200 at 2026-09-28T14:58:10.555Z. Its token was discarded without Firebase sign-in or data writes. Temporary role deletion completed at 2026-09-28T14:58:15.572Z; independent cleanup passed at 2026-09-28T14:59:29.904Z, including absent signing permission, disabled IAM Credentials API, unchanged installed keys and enforced key-creation restriction. Production and staging remain read-only. No deployment/data rollback was needed, and all earlier rollback materials remain preserved. This signing authorization is consumed.
