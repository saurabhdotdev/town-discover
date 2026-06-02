import { createHash, pbkdf2, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { AuthUser, UserRole } from "@/types";
import { runDatabaseMigrations } from "@/lib/db-migrations";
import { requireTrustedOrigin } from "@/lib/request-security";

export const authCookieName = "town_discover_session";

const pbkdf2Async = promisify(pbkdf2);
const passwordIterations = 210000;
const passwordKeyLength = 32;
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

export const ensureAuthSetup = async (pool: Pool) => {
  await runDatabaseMigrations(pool);
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
  sameSite: "strict" as const,
  path: "/",
  maxAge: expires ? undefined : sessionMaxAgeSeconds,
  expires,
});

export const getExpiredSessionCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 0,
});

export const pruneExpiredSessions = async (pool: Pool) => {
  await pool.query("DELETE FROM auth_sessions WHERE expires_at <= NOW()");
};

export const getCurrentUser = async (pool: Pool, request: NextRequest): Promise<AuthUser | null> => {
  const token = request.cookies.get(authCookieName)?.value;
  if (!token) return null;

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
  const originResponse = requireTrustedOrigin(request);
  if (originResponse) {
    return { user: null, response: originResponse };
  }

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
