-- Reminder consent is per signed-in recipient; essential booking updates remain enabled.
CREATE TABLE IF NOT EXISTS care_notification_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  booking_reminders INTEGER NOT NULL DEFAULT 1 CHECK(booking_reminders IN (0,1)),
  updated_at TEXT NOT NULL
);
