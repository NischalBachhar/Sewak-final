# Sewak 2.0 media register and release requirements

This branch intentionally does NOT copy Care.com's code, photos, recordings, trademarks, or proprietary UI.

## Photographs (public illustrative imagery, NOT Sewak providers)

The following third-party photographs are used via resized `images.unsplash.com` URLs and were individually checked as **free to use under the Unsplash License** on 19 October 2026:

1. **Caregiver supporting older woman with walker** — Age Cymru, https://unsplash.com/photos/caregiver-assists-elderly-woman-with-walker-2obyM4zYt3Y
   - Image source: https://images.unsplash.com/photo-1773227055624-07b515ba87c5
   - Used in public hero, caregivers, signup and senior-care story.
2. **Mother reading with daughter** — Vitaly Gariev, https://unsplash.com/photos/mother-and-daughter-reading-a-book-together-on-couch-Ok4b3oDvcvM
   - Image source: https://images.unsplash.com/photo-1758598738003-3c2ea5c8b166
   - Used in family-care story, browse and customer hero.
3. **Nurse smiling with older adult** — Age Cymru, https://unsplash.com/photos/nurse-smiling-with-elderly-patient-in-room-dMhB7w99ju8
   - Image source: https://images.unsplash.com/photo-1765896387387-0538bc9f997e
   - Used in login, organization/admin hero and household-support story.

Unsplash License: https://unsplash.com/license . These photos are contextual illustrations, not real caregiver profiles or endorsements of Sewak. Check license, model releases and third-party hosting terms during production media QA. They are not hosted by Sewak; this branch's CSP narrowly allows `images.unsplash.com`. For a durable release, download permitted optimized renditions, store in `public/images/`, replace external URLs and narrow CSP back to self. On failure, CareHeroMedia and auth components use Sewak's local illustration; photographic story cards have a tinted placeholder.

## Live-action video status

The existing six-second illustrated MP4 at `public/videos/sewak-care-hero.mp4` is **not** live-action footage. No Care.com reference recording was copied.

A provisional free-to-use **nine-second live-action caregiving clip** by Kampus Production from Pexels is now configured as the default video source for `CareHeroMedia` (public and all four signed-in roles) with a photographic fallback:

- Source: https://www.pexels.com/video/a-woman-taking-good-care-of-an-elderly-lady-7517384/
- License: https://www.pexels.com/license/ (reviewed 2026-10-19). The subjects in the clip are actors/stock contributors, **not real Sewak caregivers or endorsers**.
- Preferred preview stream URL: https://videos.pexels.com/video-files/7517384/7517384-hd_1920_1080_25fps.mp4

**Still a release blocker:** This preview URL has not been validated end-to-end in browsers. Cloudflare production must not rely on an unverified third-party video hotlink. Review the file/rights, download a permitted resolution, compress/trim it, self-host on Cloudflare static assets, switch to `/videos/sewak-care-hero.mp4`, and remove the temporary external `media-src` allowlist before production deployment. Confirm desktop/mobile playback, poster, play/pause, reduced-motion settings, load speed and data use. An explicit `REACT_APP_SEWAK_HERO_VIDEO_URL` overrides the preview source.


## Release gates

- Public and account screens have different structures from the legacy UI; compare desktop/mobile screenshots from actual rendered builds.
- Run `npm ci`, `npm run lint`, `npm run test:unit`, `npm run build:release`, `npm run test:browser`.
- Verify full real booking request → caregiver acceptance and profile verification status, caregiver opportunities, organization teams, superadmin moderation, in-app messaging, protected roles.
- Check width 320/390/768/1024/1440/1920, tap targets, labels, focus, reduced-motion, slow network, and image/video fallback.
- Review Cloudflare CSP and external media reliability. Do not merge/deploy before these conditions are satisfied.

This is the FIRST visual implementation pass, NOT a completed Care.com-equivalent rebuild. Remaining work includes deeper role-by-role page/component replacements, media hosting and end-to-end signed-in QA.
