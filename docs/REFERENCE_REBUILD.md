# Sewak reference-video redesign

Reference recording: "Recording 2026-10-19 103329(1).mp4" (63 seconds).
Research: Care.com public navigation, landing, category landing pages, signup entry, and official feature/safety documentation.

## Implemented in this branch
- Replaces Sewak's public homepage design: full-bleed cinematic rotating family/care photography with a readable overlay, overlaid responsive navigation, mega menus, search and a three-step explanation.
- Builds distinct original vector care-category illustrations; service/topic sections, interactive feature carousel, live public caregiver cards, care/safety copy, how-it-works and a multi-column evergreen footer.
- Adds an accessible two-choice account-purpose dialog, with organization onboarding taking the existing supported route; no unsupported individual caregiver registration is implied.
- Redesigns signed-in customer start, filters, larger cards, shortlist-on-this-device, and care booking activity. Existing backend controls remain authoritative.
- Replaces the global look of public browsing, profiles, booking forms and status, caregiver/organization/admin shells and login/signup.
- The reference's *video footage is not reused*: the cinematic effect is an accessible slow-photo crossfade until Sewak owns licensed video suitable for self-hosting. All hero/category copy and illustrations are original Sewak assets.

## Photography attribution and license
Photographs are from Pexels (https://www.pexels.com/license/), used as illustrative imagery, not caregivers endorsing Sewak. Images are fetched over HTTPS directly from images.pexels.com and specifically allowlisted under CSP img-src. If Pexels external hosting is blocked, background falls back to a dark green surface.

- Hero: Jsme MILA (#29372727), Annushka Ahuja (#8055794), Mikhail Nilov (#8307542)
- Additional editorial card: Jsme MILA (#29372536)
- Care-category illustrations: original generated project SVG code, not Care.com assets.

For production, obtain original Nepal-specific photographs with appropriate model releases, self-host in Cloudflare Assets, and remove the external image dependency. Prefer an original, compressed muted/looped hero video with a still poster if motion is needed.

## Backend/functional integrity
Do not delete the repository, Cloudflare Worker, D1 database, authorization logic, booking lifecycle, verification evidence, or history. The customer action is a *booking request* awaiting caregiver acceptance, not instant confirmation. The feature carousel does not pretend that Sewak has Care.com membership or video-call subscriptions.

The reference's secure messaging, automatic background checks, caregiver self-onboarding, video calls, membership payments and job applications are **not implemented** by this visual redesign. They require separately reviewed Cloudflare Worker/D1 APIs, participant permissions, safe migrations, moderation and tests before being presented as real buttons.

## Release and QA
Review CI lint, typecheck, unit, D1 and Playwright journeys. Visually verify at 360, 390, 768, 1280, and 1440 pixels, with reduced motion and keyboard interaction. Confirm local photo permissions and Pexels accessibility. Do not mark the project production-ready or merge/deploy merely because unit tests pass; complete signed-in visual QA first.
