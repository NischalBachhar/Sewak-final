# Coral & Vanilla redesign

The public marketplace and all four authenticated workspaces now share one warm, restrained visual foundation. The actual Sewak logo is retained.

## Review scope

- `src/DesignTokens.css` defines the mandatory brand palette, semantic status colors, accessible text variants, borders, shadows and workspace width. Existing page styles consume these tokens instead of maintaining separate blue, teal and brown palettes.
- `src/DesignSystem.css` coordinates controls, keyboard focus, forms, reduced motion, responsive spacing and dashboard widths. The customer dashboard has a fluid, 1600px maximum workspace without the previous nested card margins.
- `/` is a dedicated public homepage. `/browse` retains its existing search, server filtering, pagination and booking eligibility. Public navigation connects the homepage, service catalog, discovery and auth pages. Canonical metadata and the sitemap distinguish `/` from `/browse`.
- Homepage services use the existing public catalog loader and its eligibility exclusions. Six services appear initially, with an accessible control to reveal the rest. Loading, unavailable and empty catalog states are explicit. No business metrics, testimonials, certifications or example bookings are fabricated.
- Sign-in retains its local family illustration; signup uses a distinct care-partner illustration and native customer/organization role controls. Password visibility, recovery guidance, validation, organization registration steps and handlers remain intact.
- Customer, caregiver, organization and superadmin screens retain their data and actions. Booking status, acceptance, pricing, payment, care sessions, safety, permissions and tenant logic are unchanged.
- The existing browser suite now has self-contained visual booking fixtures and selectors aligned with the organization workspace already on `main`. New checks cover the homepage, requested viewports and WCAG A/AA rules using axe-core. The existing isolated CI workflow runs these checks.

## Release boundary

Started from `origin/main` at `387a45fbf015d3913a98cbff059d31600209f065` in `.worktrees/coral-vanilla`, branch `feature/coral-vanilla-redesign`. After deployment was authorized, live inspection confirmed version `0a2a7e97-c132-4939-8376-914e98a8c737` includes secure verification that is not yet on `main`. The redesign was therefore carried onto `f548df1` from `feature/sewak-secure-verification`, which includes the deployed implementation and its release safeguards. The PR is stacked on that branch to keep the UI diff reviewable. The original checkout's authentication/notification work remains untouched and excluded.

Relative to the preserved live baseline, this redesign changes no Worker code, database migrations, write settings, secrets, payment calculations or deployment safeguards. It also themes the existing verification workspace, retaining encrypted evidence and authorized public badges. Local browser data is synthetic and exists only in the loopback D1 fixture server. The owner subsequently authorized commit, push and deployment; GitHub merge has not been requested.

## Validation

Validated locally on Windows on 2026-10-16:

| Check | Result |
| --- | --- |
| `npm run test:unit -- --testMatch '**/src/**/*.test.js'` | 74 tests passed across 16 suites. The explicit match handles the nested Windows worktree path. |
| `npm run test:d1` | 124 passed, including actual workerd bindings, D1 authentication, private media and secure verification. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed. |
| Optimized React build, run by `npm run test:browser` | Compiled successfully. |
| Full isolated browser suite | 127 passed, 0 failed, 0 skipped, 0 flaky (6.1 minutes), including 24 axe accessibility audits. |
| `npm run build:release` with the production canonical origin | Passed; separate production bundle created. |
| `npm run deploy:cloudflare -- --worker sewak-final --dry-run` | Passed; preserved all three production D1 bindings and write mode; no upload. |
| `node scripts/scan-release.mjs` | Passed; 413 repository files scanned, no private credential matches or retired Firebase runtime references. |
| Read-only production D1 verification | Passed for DB, MEDIA_DB and EVIDENCE_DB, with zero foreign-key violations, on version `0a2a7e97-c132-4939-8376-914e98a8c737`. |
| `git diff --check` | Passed. |

The combined browser build's main JavaScript is 123.41 kB gzipped, and main CSS is 28.11 kB. The initial `main` baseline measured 119.56 kB and 28.87 kB respectively; the final comparison also includes the preserved verification frontend. The homepage WebP is 243,092 bytes and is loaded only by the homepage image element. These are bundle/asset measurements, not a production performance score.

## Visual review

The [screenshot gallery](design/coral-vanilla/README.md) includes desktop and mobile captures, plus before/after comparisons for sign-in, signup, customer, caregiver and admin overviews. Baseline captures use the base commit above. All displayed accounts and booking records are synthetic local fixtures.

The anonymous root previously redirected to discovery; there is no equivalent homepage baseline. The baseline visual run captured the admin overview but subsequently failed on its bookings view because it assumed another suite had created a booking. The visual suite now creates its own booking fixture. Existing organization journey selectors were also aligned with main's current section titles, team-member action and pagination UI; count, navigation and modal assertions remain in place.

## Limits and outstanding review

- Automated accessibility checks cover 12 representative pages at mobile and desktop widths, including caregiver/admin verification. Passing axe rules is not a complete accessibility certification; human assistive-technology review remains valuable.
- Local browser verification uses desktop Chrome with responsive viewports and synthetic loopback D1 data. It does not establish real-device Safari/Firefox behavior, email delivery or production health.
- The installed Browserslist dataset reports that it is 10 months old. It does not fail lint or build. Dependency refresh is outside this visual change.
- The generated homepage image is illustrative. The existing Sewak logo and established application data remain authoritative.
- Deployment is authorized, but automatic approval review rejected the required production auth-QA command because it creates and removes synthetic production accounts. No production test-data writes or deployment were performed by that rejected command. Explicit approval for the synthetic QA writes is still needed; the release guard will not be bypassed.

## Dependency audit

The full refreshed audits are **not clean**: the frontend toolchain has 100 findings (4 low, 17 moderate, 76 high, 3 critical), and Worker tooling has 4 high findings. The [complete audit evidence](CORAL-VANILLA-AUDIT.json) records every finding, exact installed versions, advisory ranges, inherited paths and current release bundle hashes; nothing is suppressed.

The findings, versions and advisory ranges match the previously reviewed live baseline. None of the affected packages appears in the 14 emitted browser/Worker source maps (124 source entries). They are in the existing build/test/dev-server and Wrangler/Miniflare/sharp tooling, not deployed runtime modules. This change adds no runtime dependency; axe-core was already installed transitively and is now pinned explicitly for test use. Builds use repository-owned inputs, not uploaded documents, and production serves static assets through the Worker. Toolchain remediation remains outstanding, and the assessment must be repeated when dependencies or build inputs change.

## Image provenance

`public/images/care-for-every-generation.webp` is an AI-generated editorial illustration, produced with the built-in imagegen tool and encoded locally as a 243,092-byte WebP. It represents inclusive care, not real Sewak staff, customers, a testimonial or a specific property. The original logo is not generated or altered. The sign-in SVG remains a separate local illustration.

Generation prompt:

> Landscape 3:2 editorial illustration for a premium Nepali caregiver website. No text, no logos, no lettering, no UI. Sophisticated warm painterly digital illustration with fine paper texture, natural people and coherent anatomy. A welcoming contemporary Nepal home: a female caregiver in coral helps a small child with wooden blocks on the left, an elderly Nepali woman in a peach shawl shares tea with a younger adult at center, an adult man who uses a wheelchair participates comfortably on the right, and a male household helper carries folded linens. Relaxed dignified interaction. Subtle Kathmandu roofline and pale mountains through the window. Indirect natural daylight. Palette mostly vanilla #FFF8F0 and warm white, soft blush #F7DED4, restrained coral #B94738 and cocoa, a touch of gold. Spacious uncluttered background, beautiful premium lifestyle illustration, no floating hearts or panels. Asset for Sewak homepage right half.

## Changed files

Relative to the preserved live baseline `f548df1`:

- [.github/workflows/signed-in-visual-qa.yml](../.github/workflows/signed-in-visual-qa.yml)
- [docs/CORAL-VANILLA-AUDIT.json](../docs/CORAL-VANILLA-AUDIT.json)
- [docs/CORAL-VANILLA-REDESIGN.md](../docs/CORAL-VANILLA-REDESIGN.md)
- [docs/design/coral-vanilla/README.md](../docs/design/coral-vanilla/README.md)
- [docs/design/coral-vanilla/after/admin-1440-overview.png](../docs/design/coral-vanilla/after/admin-1440-overview.png)
- [docs/design/coral-vanilla/after/browse-1366.png](../docs/design/coral-vanilla/after/browse-1366.png)
- [docs/design/coral-vanilla/after/browse-375.png](../docs/design/coral-vanilla/after/browse-375.png)
- [docs/design/coral-vanilla/after/caregiver-1440-overview.png](../docs/design/coral-vanilla/after/caregiver-1440-overview.png)
- [docs/design/coral-vanilla/after/customer-1440-booking-request.png](../docs/design/coral-vanilla/after/customer-1440-booking-request.png)
- [docs/design/coral-vanilla/after/customer-1440-caregiver-details.png](../docs/design/coral-vanilla/after/customer-1440-caregiver-details.png)
- [docs/design/coral-vanilla/after/customer-1440-overview.png](../docs/design/coral-vanilla/after/customer-1440-overview.png)
- [docs/design/coral-vanilla/after/customer-390-booking-request.png](../docs/design/coral-vanilla/after/customer-390-booking-request.png)
- [docs/design/coral-vanilla/after/customer-390-caregiver-details.png](../docs/design/coral-vanilla/after/customer-390-caregiver-details.png)
- [docs/design/coral-vanilla/after/customer-390-overview.png](../docs/design/coral-vanilla/after/customer-390-overview.png)
- [docs/design/coral-vanilla/after/home-1366.png](../docs/design/coral-vanilla/after/home-1366.png)
- [docs/design/coral-vanilla/after/home-375.png](../docs/design/coral-vanilla/after/home-375.png)
- [docs/design/coral-vanilla/after/login-1440.png](../docs/design/coral-vanilla/after/login-1440.png)
- [docs/design/coral-vanilla/after/organization-overview-1366.png](../docs/design/coral-vanilla/after/organization-overview-1366.png)
- [docs/design/coral-vanilla/after/organization-overview-375.png](../docs/design/coral-vanilla/after/organization-overview-375.png)
- [docs/design/coral-vanilla/after/signup-1440.png](../docs/design/coral-vanilla/after/signup-1440.png)
- [docs/design/coral-vanilla/after/verification-admin-1440.png](../docs/design/coral-vanilla/after/verification-admin-1440.png)
- [docs/design/coral-vanilla/after/verification-admin-390.png](../docs/design/coral-vanilla/after/verification-admin-390.png)
- [docs/design/coral-vanilla/after/verification-caregiver-1440.png](../docs/design/coral-vanilla/after/verification-caregiver-1440.png)
- [docs/design/coral-vanilla/after/verification-caregiver-390.png](../docs/design/coral-vanilla/after/verification-caregiver-390.png)
- [docs/design/coral-vanilla/before/admin-1440-overview.png](../docs/design/coral-vanilla/before/admin-1440-overview.png)
- [docs/design/coral-vanilla/before/caregiver-1440-overview.png](../docs/design/coral-vanilla/before/caregiver-1440-overview.png)
- [docs/design/coral-vanilla/before/customer-1440-overview.png](../docs/design/coral-vanilla/before/customer-1440-overview.png)
- [docs/design/coral-vanilla/before/customer-390-overview.png](../docs/design/coral-vanilla/before/customer-390-overview.png)
- [docs/design/coral-vanilla/before/login-1440.png](../docs/design/coral-vanilla/before/login-1440.png)
- [docs/design/coral-vanilla/before/signup-1440.png](../docs/design/coral-vanilla/before/signup-1440.png)
- [package-lock.json](../package-lock.json)
- [package.json](../package.json)
- [public/images/care-for-every-generation.webp](../public/images/care-for-every-generation.webp)
- [public/index.html](../public/index.html)
- [public/manifest.json](../public/manifest.json)
- [scripts/public-metadata.cjs](../scripts/public-metadata.cjs)
- [src/AdminDashboardPage.js](../src/AdminDashboardPage.js)
- [src/App.css](../src/App.css)
- [src/App.js](../src/App.js)
- [src/AuthPage.css](../src/AuthPage.css)
- [src/AuthPage.js](../src/AuthPage.js)
- [src/BookingDetailPage.css](../src/BookingDetailPage.css)
- [src/BookingFormPage.css](../src/BookingFormPage.css)
- [src/BrowsePage.css](../src/BrowsePage.css)
- [src/BrowsePage.js](../src/BrowsePage.js)
- [src/CaregiverDashboardPage.js](../src/CaregiverDashboardPage.js)
- [src/CaregiverListPage.js](../src/CaregiverListPage.js)
- [src/CaregiverProfilePage.css](../src/CaregiverProfilePage.css)
- [src/CaregiverShiftWorkflow.css](../src/CaregiverShiftWorkflow.css)
- [src/CustomerExperience.css](../src/CustomerExperience.css)
- [src/CustomerHomePage.js](../src/CustomerHomePage.js)
- [src/DashboardExperience.css](../src/DashboardExperience.css)
- [src/DesignSystem.css](../src/DesignSystem.css)
- [src/DesignTokens.css](../src/DesignTokens.css)
- [src/HomePage.css](../src/HomePage.css)
- [src/HomePage.js](../src/HomePage.js)
- [src/MyBookingsPage.js](../src/MyBookingsPage.js)
- [src/OrganizationDashboard.css](../src/OrganizationDashboard.css)
- [src/OrganizationDashboard.js](../src/OrganizationDashboard.js)
- [src/OrganizationWorkspace.css](../src/OrganizationWorkspace.css)
- [src/PasswordChangeModal.css](../src/PasswordChangeModal.css)
- [src/ProfessionalWorkspace.css](../src/ProfessionalWorkspace.css)
- [src/SignupPage.css](../src/SignupPage.css)
- [src/ThemeProvider.js](../src/ThemeProvider.js)
- [src/assets/login-care.svg](../src/assets/login-care.svg)
- [src/components/CareExperience.css](../src/components/CareExperience.css)
- [src/components/Header.css](../src/components/Header.css)
- [src/components/Header.js](../src/components/Header.js)
- [src/components/LoginExperience.js](../src/components/LoginExperience.js)
- [src/components/MobileBottomNavigation.css](../src/components/MobileBottomNavigation.css)
- [src/components/PublicHeader.css](../src/components/PublicHeader.css)
- [src/components/PublicHeader.js](../src/components/PublicHeader.js)
- [src/components/RouteMetadata.js](../src/components/RouteMetadata.js)
- [src/components/SignupExperience.js](../src/components/SignupExperience.js)
- [src/components/VerificationWorkspace.css](../src/components/VerificationWorkspace.css)
- [src/index.css](../src/index.css)
- [src/index.js](../src/index.js)
- [src/theme.js](../src/theme.js)
- [tests/browser/accessibility.spec.cjs](../tests/browser/accessibility.spec.cjs)
- [tests/browser/coral-vanilla.spec.cjs](../tests/browser/coral-vanilla.spec.cjs)
- [tests/browser/journeys.spec.cjs](../tests/browser/journeys.spec.cjs)
- [tests/browser/visual-qa.spec.cjs](../tests/browser/visual-qa.spec.cjs)
