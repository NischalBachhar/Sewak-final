# Sewak deployment safeguards

Production is `sewak-final` in account `860970f755498a4fe10e16c2fa99ce55`. Use `wrangler.production.toml`, `sewak-db`, `sewak-media`, and audience `sewak-production`. Staging is `sewak`, uses `wrangler.toml`, isolated `sewak-staging-*` databases, audience `sewak-staging`, and stays read-only. Never rename the staging deployment to production with `--name`.

The guarded operator validates exact Worker, account, both D1 names and IDs, audience, and write mode before any network mutation. Unsupported/duplicate arguments and environment/CI overrides fail closed. After upload it checks current settings and the active 100% deployment's version bindings. A name match alone is insufficient.

Build and dry-run from the repository root (PowerShell uses `npm.cmd`):

```powershell
$env:CLOUDFLARE_ACCOUNT_ID='860970f755498a4fe10e16c2fa99ce55'
npm.cmd run build:release
node scripts/scan-release.mjs
npm.cmd run deploy:cloudflare -- --worker sewak-final --dry-run
```

For an authorized maintenance deployment, supply current passing reconciliation and Auth evidence:

```powershell
npm.cmd run deploy:cloudflare -- --worker sewak-final --cutover-maintenance --source-frozen --validation PATH_TO_PASSING_RECONCILIATION --auth-qa PATH_TO_PASSING_AUTH_QA --free-plan-confirmed
```

`APP_WRITES_ENABLED` must be `false` in the production config for maintenance. Enable it only after the production read-only gates and original-source reconciliation pass, the deployment path is controlled, and the existing cutover authorization applies. Write-enabled deployment requires production Auth QA. Never reuse a report from a superseded or drifted deployment as current verification. Preserve all snapshots and rollback materials.

`npm --prefix worker run deploy` now calls the same gated operator; `npm run dev:worker` selects only the local staging configuration. Both Wrangler configs require the reviewed entry point for their custom build. Do not manually set `SEWAK_REVIEWED_TARGET` to circumvent it. Direct/raw Wrangler commands intentionally fail; use the guarded `--dry-run` for packaging checks.

Automatic Workers Builds are currently unsupported because production QA/reconciliation evidence is held by the operator. Both normal and release frontend builds reject Workers CI, and the deploy operator rejects CI Worker name overrides and connected-build environments. Cloudflare documents that [Workers Builds does not honor Wrangler custom build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), so the custom-build guard alone is not a complete CI control. Disable the production connected-build trigger in the Cloudflare dashboard before pushing this recovery change or reopening production writes. Also stop/cancel queued jobs from old commits. Record its actual build/deploy commands; configure future CI only after equivalent per-environment checks are designed.

The installed Wrangler code permits `WRANGLER_CI_OVERRIDE_NAME` to replace the config's Worker name without changing its bindings. This is a demonstrated mechanism capable of deploying the staging config to production, not proof that it initiated the September 29 incident. The current OAuth login cannot read Builds triggers/history (403), so the exact external invocation remains unverified. The earliest retained wrong-config version is recorded in `FIREBASE_TO_D1_MIGRATION.md`.

These controls prevent accidental misuse of this checkout's supported paths. They cannot restrict an owner using an older checkout, custom tooling, or direct Cloudflare APIs. Remote trigger control is required as well as repository guards. Do not remove Firebase users, keys or secrets until stable production is independently verified and the final retirement gate is current.
