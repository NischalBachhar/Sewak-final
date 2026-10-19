# Sewak demo marketplace rebuild — feature and release record

This branch is an **original Sewak implementation**, inspired by common care marketplaces and the user's Care.com walkthrough. It is **not** a literal clone, a license to use Care.com intellectual property, or a claim of parity with private Care.com systems.

## Built in this draft rebuild
- Original care-first visual system across public pages, customer discovery, caregiver workspace, organization workspace, superadmin operations, signup and account pages. Responsive menus and touch navigation.
- Public service/category discovery, published caregiver profiles, prices, verification disclosures, availability/status controls and booking request funnel backed by D1 projections.
- Customer saved caregivers, family care job posts, approved caregiver applications, booking/meeting communications and private message inbox; role-scoped API permissions.
- Independent caregiver registration with safe default: pending admin approval, hidden from discovery and not falsely verified. Organization onboarding and moderation preserved.
- In-app, recipient-only notifications for booking changes, approvals, care jobs and private messages. Upcoming booking reminders from Worker Cron. These are not SMS/email/push delivery.
- Caregiver one-time time off and **optional recurring weekly hours**; requests and acceptance are rejected when they conflict with blocks or published weekly windows, using D1 transaction guards. Nepal local wall-clock hours, no invented availability.
- Membership preview preferences saved in D1: Free / Plus Preview, **NPR 0**, explicitly no payment, no subscription and no unlocked premium privileges. Existing cash booking remains; card/mobile-wallet billing is not activated.
- Optional short **original illustrated MP4** generated at reviewed release build time from Sewak's existing family-care image with FFmpeg, with static/reduced-motion fallback. This is not filmed/live-action footage and does not include the uploaded Care.com screen recording.
- Real SQLite/D1 validation and isolated Playwright flows including protected inbox, booking lifecycle, time-off, weekly schedule, membership demo and multi-role navigation.

## Still not equivalent to a commercial Care.com production platform
- No real online payment capture/settlement, paid subscription billing, invoicing, plan entitlements, or Fonepay/eSewa/Khalti merchant integration. These require accounts, credentials, settlement requirements and payment reconciliation.
- No domain-verified transactional email or SMS, no push subscription delivery and no external background-check agency integrations. In-app events/reminders are supported.
- No independent proof of identity, police clearance or professional licensing is implied by a profile beyond the underlying Sewak verification decisions.
- No licensed live-action caregiving video footage is included.
- No claim that private Care.com account, caregiver or administrator screens were accessed or reproduced exactly.

## Release gates
1. Preserve the original main branch and production D1 data; back up the database before adding migrations.
2. Run from a reviewed commit: `npm ci && npm --prefix worker ci`, `npm run typecheck`, `npm run test:d1`, `npm run test:unit -- --silent`, `npm run lint`.
3. Run isolated, seeded `npm run test:browser`. Confirm customer booking from discovery, caregiver acceptance and shift completion, organization service/team management, admin review, notification and chat ownership, membership preview and recurring weekly-hour conflicts at mobile and desktop widths.
4. Build with `npm run build:release` and verify the generated motion clip or usable illustrated fallback; do not block release on optional FFmpeg.
5. Run `npm run deploy:cloudflare -- --worker sewak-final --dry-run` and required release scanners, then verify QA artifacts and security headers.
6. Check actual signup/role journeys in a **nonproduction** Cloudflare Worker + D1 project. Only after explicit review, apply idempotent D1 migrations in order and deploy.
7. Verify live API health, real D1 service inventory, sessions, denied cross-role access, mobile menus and booking notifications after deploy. Do not fabricate providers, reviews, testimonials, ratings, prices or badges.

**Current state:** rebuild merged in PR #43. Current release work, QA results and actual deployment status are recorded in `MARKETPLACE-PRODUCTION-RELEASE.md`. No real payment or verified email delivery is enabled.
