# Sewak dashboard UI refinement

The customer homepage now prioritizes an active request or upcoming visit, with the shared caregiver cards immediately after it. Search starts with service and city; price, category and availability remain in expandable filters. All cards use “Request availability.”

Caregiver overview puts request review and confirmed upcoming work first. Pending requests do not appear as confirmed visits. Job cards keep care requirements visible before decisions, with payment and booking metadata expandable. Organization overview prioritizes operational shortcuts, and mobile booking rows become labelled cards with working details dialogs. Superadmin review queues precede metrics; listing maintenance is collapsed and superadmin access labels are explicit.

All four role overviews retain a compact cinematic section after their work content. Mobile section pickers expose the existing authorized sections. The booking banner contrast is corrected. Public stories are shorter and the full service catalog is expandable. Empty care searches offer a care-job route that survives sign-in. Login copy accommodates all roles.

## Previews

The images use isolated synthetic accounts and records from the repository’s D1 fixture server, at 1440×900 and 390×844. They are not screenshots of production accounts.

- [Desktop role overviews](desktop.jpg)
- [Mobile role overviews](mobile.jpg)

## Validation

- 115 frontend unit tests; Worker typecheck and lint.
- 44 accessibility route/viewport checks across public, customer, caregiver, organization and superadmin screens.
- Existing public search, pricing, filtering, booking preferences and responsive UI checks.
- New priority ordering, section navigation, organization booking details, banner contrast and empty-search sign-in destination checks.
- Eight role video playback/pause/reduced-motion checks.
- Complete isolated D1 request → caregiver acceptance/start/completion → verified-review journey.
- 22 private screens rendered at desktop/mobile widths, without page errors or horizontal page overflow.
- Canonical production build, guarded Cloudflare dry run and release scan.

Production has not been deployed as part of this change. The existing four account roles and server permissions remain authoritative; this change does not introduce a separate staff-admin role or modify database schemas.
