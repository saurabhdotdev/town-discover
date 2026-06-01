import { createHash, pbkdf2, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { AuthUser, UserRole } from "@/types";

export const authCookieName = "town_discover_session";

const pbkdf2Async = promisify(pbkdf2);
const passwordIterations = 210000;
const passwordKeyLength = 32;
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

const authSetupSql = `
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

-- Folder support for saved places
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

CREATE INDEX IF NOT EXISTS user_xp_events_user_id_idx
ON user_xp_events (user_id);

CREATE INDEX IF NOT EXISTS user_badges_user_id_idx
ON user_badges (user_id);

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

CREATE INDEX IF NOT EXISTS place_reviews_place_id_idx ON place_reviews (place_id);
CREATE INDEX IF NOT EXISTS place_reviews_user_id_idx ON place_reviews (user_id);

ALTER TABLE place_reviews ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

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

CREATE INDEX IF NOT EXISTS place_hangouts_city_idx ON place_hangouts (city);

CREATE TABLE IF NOT EXISTS hangout_rsvps (
  hangout_id UUID NOT NULL REFERENCES place_hangouts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (hangout_id, user_id)
);

CREATE INDEX IF NOT EXISTS hangout_rsvps_hangout_id_idx ON hangout_rsvps (hangout_id);

CREATE TABLE IF NOT EXISTS hangout_flags (
  hangout_id UUID NOT NULL REFERENCES place_hangouts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (hangout_id, user_id)
);

CREATE INDEX IF NOT EXISTS hangout_flags_hangout_id_idx ON hangout_flags (hangout_id);

ALTER TABLE hangout_rsvps ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'interested', 'maybe'));

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

CREATE INDEX IF NOT EXISTS user_notifications_user_id_idx ON user_notifications (user_id);
CREATE INDEX IF NOT EXISTS user_notifications_is_read_idx ON user_notifications (user_id, is_read);
`;

let authSetupPromise: Promise<void> | null = null;

export const ensureAuthSetup = async (pool: Pool) => {
  authSetupPromise ??= pool.query(authSetupSql).then(() => undefined);
  await authSetupPromise;
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const validatePassword = (password: string) => {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 128) return "Password is too long.";
  return null;
};

export const normalizeFullName = (fullName: string) => fullName.trim().replace(/\s+/g, " ");

export const validateFullName = (fullName: string) => {
  if (fullName.length < 2) return "Enter your full name.";
  if (fullName.length > 80) return "Full name is too long.";
  return null;
};

export const hashPassword = async (password: string, salt = randomBytes(16).toString("base64url")) => {
  const derived = await pbkdf2Async(password, salt, passwordIterations, passwordKeyLength, "sha256");
  return {
    salt,
    hash: derived.toString("base64url"),
  };
};

export const verifyPassword = async (password: string, salt: string, expectedHash: string) => {
  const { hash } = await hashPassword(password, salt);
  const expected = Buffer.from(expectedHash, "base64url");
  const actual = Buffer.from(hash, "base64url");

  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

export const hashSessionToken = (token: string) => {
  return createHash("sha256").update(token).digest("base64url");
};

export const createSession = async (pool: Pool, userId: string) => {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds * 1000);

  await pool.query(
    `
    INSERT INTO auth_sessions (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
    `,
    [userId, tokenHash, expiresAt]
  );

  return { token, expiresAt };
};

export const getSessionCookieOptions = (expires?: Date) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: expires ? undefined : sessionMaxAgeSeconds,
  expires,
});

export const getExpiredSessionCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 0,
});

export const pruneExpiredSessions = async (pool: Pool) => {
  await pool.query("DELETE FROM auth_sessions WHERE expires_at <= NOW()");
};

export const getCurrentUser = async (pool: Pool, request: NextRequest): Promise<AuthUser | null> => {
  await ensureAuthSetup(pool);
  const token = request.cookies.get(authCookieName)?.value;
  if (!token) return null;

  await pruneExpiredSessions(pool);
  const { rows } = await pool.query(
    `
    SELECT
      users.id,
      users.email,
      users.full_name AS "fullName",
      users.role
    FROM auth_sessions
    JOIN users ON users.id = auth_sessions.user_id
    WHERE auth_sessions.token_hash = $1
      AND auth_sessions.expires_at > NOW()
    LIMIT 1
    `,
    [hashSessionToken(token)]
  );

  return rows[0] ?? null;
};

export const requireCurrentUser = async (pool: Pool, request: NextRequest) => {
  const user = await getCurrentUser(pool, request);
  if (!user) {
    return { user: null, response: Response.json({ error: "Please log in first." }, { status: 401 }) };
  }

  return { user, response: null };
};

export const getSignupRole = async (pool: Pool, email: string): Promise<UserRole> => {
  if (isSuperAdminEmail(email)) return "super_admin";

  return "user";
};

export const isSuperAdminEmail = (email: string) => {
  const configuredAdmins = (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter(Boolean);

  return configuredAdmins.includes(normalizeEmail(email));
};
