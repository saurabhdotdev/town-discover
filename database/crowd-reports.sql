CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS crowd_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id TEXT NOT NULL,
  crowd_level TEXT NOT NULL CHECK (
    crowd_level IN ('low', 'moderate', 'busy', 'very_crowded')
  ),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crowd_reports_place_id_reported_at_idx
ON crowd_reports (place_id, reported_at DESC);

CREATE INDEX IF NOT EXISTS crowd_reports_place_user_reported_at_idx
ON crowd_reports (place_id, user_id, reported_at DESC);
