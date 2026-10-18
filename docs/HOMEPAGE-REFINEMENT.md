# Homepage refinement review

Built from Coral & Vanilla commit 08507bfcedcda93a1f38306ccfd487d60ebb71df (PR #31, still open against feature/sewak-secure-verification). The live public homepage was inspected in Chrome: headline and hero illustration match this source; deployed script main.39f447c2.js agrees with the prior release evidence. Dedicated branch: feature/homepage-compact-refinement. The original dirty notification checkout and verification worktree were left untouched.

## Changes

- Preserved hero markup, illustration, headline, buttons, logo and responsive geometry. Before/after hero pixels match with at most 0.01% allowance for Chromium corner rasterization; identical hero boxes at every tested width.
- Replaced four explanatory benefit blocks with a compact, wrapping strip.
- Added reusable, decorative SVG service icons mapped to all 16 currently supported stable catalog IDs, with neutral caregiver/household fallbacks for new IDs. No label guessing or dependencies.
- Refined service proportions, category/name hierarchy, stretched card links, hover borders and full-card keyboard focus. Kept dynamic catalog loading, counts, toggle, retry and empty behavior.
- Shortened the ordered three-step process; caregiver acceptance remains explicitly required.
- Replaced repetitive trust cards with verification transparency, service information and booking visibility. No blanket verification or clinical claims.
- Added family discovery and organization registration CTAs, plus returning-user sign-in. The organization CTA opens existing signup, where the organization role is selected. No authentication changes.

## Measurements and screenshots

Windows Chrome 155.0.8059.80, viewport height 1000px, device scale 1, reduced motion, same ordered 18-entry public-catalog fixture (16 supported services and two unknown-category fallback fixtures). Fonts ready and images decoded before capture. Default state shows six services; expanded state shows all 18. Heights are CSS pixels. Below-hero height runs from the benefit strip to the document bottom, including the footer. These are fixture measurements, not live production catalog counts.

| Width | Document before | Document after | Below hero before | Below hero after | Below hero reduction | Screenshots |
|---:|---:|---:|---:|---:|---:|---|
| 320 | 5038 | 4435 | 4144.3 | 3541.3 | 14.6% | [Before](design/homepage-refinement/before/home-320.png) / [After](design/homepage-refinement/after/home-320.png) |
| 375 | 4689 | 4166 | 3842.8 | 3319.8 | 13.6% | [Before](design/homepage-refinement/before/home-375.png) / [After](design/homepage-refinement/after/home-375.png) |
| 430 | 4458 | 4066 | 3639.2 | 3247.2 | 10.8% | [Before](design/homepage-refinement/before/home-430.png) / [After](design/homepage-refinement/after/home-430.png) |
| 768 | 3436 | 2878 | 2810.2 | 2252.2 | 19.9% | [Before](design/homepage-refinement/before/home-768.png) / [After](design/homepage-refinement/after/home-768.png) |
| 1024 | 2884 | 2446 | 2369.2 | 1931.2 | 18.5% | [Before](design/homepage-refinement/before/home-1024.png) / [After](design/homepage-refinement/after/home-1024.png) |
| 1366 | 2991 | 2518 | 2371.3 | 1898.3 | 19.9% | [Before](design/homepage-refinement/before/home-1366.png) / [After](design/homepage-refinement/after/home-1366.png) |
| 1440 | 3011 | 2552 | 2367.2 | 1908.2 | 19.4% | [Before](design/homepage-refinement/before/home-1440.png) / [After](design/homepage-refinement/after/home-1440.png) |
| 1920 | 3048 | 2611 | 2351.9 | 1914.9 | 18.6% | [Before](design/homepage-refinement/before/home-1920.png) / [After](design/homepage-refinement/after/home-1920.png) |

| Width | Expanded document before | Expanded document after |
|---:|---:|---:|
| 320 | 7016 | 6509 |
| 375 | 6555 | 6150 |
| 430 | 6280 | 6006 |
| 768 | 5001 | 3977 |
| 1024 | 3986 | 3229 |
| 1366 | 4017 | 3225 |
| 1440 | 4037 | 3259 |
| 1920 | 4074 | 3293 |

Desktop default-state reduction is 18.5–19.9% below the hero. Phones retain comfortable spacing and reduce 10.8–14.6%. Expanded catalogs benefit more from shorter repeated cards. Raw measurements are stored beside each screenshot.

## Validation

- npm run lint: passed.
- npm run typecheck: passed (existing Worker TypeScript check; frontend is JavaScript).
- npm run test:unit -- --silent --testMatch '**/*.test.js' --testPathIgnorePatterns node_modules: 16 suites / 74 tests passed. Explicit glob overrides the Windows mixed-path test discovery problem in this isolated worktree; the default command found zero tests and was not counted as a pass.
- node scripts/test-browser.cjs homepage-refinement.spec.cjs: optimized production React build and metadata generation passed; 9 browser tests passed. Eight widths, no overflow in collapsed/expanded states, 3/2/1 service columns, hero comparison, icons/fallbacks, all card destinations, 44px service actions, CTA destinations, real discovery navigation and registration role availability. Loading/error/retry/empty states, keyboard skip link, Enter/Space toggle and visible focus passed.
- axe WCAG 2 A/AA, 2.1 AA and 2.2 AA checks: zero violations at all eight fixture widths. Existing accessibility checks against the real local D1 catalog passed at 375px and 1366px; existing real-catalog error/retry/empty regression passed (3 additional browser tests).
- git diff --check: passed.
- Before/after desktop and mobile captures inspected. No overlap or clipping observed; reduced motion enabled in layout captures.

## Modified files

- src/HomePage.js
- src/HomePage.css
- src/components/HomeServiceIcon.js
- tests/browser/homepage-refinement.spec.cjs
- docs/HOMEPAGE-REFINEMENT.md (this report)
- docs/design/homepage-refinement/{before,after}/: eight PNGs and eight measurement JSON files each.

## Limits and remaining enhancement

Discovery has an existing validated in-page service selector, but does not consume a service query parameter. All cards deliberately keep normal /browse navigation. Deep linking a selected service remains a separate discovery enhancement. Organization selection remains part of the existing signup workflow. Visual and automated browser QA used Chrome; other browser engines and manual screen-reader testing were not performed. Browserslist reported its existing old-data warning; no dependency updates were made. No Worker, D1, secrets, notifications, booking permissions, pricing, shared tokens or dashboard changes. At initial PR delivery, no merge or Cloudflare deployment had occurred.

Screenshot pixels and baseline height assertions run only when the recorded platform and Chrome version match, because platform fonts differ. Other environments run all responsive, behavioral and accessibility assertions and generate their own captures.

## Approved production release — 18 October 2026

Homepage application commit `74ecef5` was deployed through the guarded release script to Worker version `ddd7dda0-434c-4632-b7f5-902bea576f53`. All 54 registration-based auth QA checks passed before deployment, with cleanup and unchanged existing application/media records. The first pre-deployment attempt detected a separate real administrator account safety action during its snapshot window; that action was preserved and the subsequent full run passed.

On the deployed version, the full auth run passed 49 checks and stopped at one HTTP 503 on the tenth intentional failed login. A bounded supplemental run passed all 16 targeted checks, including ten failed logins, normalized-email throttling, all-session revocation and health. Both post-deployment runs verified synthetic cleanup and unchanged existing application/media records. The original full run remains failed; the intermittent HTTP 503 cause is unresolved. Post-deployment fixtures were operator-seeded and do not provide independent registration coverage. No rate limits were reset or weakened.

All three current-version databases passed final integrity checks with zero foreign-key violations. Production browser smoke passed 32 page/viewport combinations with zero page errors or overflow; four published asset hashes matched the reviewed build. The Worker bundle is byte-identical to the prior release. No migrations, secret changes, write-setting changes or PR merges occurred.

See [sanitized release evidence](HOMEPAGE-REFINEMENT-RELEASE.json). Private reports, test identities and credentials remain excluded from Git.
