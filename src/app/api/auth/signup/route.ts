import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/server/api-handler";
import {
  authCookieName,
  createSession,
  getSessionCookieOptions,
  getSignupRole,
  hashPassword,
  isValidEmail,
  normalizeFullName,
  normalizeEmail,
  validateFullName,
  validatePassword,
} from "@/lib/auth";
import { requireTrustedOrigin } from "@/lib/request-security";
import { RATE_LIMIT_AUTH } from "@/lib/server/rate-limit";
import { BadRequestError } from "@/lib/server/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createApiHandler(
  { auth: "none", rateLimit: RATE_LIMIT_AUTH, rateLimitKey: "POST:/api/auth/signup" },
  async (request: NextRequest, { pool }) => {
    const originResponse = requireTrustedOrigin(request);
    if (originResponse) return originResponse;

    const body = await request.json();
    const fullName = normalizeFullName(typeof body.fullName === "string" ? body.fullName : "");
    const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
    const password = typeof body.password === "string" ? body.password : "";

    const fullNameError = validateFullName(fullName);
    if (fullNameError) throw new BadRequestError(fullNameError);

    if (!isValidEmail(email)) throw new BadRequestError("Enter a valid email address.");

    const passwordError = validatePassword(password);
    if (passwordError) throw new BadRequestError(passwordError);

    const role = await getSignupRole(pool, email);
    const passwordData = await hashPassword(password);

    const { rows } = await pool.query(
      `
      INSERT INTO users (email, full_name, password_hash, password_salt, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, full_name AS "fullName", role
      `,
      [email, fullName, passwordData.hash, passwordData.salt, role]
    );
    const user = rows[0];
    const session = await createSession(pool, user.id);
    const response = NextResponse.json({ user }, { status: 201 });

    response.cookies.set(authCookieName, session.token, getSessionCookieOptions(session.expiresAt));
    return response;
  }
);
