# Sewak media register and release requirements

This branch intentionally does NOT copy Care.com's code, photos, recordings, trademarks, or proprietary UI.

## Photographs (public illustrative imagery, NOT Sewak providers)

The following third-party photographs are bundled as optimized same-origin WebP assets and were individually checked as **free to use under the Unsplash License** on 19 October 2026:

1. **Caregiver supporting older woman with walker** — Age Cymru, https://unsplash.com/photos/caregiver-assists-elderly-woman-with-walker-2obyM4zYt3Y
   - Image source: https://images.unsplash.com/photo-1773227055624-07b515ba87c5
   - Used in public hero, caregivers, signup and senior-care story.
2. **Mother reading with daughter** — Vitaly Gariev, https://unsplash.com/photos/mother-and-daughter-reading-a-book-together-on-couch-Ok4b3oDvcvM
   - Image source: https://images.unsplash.com/photo-1758598738003-3c2ea5c8b166
   - Used in family-care story, browse and customer hero.
3. **Nurse smiling with older adult** — Age Cymru, https://unsplash.com/photos/nurse-smiling-with-elderly-patient-in-room-dMhB7w99ju8
   - Image source: https://images.unsplash.com/photo-1765896387387-0538bc9f997e
   - Used in login, organization/admin hero and household-support story.

Unsplash License: https://unsplash.com/license . These photos are contextual illustrations, not real caregiver profiles or endorsements of Sewak. The source pages and free-use licenses were checked again for this release. Optimized renditions are stored in `public/images/sewak2-senior-care.webp` (79,364 bytes), `sewak2-family-care.webp` (156,900 bytes), and `sewak2-care-team.webp` (57,238 bytes). All photo components use these same-origin assets; the CSP permits images only from self, blob and data. Existing local illustration fallbacks remain available.

## Self-hosted live-action video

The earlier six-second illustrated MP4 has been replaced by the licensed nine-second live-action clip below. No Care.com reference recording was copied.

The free-to-use nine-second caregiving clip by Kampus Production from Pexels is optimized and bundled for public and all four signed-in roles, with photographic/static fallbacks.

- Source: https://www.pexels.com/video/a-woman-taking-good-care-of-an-elderly-lady-7517384/
- License: https://www.pexels.com/license/ (reviewed 2026-10-19). The subjects in the clip are actors/stock contributors, **not real Sewak caregivers or endorsers**.
- Preferred preview stream URL: https://videos.pexels.com/video-files/7517384/7517384-hd_1920_1080_25fps.mp4

The source page and Pexels license were rechecked on 19 October 2026. The downloaded 1080p source was converted to a muted H.264/yuv420p, 960x540, 24 fps, fast-start MP4 at `public/videos/sewak-care-hero.mp4` (396,633 bytes). The default component, browser-test build and production build all use the self-hosted asset. The temporary external media allowlist is removed; `media-src` is self only. Playback, pause/resume, reduced motion, failed-media fallback and responsive/accessibility checks are required in local and live QA. `REACT_APP_SEWAK_HERO_VIDEO_URL` remains an explicit build override.


## Release gates

- Public and account screens have different structures from the legacy UI; compare desktop/mobile screenshots from actual rendered builds.
- Run `npm ci`, `npm run lint`, `npm run test:unit`, `npm run build:release`, `npm run test:browser`.
- Verify full real booking request → caregiver acceptance and profile verification status, caregiver opportunities, organization teams, superadmin moderation, in-app messaging, protected roles.
- Check width 320/390/768/1024/1440/1920, tap targets, labels, focus, reduced-motion, slow network, and image/video fallback.
- Review Cloudflare CSP and external media reliability. Do not merge/deploy before these conditions are satisfied.

The merged Sewak design is retained. See the production release report for version-matched local and live validation results and operational limits.
