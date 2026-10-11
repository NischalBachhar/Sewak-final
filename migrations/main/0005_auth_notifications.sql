-- Additive only. NULL explicitly means ownership has not been established.
ALTER TABLE cf_credentials ADD COLUMN email_verified_at INTEGER;
CREATE TABLE cf_email_tokens (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES cf_credentials(user_id),
 token_hash TEXT NOT NULL UNIQUE, purpose TEXT NOT NULL CHECK(purpose IN ('verify','reset','change_email')),
 email TEXT NOT NULL, credential_version INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL, used_at INTEGER
);
CREATE INDEX cf_email_tokens_user ON cf_email_tokens(user_id,purpose,created_at);
CREATE TABLE cf_oauth_states (
 state_hash TEXT PRIMARY KEY, nonce TEXT NOT NULL, verifier TEXT NOT NULL,
 browser_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('user','orgadmin')),
 expires_at INTEGER NOT NULL
);
CREATE TABLE cf_oauth_identities (
 provider TEXT NOT NULL CHECK(provider='google'), subject TEXT NOT NULL,
 user_id TEXT NOT NULL REFERENCES cf_credentials(user_id), PRIMARY KEY(provider,subject), UNIQUE(provider,user_id)
);
CREATE TABLE notification_preferences (
 user_id TEXT PRIMARY KEY REFERENCES users(id), preferences_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(preferences_json)),
 language TEXT NOT NULL DEFAULT 'en', updated_at INTEGER NOT NULL
);
CREATE TABLE notifications (
 id TEXT PRIMARY KEY, recipient_id TEXT NOT NULL REFERENCES users(id), organization_id TEXT,
 event_type TEXT NOT NULL, entity_id TEXT NOT NULL, category TEXT NOT NULL,
 title TEXT NOT NULL, message TEXT NOT NULL, target TEXT NOT NULL DEFAULT '/',
 priority INTEGER NOT NULL DEFAULT 5, created_at INTEGER NOT NULL DEFAULT(unixepoch()), read_at INTEGER,
 idempotency_key TEXT NOT NULL UNIQUE
);
CREATE INDEX notifications_inbox ON notifications(recipient_id,created_at DESC,id DESC);
CREATE INDEX notifications_unread ON notifications(recipient_id,read_at);
CREATE TABLE push_subscriptions (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES cf_credentials(user_id),
 endpoint_hash TEXT NOT NULL UNIQUE, encrypted_subscription TEXT NOT NULL, device_label TEXT NOT NULL,
 credential_version INTEGER NOT NULL, created_at INTEGER NOT NULL, last_success_at INTEGER, revoked_at INTEGER
);
CREATE INDEX push_subscriptions_user ON push_subscriptions(user_id,revoked_at);
CREATE TABLE notification_outbox (
 id TEXT PRIMARY KEY, notification_id TEXT REFERENCES notifications(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id), channel TEXT NOT NULL CHECK(channel IN ('email','push')),
 subscription_id TEXT REFERENCES push_subscriptions(id), encrypted_payload TEXT,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','accepted','delivered','temporary_failure','permanent_failure','deferred_quota','suppressed')),
 priority INTEGER NOT NULL DEFAULT 5, provider_reference TEXT, attempt_count INTEGER NOT NULL DEFAULT 0,
 next_attempt_at INTEGER NOT NULL DEFAULT(unixepoch()), lease_until INTEGER, lease_token TEXT,
 last_error_code TEXT, idempotency_key TEXT NOT NULL UNIQUE,
 created_at INTEGER NOT NULL DEFAULT(unixepoch()), updated_at INTEGER NOT NULL DEFAULT(unixepoch()), expires_at INTEGER NOT NULL,
 first_attempt_at INTEGER
);
CREATE INDEX notification_outbox_due ON notification_outbox(status,next_attempt_at,priority);
CREATE TABLE email_quota (bucket TEXT PRIMARY KEY, used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE notification_jobs (name TEXT PRIMARY KEY, lease_until INTEGER NOT NULL);
CREATE TABLE email_webhook_receipts (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL);

-- All event and initial delivery records participate in the domain transaction.
-- Payloads contain no care notes, addresses, names of care recipients or medical data.
CREATE TRIGGER notification_delivery AFTER INSERT ON notifications BEGIN
 INSERT INTO notification_outbox(id,notification_id,user_id,channel,priority,idempotency_key,expires_at)
 VALUES(NEW.id||':email',NEW.id,NEW.recipient_id,'email',NEW.priority,NEW.id||':email',unixepoch()+604800);
 INSERT INTO notification_outbox(id,notification_id,user_id,channel,subscription_id,priority,idempotency_key,expires_at)
 SELECT NEW.id||':'||p.id,NEW.id,NEW.recipient_id,'push',p.id,NEW.priority,NEW.id||':'||p.id,unixepoch()+86400
 FROM push_subscriptions p WHERE p.user_id=NEW.recipient_id AND p.revoked_at IS NULL;
END;

CREATE VIEW booking_notification_participants AS
 SELECT b.id booking_id,b.user_id recipient_id,'user' participant_role,b.organization_id FROM bookings b JOIN users u ON u.id=b.user_id
 UNION SELECT b.id,b.caregiver_id,'caregiver',b.organization_id FROM bookings b JOIN users u ON u.id=b.caregiver_id
 UNION SELECT b.id,o.admin_uid,'orgadmin',b.organization_id FROM bookings b JOIN organizations o ON o.id=b.organization_id JOIN users u ON u.id=o.admin_uid;

CREATE TRIGGER booking_requested_notification AFTER INSERT ON bookings WHEN NEW.status='pending' BEGIN
 INSERT OR IGNORE INTO notifications(id,recipient_id,organization_id,event_type,entity_id,category,title,message,target,priority,idempotency_key)
 SELECT 'booking:'||NEW.id||':requested:'||p.recipient_id,p.recipient_id,NEW.organization_id,'booking_requested',NEW.id,'booking',
 'Booking request received',CASE WHEN p.participant_role='user' THEN 'Your Sewak booking request has been received. We are waiting for the caregiver to respond.' ELSE 'A booking request is waiting for an authorized caregiver response.' END,
 CASE p.participant_role WHEN 'user' THEN '/user/bookings/'||NEW.id WHEN 'caregiver' THEN '/caregiver/jobs' ELSE '/organization/dashboard' END,4,'booking:'||NEW.id||':requested:'||p.recipient_id
 FROM booking_notification_participants p JOIN users u ON u.id=p.recipient_id WHERE p.booking_id=NEW.id;
END;
CREATE TRIGGER booking_status_notification AFTER UPDATE OF status ON bookings WHEN NEW.status<>OLD.status BEGIN
 INSERT OR IGNORE INTO notifications(id,recipient_id,organization_id,event_type,entity_id,category,title,message,target,priority,idempotency_key)
 SELECT 'booking:'||NEW.id||':'||NEW.status||':'||p.recipient_id,p.recipient_id,NEW.organization_id,'booking_'||NEW.status,NEW.id,
 CASE WHEN NEW.status IN ('in_progress','completed') THEN 'care' ELSE 'booking' END,
 CASE NEW.status WHEN 'accepted' THEN 'Booking confirmed' WHEN 'confirmed' THEN 'Booking confirmed' WHEN 'cancelled' THEN 'Booking cancelled or declined' WHEN 'in_progress' THEN 'Care session started' WHEN 'completed' THEN 'Care session completed' ELSE 'Booking updated' END,
 CASE NEW.status WHEN 'accepted' THEN 'Your Sewak booking has been confirmed.' WHEN 'confirmed' THEN 'Your Sewak booking has been confirmed.' WHEN 'cancelled' THEN 'This booking is cancelled or declined and is not confirmed.' WHEN 'in_progress' THEN 'Your care session has started.' WHEN 'completed' THEN 'Your care session has been completed.' ELSE 'Sign in to view your booking status.' END,
 CASE p.participant_role WHEN 'user' THEN '/user/bookings/'||NEW.id WHEN 'caregiver' THEN '/caregiver/jobs' ELSE '/organization/dashboard' END,3,'booking:'||NEW.id||':'||NEW.status||':'||p.recipient_id
 FROM booking_notification_participants p JOIN users u ON u.id=p.recipient_id WHERE p.booking_id=NEW.id;
 INSERT OR IGNORE INTO notifications(id,recipient_id,organization_id,event_type,entity_id,category,title,message,target,priority,idempotency_key)
 SELECT 'review-invite:'||NEW.id,NEW.user_id,NEW.organization_id,'review_invitation',NEW.id,'reviews','How was your service?','Your completed service is eligible for a verified review.','/user/bookings/'||NEW.id,7,'review-invite:'||NEW.id
 WHERE NEW.status='completed' AND NOT EXISTS(SELECT 1 FROM reviews WHERE booking_id=NEW.id);
END;
CREATE TRIGGER care_update_notification AFTER INSERT ON care_updates WHEN NEW.type='milestone' BEGIN
 INSERT OR IGNORE INTO notifications(id,recipient_id,organization_id,event_type,entity_id,category,title,message,target,priority,idempotency_key)
 SELECT 'care-update:'||NEW.id,s.customer_id,s.organization_id,'care_update',s.booking_id,'care','Care session update','A care milestone is available. Sign in to view it.','/user/bookings/'||s.booking_id,6,'care-update:'||NEW.id
 FROM care_sessions s WHERE s.id=NEW.session_id;
END;
CREATE TRIGGER verified_review_notification AFTER INSERT ON reviews WHEN NEW.is_verified_review=1 AND COALESCE(NEW.is_hidden,0)=0 BEGIN
 INSERT OR IGNORE INTO notifications(id,recipient_id,organization_id,event_type,entity_id,category,title,message,target,priority,idempotency_key)
 SELECT 'review:'||NEW.id||':'||p.recipient_id,p.recipient_id,p.organization_id,'verified_review',NEW.booking_id,'reviews','New verified review','A customer has published a verified service review.',CASE p.participant_role WHEN 'caregiver' THEN '/caregiver/profile' ELSE '/organization/dashboard' END,7,'review:'||NEW.id||':'||p.recipient_id
 FROM booking_notification_participants p WHERE p.booking_id=NEW.booking_id AND p.participant_role<>'user' AND EXISTS(SELECT 1 FROM bookings b WHERE b.id=NEW.booking_id AND b.status='completed' AND b.user_id=NEW.customer_id AND b.caregiver_id=NEW.caregiver_id);
END;
CREATE TRIGGER verified_review_published_notification AFTER UPDATE OF is_verified_review,is_hidden ON reviews WHEN NEW.is_verified_review=1 AND COALESCE(NEW.is_hidden,0)=0 AND (COALESCE(OLD.is_verified_review,0)<>1 OR OLD.is_hidden=1) BEGIN
 INSERT OR IGNORE INTO notifications(id,recipient_id,organization_id,event_type,entity_id,category,title,message,target,priority,idempotency_key)
 SELECT 'review:'||NEW.id||':'||p.recipient_id,p.recipient_id,p.organization_id,'verified_review',NEW.booking_id,'reviews','New verified review','A customer has published a verified service review.',CASE p.participant_role WHEN 'caregiver' THEN '/caregiver/profile' ELSE '/organization/dashboard' END,7,'review:'||NEW.id||':'||p.recipient_id
 FROM booking_notification_participants p WHERE p.booking_id=NEW.booking_id AND p.participant_role<>'user' AND EXISTS(SELECT 1 FROM bookings b WHERE b.id=NEW.booking_id AND b.status='completed' AND b.user_id=NEW.customer_id AND b.caregiver_id=NEW.caregiver_id);
END;
CREATE TRIGGER application_notification AFTER INSERT ON organization_applications BEGIN
 INSERT OR IGNORE INTO notifications(id,recipient_id,organization_id,event_type,entity_id,category,title,message,target,priority,idempotency_key)
 SELECT 'application:'||NEW.id||':'||u.id,u.id,NEW.id,'organization_application',NEW.id,'applications','Organization application','An organization application is ready for review.','/superadmin/organizations',5,'application:'||NEW.id||':'||u.id FROM users u WHERE u.role='superadmin' AND COALESCE(u.is_suspended,0)=0;
END;
CREATE TRIGGER application_decision_notification AFTER UPDATE OF status ON organization_applications WHEN NEW.status<>OLD.status BEGIN
 INSERT OR IGNORE INTO notifications(id,recipient_id,organization_id,event_type,entity_id,category,title,message,target,priority,idempotency_key)
 VALUES('application:'||NEW.id||':'||NEW.status,NEW.applicant_id,NEW.id,'application_'||NEW.status,NEW.id,'applications','Application status updated','Sign in to view the decision on your application.','/organization/profile',4,'application:'||NEW.id||':'||NEW.status);
END;
CREATE TRIGGER caregiver_application_notification AFTER INSERT ON caregivers BEGIN
 INSERT OR IGNORE INTO notifications(id,recipient_id,organization_id,event_type,entity_id,category,title,message,target,priority,idempotency_key)
 SELECT 'caregiver-application:'||NEW.id||':'||u.id,u.id,NEW.organization_id,'caregiver_application',NEW.id,'applications','Provider review needed','A caregiver or household worker profile is ready for review.','/superadmin/caregivers',5,'caregiver-application:'||NEW.id||':'||u.id FROM users u WHERE u.role='superadmin' AND COALESCE(u.is_suspended,0)=0;
END;
CREATE TRIGGER caregiver_approval_notification AFTER UPDATE OF is_approved ON caregivers WHEN NEW.is_approved IS NOT OLD.is_approved BEGIN
 INSERT OR IGNORE INTO notifications(id,recipient_id,organization_id,event_type,entity_id,category,title,message,target,priority,idempotency_key)
 SELECT 'caregiver-approval:'||NEW.id||':'||NEW.version,NEW.id,NEW.organization_id,'provider_approval',NEW.id,'applications','Provider approval updated','Sign in to view your provider approval status.','/caregiver/profile',4,'caregiver-approval:'||NEW.id||':'||NEW.version FROM users u WHERE u.id=NEW.id;
END;
CREATE TRIGGER password_security_notification AFTER UPDATE OF password_changed_at ON cf_credentials WHEN NEW.password_changed_at IS NOT OLD.password_changed_at BEGIN
 UPDATE push_subscriptions SET revoked_at=unixepoch() WHERE user_id=NEW.user_id AND revoked_at IS NULL;
 INSERT OR IGNORE INTO notifications(id,recipient_id,event_type,entity_id,category,title,message,priority,idempotency_key)
 VALUES('password:'||NEW.user_id||':'||NEW.credential_version,NEW.user_id,'password_changed',NEW.user_id,'security','Password changed','Your Sewak password was changed. Contact Sewak support if you did not make this change.',1,'password:'||NEW.user_id||':'||NEW.credential_version);
END;
CREATE TRIGGER account_disabled_push AFTER UPDATE OF disabled ON cf_credentials WHEN NEW.disabled=1 BEGIN
 UPDATE push_subscriptions SET revoked_at=unixepoch() WHERE user_id=NEW.user_id AND revoked_at IS NULL;
END;
CREATE TRIGGER email_security_notification AFTER UPDATE OF email ON cf_credentials WHEN NEW.email<>OLD.email BEGIN
 INSERT OR IGNORE INTO notifications(id,recipient_id,event_type,entity_id,category,title,message,priority,idempotency_key)
 VALUES('email:'||NEW.user_id||':'||NEW.credential_version,NEW.user_id,'email_changed',NEW.user_id,'security','Email address changed','Your Sewak email address was changed after ownership verification.',1,'email:'||NEW.user_id||':'||NEW.credential_version);
END;
CREATE TRIGGER organization_approval_notification AFTER UPDATE OF is_approved ON organizations WHEN NEW.is_approved IS NOT OLD.is_approved BEGIN
 INSERT OR IGNORE INTO notifications(id,recipient_id,organization_id,event_type,entity_id,category,title,message,target,priority,idempotency_key)
 VALUES('organization-approval:'||NEW.id||':'||NEW.version,NEW.admin_uid,NEW.id,'organization_approval',NEW.id,'applications','Organization approval updated','Sign in to view your organization approval status.','/organization/profile',4,'organization-approval:'||NEW.id||':'||NEW.version);
END;
CREATE TRIGGER admin_security_notification AFTER INSERT ON admin_audit_logs WHEN NEW.action IN ('account_safety_action_applied','account_recovery_issued','superadmin_bootstrap_completed','superadmin_password_recovered') BEGIN
 INSERT OR IGNORE INTO notifications(id,recipient_id,event_type,entity_id,category,title,message,target,priority,idempotency_key)
 SELECT 'security-audit:'||NEW.id||':'||u.id,u.id,'security_audit',NEW.id,'security','Security action recorded','An important account security or safety action was recorded. Review the authorized audit trail.','/superadmin',1,'security-audit:'||NEW.id||':'||u.id
 FROM users u WHERE u.role='superadmin' AND COALESCE(u.is_suspended,0)=0;
END;
