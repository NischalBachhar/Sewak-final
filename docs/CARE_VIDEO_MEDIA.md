# Sewak's cinematic media surfaces

Sewak now offers an optional original/licensed video background on the public caregiver-search hero and on each role's signed-in landing view (customer, caregiver, organization and superadmin).

- Put your **own or properly licensed** 16:9 or 21:9 care footage at `public/videos/sewak-care-hero.mp4`.
- For your reviewed release build, set `REACT_APP_SEWAK_HERO_VIDEO_URL=/videos/sewak-care-hero.mp4`; absent that setting, the existing illustrated Sewak hero renders instead.
- Use a short compressed clip (ideally below 2–3 MB), muted, non-flashing, with no Care.com branding or content.
- Motion is suppressed for visitors with the OS reduced-motion setting.
- No third-party CDN, paid video host, tracking script or remote media is required.
- Video does not cover or replace the real caregiver search/booking controls.

The recorded Care.com walkthrough was **reference material only** and must not be uploaded as Sewak's own commercial footage.

## Original animated Sewak video included in release builds

`npm run build:release` now tries to create a real **six-second muted MP4** from Sewak's original family-care illustration using FFmpeg (a slow Ken Burns move). This is original animated illustration, **not live-action footage** and not a Care.com video. The generated output is `public/videos/sewak-care-hero.mp4`, copied into the release build. The public hero and all four role landing pages share the clip.

- No paid video API, watermarked stock asset, or external download is required.
- This step is optional: when FFmpeg is missing, the normal static hero still works and the build does not fail.
- On a Windows developer machine, install FFmpeg and run `node scripts/generate-care-video.cjs` to create the local MP4.
- A manually supplied licensed file already at `public/videos/sewak-care-hero.mp4` is preserved rather than overwritten.
- The `REACT_APP_SEWAK_HERO_VIDEO_URL` setting can override the generated clip.
- Existing reduced-motion safeguards prevent playback for visitors who request less animation.

The small original illustrated MP4 is now versioned at `public/videos/sewak-care-hero.mp4` so reviewed builds have the same owned media even without FFmpeg. It is six seconds, muted, 960 × 540, and approximately 44 KB. Visitors can pause playback; reduced motion uses the static illustration without mounting a video. Do not commit the reference recording.
