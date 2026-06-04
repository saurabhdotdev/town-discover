import { Pool } from "pg";

interface Migration {
  id: string;
  sql: string;
}

const migrationLockId = 74021991;

const migrations: Migration[] = [
  {
    id: "202606010001_initial_schema",
    sql: `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'super_admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS full_name TEXT;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_places (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, place_id)
);

CREATE TABLE IF NOT EXISTS saved_place_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_place_folder_items (
  folder_id UUID NOT NULL REFERENCES saved_place_folders(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL,
  PRIMARY KEY (folder_id, place_id)
);

CREATE TABLE IF NOT EXISTS place_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('cafe', 'restaurant', 'event', 'nightlife', 'food-stall', 'bar', 'dessert', 'street-food')),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  price_range TEXT,
  hours TEXT,
  phone TEXT,
  website TEXT,
  city TEXT NOT NULL,
  locality TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approved_places (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  image TEXT NOT NULL,
  rating DOUBLE PRECISION NOT NULL DEFAULT 4.5,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  city TEXT NOT NULL,
  locality TEXT NOT NULL,
  price_range TEXT NOT NULL DEFAULT '$$',
  phone TEXT,
  website TEXT,
  hours JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  xp INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS place_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text TEXT NOT NULL,
  image_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, place_id)
);

ALTER TABLE place_reviews
ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

CREATE TABLE IF NOT EXISTS place_hangouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  whatsapp_link TEXT NOT NULL,
  city TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hangout_rsvps (
  hangout_id UUID NOT NULL REFERENCES place_hangouts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (hangout_id, user_id)
);

ALTER TABLE hangout_rsvps
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'interested', 'maybe'));

CREATE TABLE IF NOT EXISTS hangout_flags (
  hangout_id UUID NOT NULL REFERENCES place_hangouts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (hangout_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crowd_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id TEXT NOT NULL,
  crowd_level TEXT NOT NULL CHECK (
    crowd_level IN ('low', 'moderate', 'busy', 'very_crowded')
  ),
  note TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE crowd_reports
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS auth_sessions_token_hash_idx
ON auth_sessions (token_hash);

CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx
ON auth_sessions (expires_at);

CREATE INDEX IF NOT EXISTS saved_places_user_id_idx
ON saved_places (user_id);

CREATE INDEX IF NOT EXISTS saved_place_folders_user_id_idx
ON saved_place_folders (user_id);

CREATE INDEX IF NOT EXISTS saved_place_folder_items_folder_id_idx
ON saved_place_folder_items (folder_id);

CREATE INDEX IF NOT EXISTS place_suggestions_status_idx
ON place_suggestions (status);

CREATE INDEX IF NOT EXISTS approved_places_city_idx
ON approved_places (city);

CREATE INDEX IF NOT EXISTS user_xp_events_user_id_idx
ON user_xp_events (user_id);

CREATE INDEX IF NOT EXISTS user_badges_user_id_idx
ON user_badges (user_id);

CREATE INDEX IF NOT EXISTS place_reviews_place_id_idx
ON place_reviews (place_id);

CREATE INDEX IF NOT EXISTS place_reviews_user_id_idx
ON place_reviews (user_id);

CREATE INDEX IF NOT EXISTS place_hangouts_city_idx
ON place_hangouts (city);

CREATE INDEX IF NOT EXISTS hangout_rsvps_hangout_id_idx
ON hangout_rsvps (hangout_id);

CREATE INDEX IF NOT EXISTS hangout_flags_hangout_id_idx
ON hangout_flags (hangout_id);

CREATE INDEX IF NOT EXISTS user_notifications_user_id_idx
ON user_notifications (user_id);

CREATE INDEX IF NOT EXISTS user_notifications_is_read_idx
ON user_notifications (user_id, is_read);

CREATE INDEX IF NOT EXISTS crowd_reports_place_id_reported_at_idx
ON crowd_reports (place_id, reported_at DESC);

CREATE INDEX IF NOT EXISTS crowd_reports_place_user_reported_at_idx
ON crowd_reports (place_id, user_id, reported_at DESC);
`,
  },
  {
    id: "202606010002_trip_plans",
    sql: `
CREATE TABLE IF NOT EXISTS trip_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  destination TEXT NOT NULL,
  distance_km INT,
  duration_minutes INT,
  route_path JSONB NOT NULL DEFAULT '[]'::jsonb,
  stops JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trip_plans_user_id_created_at_idx
ON trip_plans (user_id, created_at DESC);
`,
  },
  {
    id: "202606040003_explorer_passport_stamps",
    sql: `
CREATE TABLE IF NOT EXISTS user_city_stamps (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  city_name TEXT NOT NULL,
  stamped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, city_name)
);

CREATE INDEX IF NOT EXISTS user_city_stamps_user_id_idx
ON user_city_stamps (user_id);
`,
  },
];

let migrationPromise: Promise<void> | null = null;

export const runDatabaseMigrations = async (pool: Pool) => {
  migrationPromise ??= runDatabaseMigrationsOnce(pool).catch((error) => {
    migrationPromise = null;
    throw error;
  });

  await migrationPromise;
};

const runDatabaseMigrationsOnce = async (pool: Pool) => {
  const client = await pool.connect();

  try {
    await client.query("SELECT pg_advisory_lock($1)", [migrationLockId]);
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows } = await client.query<{ id: string }>("SELECT id FROM schema_migrations");
    const appliedMigrationIds = new Set(rows.map((row) => row.id));

    for (const migration of migrations) {
      if (appliedMigrationIds.has(migration.id)) continue;

      await client.query(migration.sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [migration.id]);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [migrationLockId]);
    client.release();
  }
};
