import { NextRequest } from "next/server";
import { getPool } from "@/lib/postgres";
import {
  ensureAuthSetup,
  hashPassword,
  isValidEmail,
  normalizeFullName,
  normalizeEmail,
  requireCurrentUser,
  validateFullName,
  validatePassword,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const pool = getPool();
  if (!pool) {
    return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  try {
    await ensureAuthSetup(pool);
    const auth = await requireCurrentUser(pool, request);
    if (!auth.user) return auth.response;

    if (auth.user.role !== "super_admin") {
      return Response.json({ error: "Only a super admin can create accounts." }, { status: 403 });
    }

    const body = await request.json();
    const fullName = normalizeFullName(typeof body.fullName === "string" ? body.fullName : "");
    const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
    const password = typeof body.password === "string" ? body.password : "";
    const role = typeof body.role === "string" ? body.role : "super_admin";

    if (role !== "super_admin" && role !== "user") {
      return Response.json({ error: "Invalid role specified." }, { status: 400 });
    }

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

    const passwordData = await hashPassword(password);

    const { rows } = await pool.query(
      `
      INSERT INTO users (email, full_name, password_hash, password_salt, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, full_name AS "fullName", role
      `,
      [email, fullName, passwordData.hash, passwordData.salt, role]
    );

    return Response.json({ user: rows[0], message: "Account created successfully." }, { status: 201 });
  } catch (error: any) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return Response.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to create account." },
      { status: 500 }
    );
  }
}
