-- 0005 is reserved for the separate auth/notification feature branch.
CREATE TABLE verification_records (
 caregiver_id TEXT NOT NULL REFERENCES caregivers(id),
 kind TEXT NOT NULL CHECK(kind IN ('identity','phone','training','background','references')),
 status TEXT NOT NULL CHECK(status IN ('not_submitted','pending','under_review','more_information_required','verified','rejected','expired','revoked')),
 version INTEGER NOT NULL DEFAULT 1,
 submission_id TEXT,
 verified_decision_id TEXT,
 submitted_at TEXT,
 updated_at TEXT NOT NULL,
 verified_at TEXT,
 expires_at TEXT,
 phone_snapshot TEXT,
 police_requested INTEGER NOT NULL DEFAULT 0 CHECK(police_requested IN (0,1)),
 police_verified INTEGER NOT NULL DEFAULT 0 CHECK(police_verified IN (0,1)),
 PRIMARY KEY(caregiver_id,kind)
);
CREATE INDEX verification_queue ON verification_records(status,updated_at,caregiver_id);
CREATE INDEX verification_expiry ON verification_records(status,expires_at);
CREATE TABLE verification_submissions (
 id TEXT PRIMARY KEY,
 caregiver_id TEXT NOT NULL REFERENCES caregivers(id),
 kind TEXT NOT NULL,
 request_id TEXT NOT NULL,
 details BLOB,
 created_at TEXT NOT NULL,
 retain_until TEXT NOT NULL,
 consent_version TEXT NOT NULL,
 UNIQUE(caregiver_id,request_id)
);
CREATE INDEX verification_submission_owner ON verification_submissions(caregiver_id,kind,created_at);
CREATE INDEX verification_submission_retention ON verification_submissions(retain_until);
CREATE TABLE verification_evidence (
 id TEXT PRIMARY KEY,
 caregiver_id TEXT NOT NULL REFERENCES caregivers(id),
 kind TEXT NOT NULL,
 submission_id TEXT REFERENCES verification_submissions(id),
 state TEXT NOT NULL CHECK(state IN ('uploading','ready','attached','deleting','deleted')),
 mime TEXT NOT NULL,
 size INTEGER NOT NULL CHECK(size BETWEEN 1 AND 500000),
 width INTEGER NOT NULL,
 height INTEGER NOT NULL,
 created_at TEXT NOT NULL,
 retain_until TEXT NOT NULL
);
CREATE INDEX verification_evidence_owner ON verification_evidence(caregiver_id,state);
CREATE INDEX verification_evidence_submission ON verification_evidence(submission_id,state);
CREATE INDEX verification_evidence_retention ON verification_evidence(state,retain_until);
CREATE TABLE verification_decisions (
 id TEXT PRIMARY KEY,
 caregiver_id TEXT NOT NULL,
 kind TEXT NOT NULL,
 submission_id TEXT NOT NULL REFERENCES verification_submissions(id),
 reviewer_id TEXT NOT NULL REFERENCES users(id),
 decision TEXT NOT NULL,
 method TEXT NOT NULL,
 details BLOB,
 created_at TEXT NOT NULL,
 expires_at TEXT
);
CREATE INDEX verification_decision_owner ON verification_decisions(caregiver_id,kind,created_at);
CREATE TABLE verification_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 caregiver_id TEXT NOT NULL,
 kind TEXT NOT NULL,
 submission_id TEXT,
 actor_id TEXT NOT NULL,
 action TEXT NOT NULL,
 version INTEGER NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX verification_audit_owner ON verification_audit(caregiver_id,kind,id);
-- No notification service exists on main. This table is recipient scoped and
-- intentionally has no email/SMS/outbox trigger or external delivery dependency.
CREATE TABLE verification_notifications (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 recipient_id TEXT NOT NULL REFERENCES users(id),
 caregiver_id TEXT NOT NULL,
 kind TEXT NOT NULL,
 status TEXT NOT NULL,
 created_at TEXT NOT NULL,
 read_at TEXT
);
CREATE INDEX verification_notifications_recipient ON verification_notifications(recipient_id,id);
CREATE TRIGGER verification_status_notification AFTER UPDATE OF status,version ON verification_records
BEGIN
 INSERT INTO verification_notifications(recipient_id,caregiver_id,kind,status,created_at)
 SELECT id,NEW.caregiver_id,NEW.kind,NEW.status,NEW.updated_at FROM users
 WHERE (id=NEW.caregiver_id OR role='superadmin') AND COALESCE(is_suspended,0)=0 AND COALESCE(is_blacklisted,0)=0;
END;
CREATE TRIGGER verification_initial_notification AFTER INSERT ON verification_records
BEGIN
 INSERT INTO verification_notifications(recipient_id,caregiver_id,kind,status,created_at)
 SELECT id,NEW.caregiver_id,NEW.kind,NEW.status,NEW.updated_at FROM users
 WHERE (id=NEW.caregiver_id OR role='superadmin') AND COALESCE(is_suspended,0)=0 AND COALESCE(is_blacklisted,0)=0;
END;
CREATE TRIGGER verification_phone_caregiver AFTER UPDATE OF phone ON caregivers
WHEN OLD.phone IS NOT NEW.phone
BEGIN
 UPDATE verification_records SET status='revoked',version=version+1,verified_decision_id=NULL,police_verified=0,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE caregiver_id=NEW.id AND kind='phone' AND status IN ('verified','pending','under_review','more_information_required');
 INSERT INTO verification_audit(caregiver_id,kind,submission_id,actor_id,action,version,created_at)
 SELECT caregiver_id,kind,submission_id,'system','phone_changed',version,updated_at FROM verification_records
 WHERE caregiver_id=NEW.id AND kind='phone' AND changes()>0;
END;
CREATE TRIGGER verification_phone_user AFTER UPDATE OF phone ON users
WHEN OLD.phone IS NOT NEW.phone
BEGIN
 UPDATE verification_records SET status='revoked',version=version+1,verified_decision_id=NULL,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE caregiver_id=NEW.id AND kind='phone' AND status IN ('verified','pending','under_review','more_information_required');
 INSERT INTO verification_audit(caregiver_id,kind,submission_id,actor_id,action,version,created_at)
 SELECT caregiver_id,kind,submission_id,'system','phone_changed',version,updated_at FROM verification_records
 WHERE caregiver_id=NEW.id AND kind='phone' AND changes()>0;
END;
CREATE VIEW verification_public_status AS
 SELECT r.caregiver_id,r.kind,
 CASE WHEN r.status IN ('verified','pending','under_review','more_information_required') AND (r.expires_at IS NOT NULL AND r.expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now')) THEN 'expired'
 WHEN r.status='verified' AND NOT EXISTS(SELECT 1 FROM verification_decisions d WHERE d.id=r.verified_decision_id AND d.caregiver_id=r.caregiver_id AND d.kind=r.kind AND d.submission_id=r.submission_id AND d.decision='verified' AND d.reviewer_id<>r.caregiver_id) THEN 'not_submitted'
 ELSE r.status END AS status,r.verified_at,r.expires_at,r.police_verified,r.police_requested
 FROM verification_records r;
