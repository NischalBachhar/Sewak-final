# Sewak

React customer, caregiver, organization-admin and superadmin application backed by Firebase Authentication and Cloud Firestore. The light theme and four-step cash booking flow are retained.

See [the implementation and verification report](docs/SEWAK-FIX-REPORT.md) for all 17 findings, schema compatibility, release order, rollback and remaining environment checks. Older audit files are historical snapshots, not current deployment instructions.

## Local verification

Use Node 20 (the Functions target), npm, Java 21+ for the Firestore emulator, and Chrome for browser journeys. Install with `npm ci` at the root and `npm --prefix functions ci`. On Windows use `npm.cmd`.

```powershell
npm.cmd run lint
npm.cmd run test:unit
npm.cmd run test:migration
node scripts/test-emulators.cjs
npm.cmd run test:browser
npm.cmd run build
```

The emulator runner pins `demo-sewak-test`, removes service-account credential configuration, and tests refuse other project/host combinations. `test:browser` builds a localhost-only demo bundle before running Chrome. Run the normal build afterward to replace that test bundle. Do not publish a demo build.

`npm start` uses the existing Firebase project unless `REACT_APP_USE_EMULATORS=true` is set. For local development with synthetic data, set that flag and start the demo emulators explicitly; do not use real customer records as fixtures. Local tests do not exercise deployed Functions transport or App Check issuance.

## Hosting and configuration

`firebase.json` declares Firebase Hosting from `build`, Firestore rules/indexes, Storage rules and Functions from `functions`. The client points at the existing Firebase project and calls Functions in `asia-south1`. A Cloudflare Pages frontend can serve the same static build: postbuild generates `_redirects` and private-route `_headers`. No Cloudflare Worker backend configuration is present. Actual provider-dashboard configuration has not been accessed or changed.

Set `REACT_APP_CANONICAL_ORIGIN` to the reviewed public HTTPS origin before a release build. Without it the build deliberately omits canonicals and sitemap URLs. Browser metadata is route-specific; the served SPA document has generic public metadata. Private routes receive HTTP noindex headers on the configured hosts. Individual caregiver social cards and true HTTP 404 responses require additional host rendering/routing work; client-side metadata alone does not provide these.

Set `REACT_APP_FIREBASE_APPCHECK_SITE_KEY` only to the configured public web App Check key. Privileged callables retain `enforceAppCheck: true`. Missing callable configuration fails closed. Never disable enforcement to bypass a failed operation.

Cash booking, review, reporter receipts and authorized service publication use strict Firestore rules and do not require introducing paid infrastructure. Privileged account provisioning/approval and automated public projections use the existing optional Functions integration. If that integration is unavailable on the trial project, those operations remain unavailable; there is no browser approval fallback. Online payments remain disabled.
