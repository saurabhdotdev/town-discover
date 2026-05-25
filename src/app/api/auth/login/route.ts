import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";
import {
  authCookieName,
  createSession,
  ensureAuthSetup,
  getSessionCookieOptions,
  isSuperAdminEmail,
  normalizeEmail,
  pruneExpiredSessions,
  verifyPassword,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const pool = getPool();
  if (!pool) {
    return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  try {
    const body = await request.json();
    const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
    const password = typeof body.password === "string" ? body.password : "";

    await ensureAuthSetup(pool);
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
      return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
    }

    const passwordMatches = await verifyPassword(password, userWithPassword.passwordSalt, userWithPassword.passwordHash);
    if (!passwordMatches) {
      return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
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
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to log in." },
      { status: 503 }
    );
  }
}
