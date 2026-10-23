# Sewak branding correction - 23 October 2026

Status: **branding correction deployed and verified on the actual live site; full post-deployment Auth QA pending its natural registration window**.

The caregiver and superadmin sidebar now displays **Sewak**. The earlier PR #51 changed the shared quick-action workspace label but missed a separate sidebar card whose brand text was split across nested JSX. PR #52 removes that remaining version number. Existing customer and organization quick-action labels remain **YOUR SEWAK WORKSPACE**. Source review and rendered-text checks found no remaining versioned brand labels. Internal component, CSS and asset identifiers remain stable.

- Deployed commit: `07f0d155028a90424f9999a9bd9c9feda84c773b` ([PR #52](https://github.com/NischalBachhar/Sewak-final/pull/52)).
- Active Worker: **sewak-final**, version `11fd4aeb-ae23-462c-9bc8-6f29c877216f`, 100% traffic. URL: https://sewak-final.nischalbachhar9.workers.dev
- Real controlled login observations verified caregiver and superadmin pages at **1440 and 390 pixels**, with no page errors or horizontal overflow. Desktop sidebar cards read **Sewak**; mobile retains its existing hidden sidebar card and visible **Sewak** header. All run-owned unpublished identities were removed. These supplemental UI fixtures are not registration evidence.
- Lint, Worker typecheck, **113 frontend unit tests**, **163 D1 tests**, **28 local signed-in browser journeys**, canonical production build, protected dry run and release scan passed. Rendered-text branding assertions cover every existing customer, caregiver and superadmin visual route at all nine viewport widths, including nested markup. All three final-head [Auth](https://github.com/NischalBachhar/Sewak-final/actions/runs/39974665944), [customer](https://github.com/NischalBachhar/Sewak-final/actions/runs/39974666030) and [visual](https://github.com/NischalBachhar/Sewak-final/actions/runs/39974665934) CI checks passed. The visual job's initial Chrome download failed with a network HTTP/2 error before tests started; rerunning the unchanged job passed.
- Deployment used the guarded production operator with fresh passing three-database integrity evidence and **54 registration-based Auth checks** matched to the previous active Worker. All **26 checked live asset hashes** match the release build. Application writes, the three D1 bindings, secret references and existing Cron are preserved. No migration was applied.
- Post-upload integrity passed on all three databases with zero foreign-key violations. All **54 original application table hashes** match, all supplemental fixtures were removed, and all temporary diagnostic log sessions were closed. The original dirty checkout was preserved.

## Authentication validation limit

The existing intermittent Auth **HTTP 503** is unresolved. The first fresh pre-deployment attempt failed during registration; a subsequent complete run passed all 54 checks. Both reports and verified cleanup are retained. The earlier Worker version's post-Auth attempt failed at mobile password login after 35 checks; that historical result is not evidence for the new version.

Full registration-based Auth QA has **not yet run on this new Worker version**. Its normal hourly registration bucket had **9 of 10 attempts used**, leaving fewer than the four required identities. It becomes eligible after **2026-10-23 15:45:40 UTC (21:30:40 Nepal)**. No rate limit was cleared, weakened or bypassed. This record does not claim full post-deployment Auth success or resolution of the intermittent failure.

Private screenshots and full QA reports remain in ignored `.local-tools/`. The sanitized summary is [SEWAK-BRANDING-RELEASE.json](SEWAK-BRANDING-RELEASE.json). Earlier broader validation is in [the prior release record](SEWAK2-PRODUCTION-RELEASE.md).
