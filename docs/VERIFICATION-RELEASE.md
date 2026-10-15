# Authorized verification release - 15 October 2026

The owner explicitly authorized commit, push and deployment after the initial local implementation checkpoint. The feature branch is `feature/sewak-secure-verification`; implementation commit `4b3d763f4b10022f8b85601111e1c37ae9cae36e` is pushed. The separate auth/notification checkout remains excluded and untouched.

## Infrastructure and safeguards

The owner reconfirmed Workers Free because OAuth cannot read billing subscriptions. The account had four D1 databases before this release and now has six. No billing plan was upgraded.

| Target | Evidence database | UUID | Application writes |
| --- | --- | --- | --- |
| Staging `sewak` | `sewak-staging-verification-evidence` | `c6eb1466-20fa-40ca-bf53-29d1b35cf0e8` | false, unchanged |
| Production `sewak-final` | `sewak-verification-evidence` | `591fe39d-688e-49b6-a3a0-015700c6c5d1` | true, unchanged |

MAIN migration `0006_secure_verification.sql` and EVIDENCE migration `0001_private_evidence.sql` were applied to both environments. Existing MAIN schemas predate Wrangler migration tracking: old migrations were not replayed or falsely marked as applied. Only the new MAIN migration was executed after checking schema prerequisites and absence of its tables, then recorded in `d1_migrations`. A production MAIN recovery bookmark was saved locally beforehand. Application/customer records were not rewritten by the migrations.

Each environment has its own `VERIFICATION_ENCRYPTION_KEY`. Plaintext keys were generated in memory and supplied to Wrangler through stdin, never printed or committed. Recovery copies are Windows DPAPI encrypted under the current Windows user in `.local-tools/*-verification-key.dpapi`. Preserve the Windows profile and transfer these keys securely to an owner-controlled password manager for portable recovery; DPAPI files alone are not portable backups.

Retention and background renewal default to 365 days, with eight active photos per caregiver. Maintenance is scheduled every 15 minutes and respects the unchanged write gate. Staging therefore remains read-only, including its scheduled handler.

Deployment guards now require exactly three independently pinned D1 databases. They preserve account, audience, Worker-name, CI-override, staging read-only, production evidence-age, exact version, authentication and cleanup checks. New pre-upload checks require the encryption secret and complete verification schema. Production integrity reports include EVIDENCE_DB; missing or failed evidence checks block release. Post-upload checks require the live evidence binding.

## Validation before production application deployment

- Initial implementation: 119 D1/Worker tests, 74 frontend tests, and all 82 distinct browser scenarios passed across the full/focused runs described in the implementation report.
- Release changes: full D1/Worker suite **122 passed, 0 failed**; subsequent targeted operator/readiness suite **26 passed, 0 failed**, including the additional secret/schema readiness test.
- Release build with the actual production canonical origin: passed.
- Guarded production dry-run: passed, 149.21 KiB Worker bundle / 37.34 KiB gzip.
- Credential/runtime scan: passed, zero private-credential matches and zero retired Firebase runtime references.
- Staging deployment: `c7865a83-99e2-49c2-aca9-dde1ad417338`, all three bindings verified, writes still false.
- Staging feature smoke: **6 HTTP checks passed**, caregiver/admin browser routes at 320/390/1440 pixels, zero page errors, cleanup and unchanged pre-existing application records verified.
- The first full staging Auth QA stopped on a 503 during failed-login attempt 8; cleanup passed. A separate ten-request diagnostic returned ten expected 401 responses with no logged failure categories. After the existing limiter expired, the complete rerun passed **56 checks**, including browser authentication and verified cleanup. No limiter was cleared or weakened.
- Production predeployment integrity: all three databases passed quick-check with zero foreign-key violations.
- Production predeployment authentication: **54 checks passed**, including real browser cookie login, restoration, role/CSRF/session checks and verified synthetic cleanup, against version `157906b9-e8fe-4cd0-83b4-51a01978774e` (the prior code with the newly installed secret).

## Dependency findings

The full audits are **not clean**: root has 100 findings (4 low, 17 moderate, 76 high, 3 critical); Worker tooling has four high findings. No finding was suppressed and no dependency was changed for this release.

[verification-release-audit.json](verification-release-audit.json) records the exact package versions, advisory IDs/ranges, inherited paths and release bundle hashes. All affected packages were absent from the 21 emitted browser/Worker source maps (144 source entries). The Worker tooling findings are sharp/libvips, undici, and the miniflare/wrangler paths that inherit them; these packages are not deployed runtime modules. Frontend findings are in the existing CRA/build/test/development-server toolchain, including the critical proxy-addr, shell-quote and websocket-driver findings. Builds use repository-owned inputs, not uploaded user documents; production uses the Worker and static assets, not the development server. Toolchain remediation remains outstanding and must be reassessed on dependency or build-boundary changes. This assessment does not label the installed toolchain vulnerability-free.

## Live verification procedure

`scripts/verify-caregiver-verification.mjs` requires the explicit `--apply-synthetic-qa` flag and a pinned target. Production fixtures use unique owner-controlled email aliases and unpublished, unavailable caregiver profiles. It checks all five synthetic approvals, encrypted image round-trips, unauthorized preview denial, stale decisions, evidence withdrawal, phone-change revocation and responsive dashboard views. No actual identity document, reference call or government match is claimed. Cleanup is restricted to this run's exact generated users and evidence IDs; original application/verification rows are compared by an in-memory hash and foreign keys are checked afterward. Full auth and data reports must be regenerated for the deployed version.

Production application deployment and final version-matched results are recorded in the completion update below.
