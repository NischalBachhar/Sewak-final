# Create Account: organization step flow

Implementation and production release date: October 10, 2026. Application commit `8425a3b` is pushed to `origin/release/registration-discovery` and deployed to `sewak-final`.

## Changes

- Customer registration remains a single form. Organization registration progresses through Account information, Organization details, and Services and confirmation.
- Account and organization values remain in React state while navigating Back, Continue and review edits. No password or entered form fields are newly persisted to browser storage; the existing pending-registration role marker is unchanged.
- Required fields are validated before advancing, with messages next to their controls and accessible error associations. Step changes focus the heading and scroll the form into view. Submission uses the existing handler with an additional synchronous duplicate-submit guard.
- Organization details reuse the existing type, phone, Nepal city/custom-city, address, optional registration number and PAN/VAT controls. No fields were removed.
- The final step groups the real service catalog, supports search/category filtering and multiple selections, shows selected services/counts, and presents account and organization details for review. Enter in service search filters without submitting registration.
- Desktop columns align at the top. The existing branding, illustration and animated caregiver cards occupy an independent sticky panel aligned to the viewport. Mobile shows compact branding without the large illustration. Reduced-motion preferences suppress animation; step content otherwise uses a brief opacity transition.
- Existing warm cream/brown styling and native keyboard-accessible controls remain. Small-screen step labels stack below their numbers; desktop services and review details use compact two-column grids.

## Backend and security

No Worker, auth-client, RBAC, schema or migration files changed. The final request still sends the existing `selectedRole`, organization details and service IDs. The previously implemented atomic D1 organization registration creates `orgadmin`, its linked organization and a pending application. Server validation, approval, password hashing, cookie/CSRF behavior and tenant isolation remain authoritative. Organization marketplace access still requires approval.

No new dependency, endpoint, public role or browser credential store was added. The password is omitted from the confirmation summary. Existing authenticated-incomplete registration recovery remains covered by browser tests.

## Changed files

- `src/AuthPage.js`: connect the step form to existing registration; retain login behavior and add duplicate-submit protection.
- `src/components/SignupRegistrationForm.js`: step navigation, validation, accessibility, account fields and review summary.
- `src/components/OrganizationFields.js`: reuse details/services sections and optional inline field errors; default full profile form remains supported.
- `src/components/NepalCitySelect.js`: optional form names and accessible inline errors.
- `src/components/ServiceSelector.js`: opt-in grouped/searchable signup presentation, selected-service summary and loading/empty feedback.
- `src/SignupPage.css`: independent sticky layout, compact mobile brand, steps, errors, services and confirmation styling, reduced-motion-safe transition.
- `tests/browser/signup-ui.spec.cjs`: responsive/sticky geometry, keyboard focus, validation, draft retention, service search/selection, real D1 creation and duplicate-submit checks.
- `tests/browser/journeys.spec.cjs` and `tests/browser/zz-discovery.spec.cjs`: existing organization journeys navigate the new steps.
- This report.

## Validation and delivery

Passed:

- Lint with no findings; Worker TypeScript check; `git diff --check`.
- 38 frontend unit tests in 11 suites.
- 39 D1/auth/security tests, including real workerd bindings and atomic organization creation/permissions.
- Full browser suite: 51 passed. After the final UI refinements, 17 focused checks also passed, including one additional shorter-desktop test. Customer/organization creation, pending approval, services/city persistence, keyboard focus, validation, Back/edit retention, duplicate-submit protection, reduced motion and stable branding were verified.
- Desktop and 320px screenshots were visually reviewed; the small-screen progress labels no longer crowd each other.
- Production release build and guarded `sewak-final` packaging dry run passed without publishing. Release scan passed across 313 repository files, with zero Firebase runtime references and zero private credential matches.

Browser coverage uses real local Worker/D1 behavior and Chrome at 320, 360, 375, 390, 414, 430, 768, 1024 and 1440px, plus a 1440×800 desktop viewport. The full suite also retains 1366/1920px route checks and existing login, booking, moderation and tenant-isolation journeys. Physical iPhone/Safari and hardware keyboard occlusion were not certified. An initial sandboxed focused run completed its assertions but hung during teardown; the subsequent full and final focused runs outside the sandbox exited successfully.

No new migration or manual database configuration was required. The production frontend build was published through the existing guarded Worker/assets deployment after refreshing production auth and D1 evidence. Worker version `9a4f0fea-9fd9-4dd2-ae18-91bcfbb2fc8d` is active at 100% on https://sewak-final.nischalbachhar9.workers.dev, with the expected `sewak-db` / `sewak-media` bindings, production audience and writes enabled. The deployment used the owner's existing Workers Free confirmation.

The live browser signup smoke passed: customer single-form presentation, all three organization steps, heading focus, stable desktop branding, no horizontal overflow at 320/390/1440px, Back draft retention, service search without accidental submission, one final registration request, and persisted custom city/service selection after reload. D1 confirmed the new disposable account's `orgadmin` role, organization linkage, selected service and pending approval. The test account and all its related records were removed and cleanup verified. Evidence is retained locally in `.local-tools/cloudflare-auth/signup-step-release-smoke.json`.

Production login/logout, cookie restoration and unauthenticated-access checks passed immediately before deployment, including disposable customer cleanup. The additional post-deployment customer-login run was stopped when creation of its new test account returned the existing registration rate limit (HTTP 429); it did not reach the login assertions. Cleanup was verified, and rate limits were not changed or bypassed. Post-deployment organization signup and session restoration passed independently as described above. Final checks on the deployed version confirmed healthy production with writes enabled, both D1 integrity checks `ok`, and zero foreign-key violations in either database. Local evidence: `.local-tools/cloudflare-auth/web-login-release-qa.json` (pre-deployment pass), `.local-tools/retirement-operator/post-retirement-cloudflare-qa.json` (additional run limited), and `.local-tools/cloudflare-auth/cloudflare-data-check.json` (post-deployment pass).

Existing build notices remain: Browserslist data is old, and `REACT_APP_CANONICAL_ORIGIN` is unset, so canonical/sitemap output is omitted. Neither notice failed the release build. Set the intended canonical origin through the existing release configuration if that metadata is required; this task does not change it.
