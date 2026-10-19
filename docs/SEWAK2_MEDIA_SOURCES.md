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

A six-second illustrated MP4 exists at `public/videos/sewak-care-hero.mp4`. It is not cinematic live-action footage. Do **not** falsely represent it as live-action or present the Care.com reference recording as commercial media.

The shared `CareHeroMedia` supports a licensed MP4 supplied by `REACT_APP_SEWAK_HERO_VIDEO_URL`. Before claiming Sewak 2.0's cinematic heroes are complete, provide/approve appropriately licensed, short 720p/1080p caregiving footage, self-host `public/videos/sewak-care-hero.mp4` (after removing the illustrated placeholder), set the build-time URL if needed, and verify public, user, caregiver, organization, superadmin with muted autoplay, poster, pause, reduced-motion, network failure and mobile performance.

Example potential footage to review for rights, tone and download options: Pexels/Kampus Production https://www.pexels.com/video/a-woman-taking-good-care-of-an-elderly-lady-7517384/ . This footage is NOT included or deployed by this branch.

## Release gates

- Public and account screens have different structures from the legacy UI; compare desktop/mobile screenshots from actual rendered builds.
- Run `npm ci`, `npm run lint`, `npm run test:unit`, `npm run build:release`, `npm run test:browser`.
- Verify full real booking request → caregiver acceptance and profile verification status, caregiver opportunities, organization teams, superadmin moderation, in-app messaging, protected roles.
- Check width 320/390/768/1024/1440/1920, tap targets, labels, focus, reduced-motion, slow network, and image/video fallback.
- Review Cloudflare CSP and external media reliability. Do not merge/deploy before these conditions are satisfied.

This is the FIRST visual implementation pass, NOT a completed Care.com-equivalent rebuild. Remaining work includes deeper role-by-role page/component replacements, media hosting and end-to-end signed-in QA.
