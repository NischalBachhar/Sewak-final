# Sewak care-marketplace implementation matrix

This is an independent Sewak product; it must not copy Care.com's proprietary assets, UI source, photos, trademarks or wording.

## Implemented on design/care-inspired-sewak-refresh
- Family care job posts, caregiver applications, withdrawal, job closing and applicant view (new Worker API and D1 migration).
- Public browsing and pricing: real service catalog, public caregiver cards, individual profile details, verified review counts, availability disclosures and actual configured NPR rates.
- Care service and safety pages, start-by-role entry, pricing explanation.
- Signed-in customer shortlist (saved caregivers). **Browser-local and user-scoped; not cross-device sync.** Saved profiles are always re-fetched from the published projection.
- Customer booking requests, caregiver acceptance and care-session status, completed-booking reviews (existing D1 backend).
- Organizational caregiver roster, application review and separate superadmin account/workspace permissions (existing D1 backend).
- Mobile-friendly layouts, role-aware navigation, accessible save buttons; no Care.com images or video.

## Still not equivalent to Care.com
- Family job posting and caregiver applications now have protected D1 storage. Candidate ranking, detailed applicant pipeline and service matching are not implemented yet.
- In-app private messaging and notifications for conversations.
- Direct independent caregiver self-signup and approval workflows (current flow uses organization invitation).
- Dedicated category profile creation for each skill and independent provider job searches.
- Customer saved searches and cross-device shortlist (currently only saved profiles per device).
- Optional membership billing, subscriptions, screening vendor integration, payroll, or online payment provider.
- True recommendation ranking, travel distances, background checks and customer service hotline.

These require backend design, D1 migrations, privacy/safety checks, and end-to-end authenticated tests before launch.

## Release gates
- No route, login, data, payment, booking or security permission regressions.
- Tests: frontend lint, unit, typecheck, D1 and Playwright browser; WCAG AA and responsive visual QA.
- Clearly label *requested*, *pending*, *accepted*, *completed*. Never imply that a sent booking request means a confirmed hire.
- Do not deploy or delete the live database or original repository to speed up demo creation.
