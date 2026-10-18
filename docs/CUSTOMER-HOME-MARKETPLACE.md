# Customer homepage marketplace redesign

Implemented in `.worktrees/customer-home` on `feature/customer-home-marketplace`. The initial `origin/main` baseline was `7da3a89`; release integration preserves the newer deployed caregiver-preview implementation `f9ee879` and its release branch. The owner subsequently authorized merge and deployment in PR #40. Unrelated edits in the main checkout were preserved. This change adds no Worker, API, dependency, binding, secret, or schema changes relative to the deployed baseline.

## Changed files

- `src/CustomerHomePage.js`: replaces the greeting hero, statistics and shortcuts with a compact Find & Book Care heading, discovery first, and compact booking activity below. Booking loading/errors do not block discovery. Active requests retain live statuses, next steps and detail links; upcoming care is ordered by schedule in Asia/Kathmandu.
- `src/components/CustomerCareDiscovery.js`: adds category, city/area, catalog service, hourly NPR range, request acceptance and audited verification filters; reset, retry, loading, empty states and pagination. Uses existing public projections and existing profile/booking routes. Cards show public profile photos/fallbacks, organization/service information, verified review aggregates, audited verification, request acceptance and configured hourly rates. Unavailable/ineligible profiles have disabled booking controls; the existing booking flow and Worker still enforce authorization.
- `src/CustomerMarketplace.css`: homepage-scoped styles with three desktop, two tablet and one mobile columns. A single result retains its column width. Shared navigation and other dashboards are unchanged.
- `tests/browser/customer-home.spec.cjs`: six browser checks covering signed-in first-screen geometry at 1440, 768 and 375px, overflow, page errors, filters, pagination, profile navigation, booking navigation, unavailable workers, empty results, loading/errors/retry, independent booking failures, zero bookings and completed booking history.
- `tests/browser/caregiver-previews.spec.cjs`: updates only the authenticated-home selectors and Book Now action to match the redesigned marketplace; keeps guest preview and sign-in continuation regression coverage.
- `src/components/CaregiverPreview.test.js`, `tests/browser/auth-reliability.spec.cjs`, `tests/browser/accessibility.spec.cjs`, `tests/browser/coral-vanilla.spec.cjs`: update customer-home expectations while retaining public preview, role, accessibility and layout checks.

- `tests/browser/journeys.spec.cjs`: updates the expected customer homepage heading; all booking, role, navigation and authorization checks remain intact.

## Validation

- Lint and TypeScript checks pass.
- Production React build passes.
- Integrated frontend suite: 96 tests pass across 19 suites. On this Windows worktree Jest requires `npm.cmd run test:unit -- --testMatch '**/*.test.js'` because its generated absolute glob mixes path separators.
- Integrated D1/workerd suite: 135 tests pass, using isolated local databases. Bundler/runtime tests require local process permissions outside the filesystem sandbox.
- New homepage browser suite: six tests pass.
- Integrated local browser regression checks: 40 pass across isolated runs (six new homepage checks, 31 preview/auth/booking journeys and three customer accessibility/layout checks). Coverage includes the complete booking/acceptance/shift-completion/verified-review flow, all four roles across six viewport widths, and WCAG accessibility checks. Logs: `.local-tools/customer-home-integrated-browser.log`, `.local-tools/customer-home-integrated-regression-browser.log`, `.local-tools/customer-home-accessibility-regression.log`.
- `git diff --check` passes.
- Screenshots inspected at all three requested widths. The first card and its booking/profile actions fit within the initial 900px-tall viewport, above secondary booking activity, without horizontal overflow or page errors.

## Screenshots

Synthetic records exist only in the local test harness, never in application source or production:

- `.local-tools/customer-home-screenshots/customer-home-1440.png`
- `.local-tools/customer-home-screenshots/customer-home-768.png`
- `.local-tools/customer-home-screenshots/customer-home-375.png`

## Limits

Price ranges are applied to configured public hourly rates after reading all pages matching the backend filters, so later-page matches are included. Production searches return accepting profiles by default. Selecting all profiles or non-accepting profiles uses the existing public projection and filters the full paginated result locally. Very large result sets can therefore take longer. Unconfigured rates are excluded when a price range is selected. No backend or schema change was introduced.

Accepting requests does not promise an appointment slot. Incomplete verification is explicitly labelled; it does not become a verified badge. Booking eligibility continues to follow existing backend policy rather than introducing a new verification requirement.

Local browser checks use real local Worker/D1 routes with synthetic fixtures. Release evidence and post-deployment screenshots are recorded separately under `.local-tools/customer-home-live`. Browserslist reports its existing outdated data notice; no dependencies were changed.
