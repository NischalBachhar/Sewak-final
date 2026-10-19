# Sewak marketplace feature matrix

Current implementation is based on merged PR #43 (`8c5875f`). Release status and current validation are recorded in `MARKETPLACE-PRODUCTION-RELEASE.md`; this matrix describes application capability, not deployment completion.

| Area | Integrated behavior | Contract and limits |
| --- | --- | --- |
| Customers | Real D1 caregiver discovery, filters, prices, profiles, saved caregivers, booking requests, cancellations, history, verified completed-booking reviews, care jobs and applications | Shortlists are scoped to the signed-in user in this browser. They are not synchronized across devices. |
| Caregivers | Independent signup, profile editing, private verification submission, approval, job applications, booking acceptance and care shifts, time off, weekly hours, calendar and recorded earnings | Pending applicants remain unpublished. Verification badges require audited decisions. Recorded cash earnings are not payment or payout confirmation. |
| Organizations | Registration and approval, invited team accounts, profile and explicit service assignments, team management, booking history, scheduling overview and notifications | Caregiver consent and the existing booking lifecycle remain authoritative. Organization staff cannot silently replace a family's selected caregiver on an existing booking. |
| Superadmin | Organization approval/rejection/blacklist/tombstone deletion, caregiver approval and restrictions, customer/caregiver account management, verification review, moderation and paginated audit log | Caregiver approval updates profile, listing, audit and notification atomically. Deletion revokes access and preserves historical data. |
| Messaging | Participant-only D1 booking and job conversations, private inbox and recipient notifications | Manual refresh; no public chat, email or push delivery. Old/withdrawn job application permissions remain enforced. |
| Notifications | Private in-app list, unread count, mark-read actions, approval/booking/job/message events, idempotent reminders and per-recipient reminder preferences | Essential lifecycle updates remain available. Email and Web Push are explicitly disabled. |
| Scheduling | Atomic overlap guards for requests and acceptance, overnight booking checks, time off, optional weekly working windows and Nepal date boundaries | Recurring weekly availability is supported. A recurring booking request does not automatically create an unlimited series of visits. |
| Membership/payment | D1 Free/Plus Preview preference, explicit NPR 0 demo acknowledgement and cash booking | No charges, subscription, premium entitlement or fake payment success. |
| Media/accessibility | Original six-second illustrated MP4 on public and role landing pages, pause/play, static error fallback and reduced-motion fallback | No Care.com assets or footage. Video is decorative, muted and approximately 44 KB. |

No fabricated caregivers, prices, ratings, reviews, verification decisions or successful payments are supplied to production. Synthetic fixtures are limited to explicit QA and are identified and cleaned by the operator tools.
