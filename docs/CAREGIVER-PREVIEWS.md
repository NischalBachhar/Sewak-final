# Caregiver previews and request availability

The original feature was developed on the deployed homepage refinement. The
production release applies it to current main (`639d7ed`) in an isolated
worktree, preserving the newer organization moderation fixes. Integration
[PR #38](https://github.com/NischalBachhar/Sewak-final/pull/38) remains open; the
primary checkout's unrelated authentication and notification edits are preserved.

## Behavior and data boundaries

- `/`: “Meet Sewak Care Professionals” follows the services section. Up to three
  profiles come from the existing `publicCaregivers` search, with a link to
  `/browse`. The redundant confidence introduction is removed to keep the page
  compact; the hero, services, how-it-works and organization entry points remain.
- `/user/home`: “Explore Caregivers” follows recent bookings. View All opens
  `/user`; profiles and booking requests use `/user/caregivers/:id` and
  `/user/book/:id` under the existing customer authorization.
- Shared cards display public photos/fallbacks, location, actual assigned
  services, audited verification, verified-review aggregates and configured
  hourly rates. The preview has no search controls.
- Search still returns only accepting profiles under the original eligibility
  SQL. Unapproved, suspended, blacklisted and restricted-organization records
  remain hidden. No unavailable-profile search mode is introduced.
- “Accepting requests” requires explicit availability and public eligibility
  flags. A safely returned profile with `false` shows “Not accepting requests”.
  Missing availability keeps the existing `isAvailable: false` contract and
  adds `availabilityConfirmed: false`, labeled “Availability not confirmed”;
  it cannot enable booking. Work type remains a separate schedule.
- Disabled actions explain unavailable requests, missing services or an
  unconfigured rate. A preferred visit still requires caregiver acceptance.
- Find Care keeps filters, real result totals and cursor pagination. Single
  results are centered at a maximum of 480px; two results form a balanced pair.
  The oversized top-rated banner is removed, while verified ratings still
  determine the existing within-page ordering.
- Concurrent public service-label loads share one request. Loading, generic
  retryable errors and empty results are rendered without inventing profiles.
- The existing Worker booking validation and atomic version guards recheck
  caregiver availability, account/organization status, assigned services and
  authoritative pricing when a request is committed. No booking policy changes,
  schema changes, migrations or new dependencies are needed.

Caregivers continue to edit `isAvailable` through their profile's availability
controls and Save Profile action; the authorized Worker update remains in place.

## Modified implementation files

- `src/HomePage.js`, `src/CustomerHomePage.js`: preview placement.
- `src/caregiverDiscovery.js`: shared public discovery, concurrent service reads,
  availability labels and booking-action explanations.
- `src/components/CaregiverPreview.js`, `CaregiverPreviewCard.js`,
  `RequestAvailability.js`, `CaregiverPreview.css`: shared listing/cards/status.
- `src/CaregiverListPage.js`, `src/BrowsePage.css`,
  `src/CustomerExperience.css`: shared cards, short-result layout and navigation.
- `src/PublicCaregiverProfilePage.js`: explicit availability and explained,
  accessible disabled booking controls.
- `src/components/ServiceSelector.js`: share concurrent public service reads.
- `worker/src/queries.ts`: add public availability confirmation without changing
  the existing boolean contract used by web/mobile consumers.
- `src/components/CaregiverPreview.test.js`,
  `tests/d1/caregiver-previews.test.mjs`,
  `tests/browser/caregiver-previews.spec.cjs`: new regression coverage.
- `src/logout.test.js`: isolate the auth test from unrelated discovery requests.
- `tests/browser/coral-vanilla.spec.cjs`,
  `tests/browser/homepage-refinement.spec.cjs`: scope service-state assertions to
  their section; retain hero pixel/accessibility checks and require the expanded
  homepage to remain at least 10% shorter below the hero than the original
  marketing page, replacing the superseded 15–20% introductory-content target.
- `.github/workflows/auth-reliability.yml`: run the new browser regressions in CI.

## Validation

Implementation validation uses synthetic accounts and local SQLite/D1 or actual
workerd bindings. Authorized production verification is recorded separately below.

- Frontend: `CI=true npm run test:unit -- --testMatch '**/*.test.js' --silent`.
  The explicit glob avoids CRA/Jest's mixed-slash path matching in this Windows
  worktree; all test files are included.
- Worker: `npm run typecheck` and `npm run test:d1`.
- Lint: `npm exec -- eslint src --ext .js,.mjs` and `git diff --check`.
- Browser: `npm run test:browser -- caregiver-previews.spec.cjs
  zz-discovery.spec.cjs journeys.spec.cjs accessibility.spec.cjs
  verification.spec.cjs coral-vanilla.spec.cjs homepage-refinement.spec.cjs`.
  This includes an optimized production frontend build and an isolated local
  Worker fixture server. Tests cover navigation, the booking lifecycle,
  availability restrictions, private-data filtering, verified ratings,
  pagination, empty/error/loading states, keyboard behavior, reduced motion,
  accessibility and overflow across mobile/tablet/desktop widths.

Frontend: **89 passed** across 17 suites. D1/Worker: **128 passed**, including
actual workerd bindings. Worker typechecking, full frontend lint, the optimized
frontend build and `git diff --check` passed. **85 Chrome browser tests passed**,
with zero skipped tests or failures. The run includes 24 accessibility checks,
all four role layouts, the full booking/review lifecycle, verification evidence
workflows and the new preview regressions. Results are summarized in
`docs/design/caregiver-previews/validation.json`.

These counts describe the original feature checkout. The integrated production
release passed 96 frontend, 135 D1/workerd and 86 Chrome browser tests, plus lint,
Worker typecheck, production build, dry-run and credential/runtime scan. All five
GitHub workflows passed for application commit `f9ee879`.

## Screenshots

`docs/design/caregiver-previews/` contains local fixture screenshots, not live
customer/caregiver data:

- `public-{320,390,768,1440}.png`
- `customer-{320,390,768,1440}.png`
- `find-care-single-1440.png`, `find-care-pair-1440.png`
- `public-three-1440.png`, `public-three-390.png` show the bounded three-profile
  layout when more eligible server records exist.

## Production release

Deployed with explicit user authorization on 2026-10-18 to
https://sewak-final.nischalbachhar9.workers.dev, Worker version
`ab3f87c0-dab2-44bf-b8f9-d89906fe88b4`, application commit `f9ee879`. No PR was merged.

The unchanged release guard accepted fresh registration-based 54-check auth QA
from the immediately preceding production release, matching baseline version
`3aa352be-b9da-4b93-af90-5006cfcc5799`. Post-deploy auth passed 54 checks on the new
version using disposable seeded fixtures. All three D1 databases passed integrity
and foreign-key checks.

Live smoke verified four published asset hashes, public routes at five widths,
and customer previews at two widths (22 page/width combinations), session
restoration, profile and booking-page navigation, no page errors or overflow, and
cleanup with existing application records unchanged. No real booking was submitted.
The first live customer smoke hit the existing registration throttle (HTTP 429);
the follow-up seeded a disposable customer. No new independent post-deploy
registration coverage is claimed, and no limiter was changed or cleared.

No migrations, secrets, bindings, billing or schedule changes were made. Workers
Free relied on the existing operator attestation because the billing API returned
403. Sanitized evidence is in [CAREGIVER-PREVIEWS-RELEASE.json](CAREGIVER-PREVIEWS-RELEASE.json).
