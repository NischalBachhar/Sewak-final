import { Repository, requireActive } from './repository.ts';
import { requireThat, type Actor, type Data } from './types.ts';

// Inbox metadata is derived from the existing private care_messages table.
// Do not persist a second, denormalized conversation-ownership record.
export async function careInboxRoute(repo: Repository, actor: Actor | null) {
  const user = requireActive(actor);
  requireThat(user.role === 'user' || user.role === 'caregiver', 'This inbox is available to customers and caregivers only.');
  const query = `
    SELECT m.kind, m.context_id AS contextId, m.caregiver_id AS caregiverId,
           m.sender_id AS lastSenderId, substr(m.body, 1, 180) AS preview,
           m.created_at AS updatedAt,
           CASE WHEN m.kind='booking'
              THEN COALESCE(NULLIF((SELECT b.service_label FROM bookings b WHERE b.id=m.context_id), ''), 'Care booking')
              ELSE COALESCE(NULLIF((SELECT j.title FROM care_jobs j WHERE j.id=m.context_id), ''), 'Care job')
           END AS title,
           CASE WHEN ?='user'
              THEN COALESCE(NULLIF((SELECT c.name FROM caregivers c WHERE c.id=m.caregiver_id), ''), 'Caregiver')
              ELSE COALESCE(NULLIF((SELECT u.name FROM users u WHERE u.id=m.customer_id), ''), 'Family')
           END AS partnerName
    FROM care_messages m
    WHERE ((?='user' AND m.customer_id=?) OR (?='caregiver' AND m.caregiver_id=?))
      AND (
        (m.kind='booking' AND EXISTS (
          SELECT 1 FROM bookings b WHERE b.id=m.context_id
          AND b.user_id=m.customer_id AND b.caregiver_id=m.caregiver_id
        ))
        OR
        (m.kind='job' AND EXISTS (
          SELECT 1 FROM care_jobs j JOIN care_job_applications a ON a.job_id=j.id
          WHERE j.id=m.context_id AND j.customer_id=m.customer_id
          AND a.caregiver_id=m.caregiver_id AND a.status='applied'
        ))
      )
      AND NOT EXISTS (
        SELECT 1 FROM care_messages newer
        WHERE newer.kind=m.kind AND newer.context_id=m.context_id
          AND newer.caregiver_id=m.caregiver_id AND newer.customer_id=m.customer_id
          AND (newer.created_at>m.created_at OR
               (newer.created_at=m.created_at AND newer.id>m.id))
      )
    ORDER BY m.created_at DESC, m.id DESC LIMIT 60
  `;
  const result = await repo.env.DB.prepare(query)
    .bind(user.role, user.role, user.uid, user.role, user.uid).all<Data>();
  return { conversations: result.results };
}
