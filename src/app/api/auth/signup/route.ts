import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";
import {
  authCookieName,
  createSession,
  ensureAuthSetup,
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const originResponse = requireTrustedOrigin(request);
  if (originResponse) return originResponse;

  const pool = getPool();
  if (!pool) {
    return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  try {
    const body = await request.json();
    const fullName = normalizeFullName(typeof body.fullName === "string" ? body.fullName : "");
    const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
    const password = typeof body.password === "string" ? body.password : "";

    const fullNameError = validateFullName(fullName);
    if (fullNameError) {
      return Response.json({ error: fullNameError }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return Response.json({ error: passwordError }, { status: 400 });
    }

    await ensureAuthSetup(pool);
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
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return Response.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to create account." },
      { status: 503 }
    );
  }
}
