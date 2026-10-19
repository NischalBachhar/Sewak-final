# Sewak care-marketplace redesign

This change gives Sewak an original, consistent visual system influenced by publicly documented Care.com design principles, not a pixel-for-pixel copy.

## Reference patterns
- Clear care-first homepage and search: https://www.care.com/
- Calm green palette, modern layout, warm imagery: https://www.care.com/about/new-chapter-for-care/
- Profile-led discovery, filtering, and caregiver comparisons: https://help.care.com/s/article/How-do-I-find-a-caregiver?language=en_US
- Simple authentication entry: https://www.care.com/login

## Implemented surfaces
- New Sewak house-and-heart mark, accessible public navigation and responsive menu.
- Search-first public landing hero, functional category links, discovery form, caregiver cards, services, guidance and partner invitation.
- URL-driven category and schedule shortcuts on the public browse page.
- Cohesive tokens and page-level styling for browsing, caregiver profiles, customer discovery and booking activity, sign-in, signup, caregiver and organization workspaces, and superadmin workspace.
- Existing Cloudflare D1/auth, pricing, permissions, booking confirmation and verification semantics are unchanged.

## Important distinctions
- This is a design-system and presentation refresh. It does not add Care.com membership plans, chat, background checks, job posting or payment features.
- Profile ratings, verification, availability and prices must continue to come from Sewak's real API. No fabricated testimonials, user counts, or caregiver inventory.
- The public hero uses the existing Sewak illustration. No Care.com images, logos, fonts or protected assets are copied.

## QA before release
1. Run npm ci and npm run lint.
2. Run npm run test:unit -- --silent and npm run test:browser.
3. Run npm run build:release with the reviewed canonical origin.
4. Visual QA at 360, 390, 768, 1024 and 1440 pixels: public homepage, browse/search, profile, sign-in, signup, customer, caregiver, organization, and superadmin.
5. Verify keyboard focus, mobile menu, form validation, empty/loading/error states, color contrast, reduced motion and no horizontal overflow.
6. Check Cloudflare D1 booking/auth flows, including roles and denied access, in a nonproduction environment before deploying.

No production deployment is performed by this change.
