-- Optional recurring Nepal local working hours. Absent rows means no weekly restriction.
CREATE TABLE IF NOT EXISTS caregiver_weekly_hours(
 id TEXT PRIMARY KEY,
 caregiver_id TEXT NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
 weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
 start_min INTEGER NOT NULL CHECK(start_min BETWEEN 0 AND 1439),
 end_min INTEGER NOT NULL CHECK(end_min BETWEEN 1 AND 1440 AND end_min>start_min),
 created_at TEXT NOT NULL,
 UNIQUE(caregiver_id,weekday,start_min,end_min)
);
CREATE INDEX IF NOT EXISTS caregiver_weekly_hours_lookup ON caregiver_weekly_hours(caregiver_id,weekday,start_min,end_min);
