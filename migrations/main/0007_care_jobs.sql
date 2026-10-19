CREATE TABLE IF NOT EXISTS care_jobs(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,description TEXT NOT NULL,category TEXT NOT NULL CHECK(category IN ('caregiver','household')),city TEXT NOT NULL,schedule TEXT NOT NULL CHECK(schedule IN ('one_time','recurring','flexible')),hourly_budget REAL,status TEXT NOT NULL CHECK(status IN ('open','closed')),created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS care_jobs_open_feed ON care_jobs(status,created_at DESC,id);
CREATE INDEX IF NOT EXISTS care_jobs_customer ON care_jobs(customer_id,created_at DESC,id);
CREATE TABLE IF NOT EXISTS care_job_applications(id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES care_jobs(id),caregiver_id TEXT NOT NULL REFERENCES caregivers(id),message TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('applied','withdrawn')),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(job_id,caregiver_id));
CREATE INDEX IF NOT EXISTS care_job_applicants ON care_job_applications(job_id,created_at DESC);
CREATE INDEX IF NOT EXISTS care_job_my_applications ON care_job_applications(caregiver_id,created_at DESC);
