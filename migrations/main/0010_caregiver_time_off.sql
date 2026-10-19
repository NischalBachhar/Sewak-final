-- A caregiver may block future care slots. Hours are minutes from local Nepal midnight.
CREATE TABLE IF NOT EXISTS caregiver_time_off (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL REFERENCES caregivers(id),
  day TEXT NOT NULL CHECK(length(day)=10),
  start_min INTEGER NOT NULL CHECK(start_min>=0 AND start_min<1440),
  end_min INTEGER NOT NULL CHECK(end_min>0 AND end_min<=1440 AND end_min>start_min),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS caregiver_time_off_slot ON caregiver_time_off(caregiver_id,day,start_min,end_min);
CREATE INDEX IF NOT EXISTS bookings_caregiver_slot ON bookings(caregiver_id,date,status);
