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

For an authorized maintenance deployment, supply current Cloudflare-only D1 integrity and Auth evidence. D1 is authoritative; do not compare it with Firebase:

```powershell
node scripts/verify-cloudflare-data.mjs
npm.cmd run deploy:cloudflare -- --worker sewak-final --cutover-maintenance --validation .local-tools/cloudflare-auth/cloudflare-data-check.json --auth-qa PATH_TO_PASSING_AUTH_QA --free-plan-confirmed
```

`APP_WRITES_ENABLED` must be `false` in the production config for maintenance. Enable it only after production read-only Auth/security gates and Cloudflare D1 integrity pass, the deployment path is controlled, and release authorization applies. Write-enabled deployment requires production Auth QA. The old `--source-frozen` gate and source-comparison tooling are retired. Never reuse a report from a superseded or drifted deployment as current verification. Preserve private historical backups without restoring Firebase into the runtime.

`npm --prefix worker run deploy` now calls the same gated operator; `npm run dev:worker` selects only the local staging configuration. Both Wrangler configs require the reviewed entry point for their custom build. Do not manually set `SEWAK_REVIEWED_TARGET` to circumvent it. Direct/raw Wrangler commands intentionally fail; use the guarded `--dry-run` for packaging checks.

Automatic Workers Builds are currently unsupported because production Auth/D1 integrity evidence is held by the operator. Both normal and release frontend builds reject Workers CI, and the deploy operator rejects CI Worker name overrides and connected-build environments. Cloudflare documents that [Workers Builds does not honor Wrangler custom build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), so the custom-build guard alone is not a complete CI control. The owner disconnected the production Git integration. Keep it disconnected; configure future CI only after equivalent per-environment checks are designed.

The installed Wrangler code permits `WRANGLER_CI_OVERRIDE_NAME` to replace the config's Worker name without changing its bindings. This is a demonstrated mechanism capable of deploying the staging config to production, not proof that it initiated the September 29 incident. The current OAuth login cannot read Builds triggers/history (403), so the exact external invocation remains unverified. The earliest retained wrong-config version is recorded in `FIREBASE_TO_D1_MIGRATION.md`.

On September 29 the owner reported a connected `sewak-final` build for repository `NischalBachhar/Sewak-final`, branch `main`, root `/`, build command `npm run build`, deploy command `npx wrangler deploy`, and no configured build variables. This deploy command does not select `wrangler.production.toml` or invoke the guarded operator; the root default config is staging. The displayed build was labeled "Manually deployed." That label alone did not establish automatic-build status, and an empty user-defined build-variable list did not rule out platform-provided CI variables. Attribution of the individual historical uploads remains unverified.

The owner subsequently **confirmed disconnecting the Git repository from `sewak-final`**. This is owner-confirmed operational evidence, not an independent Builds API read. Keep Git builds disconnected. Publishing repository safeguards does not reconnect that integration. Production completed the new read-only QA gate and controlled write smoke. Application writes are enabled under the subsequent explicit cutover authorization. Do not assume disconnection grants permission to re-enable an automatic production pipeline.

These controls prevent accidental misuse of this checkout's supported paths. They cannot restrict an owner using an older checkout, custom tooling, or direct Cloudflare APIs. Remote trigger control is required as well as repository guards. Do not remove Firebase users, keys or secrets until stable production is independently verified and the final retirement gate is current.
