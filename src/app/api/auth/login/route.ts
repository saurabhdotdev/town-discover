import { NextRequest } from "next/server";
import { createApiHandler } from "@/lib/server/api-handler";
import {
  authCookieName,
  createSession,
  getSessionCookieOptions,
  isSuperAdminEmail,
  normalizeEmail,
  pruneExpiredSessions,
  verifyPassword,
} from "@/lib/auth";
import { requireTrustedOrigin } from "@/lib/request-security";
import { RATE_LIMIT_AUTH } from "@/lib/server/rate-limit";
import { BadRequestError, UnauthorizedError } from "@/lib/server/api-errors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createApiHandler(
  { auth: "none", rateLimit: RATE_LIMIT_AUTH, rateLimitKey: "POST:/api/auth/login" },
  async (request: NextRequest, { pool }) => {
    const originResponse = requireTrustedOrigin(request);
    if (originResponse) return originResponse;

    const body = await request.json();
    const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      throw new BadRequestError("Email and password are required.");
    }

    await pruneExpiredSessions(pool);

    const { rows } = await pool.query(
      `
      SELECT id, email, full_name AS "fullName", role, password_hash AS "passwordHash", password_salt AS "passwordSalt"
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [email]
    );
    const userWithPassword = rows[0];

    if (!userWithPassword) {
      throw new UnauthorizedError("Email or password is incorrect.");
    }

    const passwordMatches = await verifyPassword(password, userWithPassword.passwordSalt, userWithPassword.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedError("Email or password is incorrect.");
    }

    const role = isSuperAdminEmail(userWithPassword.email) ? "super_admin" : userWithPassword.role;
    if (role !== userWithPassword.role) {
      await pool.query("UPDATE users SET role = $1 WHERE id = $2", [role, userWithPassword.id]);
    }

    const session = await createSession(pool, userWithPassword.id);
    const user = {
      id: userWithPassword.id,
      email: userWithPassword.email,
      fullName: userWithPassword.fullName,
      role,
    };
    const response = NextResponse.json({ user });

    response.cookies.set(authCookieName, session.token, getSessionCookieOptions(session.expiresAt));
    return response;
  }
);
