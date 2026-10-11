# Create Account: organization step flow

Implementation date: October 10, 2026. This UI update is local and is not committed, pushed or deployed.

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

No new migration or manual database configuration is required. Publishing requires a new production frontend build and the existing guarded Worker/assets deployment with current production auth and D1 evidence. The browser-test build must never be deployed. The prior production release remains unchanged by this local UI work.

Existing build notices remain: Browserslist data is old, and `REACT_APP_CANONICAL_ORIGIN` is unset, so canonical/sitemap output is omitted. Neither notice failed the release build. Set the intended canonical origin through the existing release configuration if that metadata is required; this task does not change it.
