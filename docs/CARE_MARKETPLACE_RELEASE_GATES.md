# Sewak — care marketplace rebuild and demo-release gates

## Product decision: accessible care marketplace for Nepal
- All customer, caregiver and organization accounts have **no membership or subscription fee** in this demo.
- Public profile search remains available without a membership paywall.
- The currently supported booking path is **request -> caregiver approval -> care -> completion**.
- The booked care price comes from Sewak's actual service/caregiver data and is displayed in **NPR**.
- The only enabled payment choice is **cash**. No card or Fonepay payment is executed in this build; no fake paid status, renewal, or purchase confirmation is shown.
- Organization commission terms are managed by Sewak operations. No automated payout claims.
- The business should decide if and when to introduce verified payment providers, cancellation rules and optional agency SaaS pricing. Never turn on paid membership without an explicit reviewed requirement.

## Functionality added on the redesign branch
- Approved caregiver discovery, public profiles, service filtering and quotation.
- Independent caregiver application, profile editing and admin approval rules.
- Family job posts, caregiver applications, customer shortlists, participant-only D1 messaging and a unified inbox.
- Atomic booking status notifications; caregiver and customer alerts, agency booking alerts and team/applicant/messaging notifications.
- Cron-delivered, idempotent in-app reminders for care sessions starting within 24 hours.
- Caregiver date/time blocks, customer slot checks and D1-guarded booking conflicts including overnight windows.
- Role-specific signed-in workspaces plus original soft-green brand styling and optional media heroes.

## Original video requirement
The reference Care.com recording is **not licensed for use as Sewak footage**. The project intentionally uses Sewak's own illustration with reduced-motion-aware movement until original care footage can be supplied. To enable MP4 media in all hero surfaces, follow `docs/CARE_VIDEO_MEDIA.md`.
Do not represent the animated fallback as a real cinematic video.

## Release-blocking QA
1. Apply additive D1 migrations 0007 through 0010 in isolated staging, including notifications and time-off. Never drop production databases.
2. Confirm independent caregiver is unapproved, unverified and hidden until an authorized approval.
3. Confirm two family booking requests cannot both be accepted for overlapping accepted care; blocked caregiver hours reject both pending requests and acceptance.
4. Confirm no one can read or mark another participant's notifications and messages.
5. Test email/push as **unavailable**; in-app notification is the only enabled delivery channel. Notifications require signed-in access.
6. Complete one real customer booking, acceptance, start and completion; verify the profile and review screens.
7. Review desktop/mobile customer, caregiver, organization and superadmin: screen 320px, 390px, 768px, 1440px; ensure discoverable actions without excessive scrolling.
8. Run `npm run typecheck`, `npm run test:d1`, `npm run test:unit -- --silent`, `npm run lint`, browser journeys and isolated signed-in visual QA.
9. Verify build/release dry run and the Cloudflare/D1 binding policy. Production rollout needs explicit reviewed release evidence and should not bypass checks.

## Work remaining for a true full-featured care platform
- Original/licensed cinematic footage, captions if it conveys information, media compression.
- Production-ready transactional email and push consent/delivery, beyond in-app alerts.
- Calendar recurrence generation, availability management by care organizations, reminder preferences.
- Verified payment gateway onboarding, refunds, invoice receipts and regulatory assessment for Nepal.
- Family accounts, emergency escalation/support workflows and deeper mobile QA.
These are NOT silently enabled or claimed as complete by this change.
