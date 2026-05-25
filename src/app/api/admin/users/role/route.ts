import { NextRequest } from "next/server";
import { ensureAuthSetup, normalizeEmail, requireCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/postgres";
import { UserRole } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedRoles = new Set<UserRole>(["user", "super_admin"]);

export async function PATCH(request: NextRequest) {
  const pool = getPool();
  if (!pool) {
    return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  await ensureAuthSetup(pool);
  const auth = await requireCurrentUser(pool, request);
  if (!auth.user) return auth.response;

  if (auth.user.role !== "super_admin") {
    return Response.json({ error: "Only a super admin can change user roles." }, { status: 403 });
  }

  const body = await request.json();
  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  const role = body.role as UserRole;

  if (!email || !allowedRoles.has(role)) {
    return Response.json({ error: "A valid email and role are required." }, { status: 400 });
  }

  const { rows } = await pool.query(
    `
    UPDATE users
    SET role = $1
    WHERE email = $2
    RETURNING id, email, role
    `,
    [role, email]
  );

  if (!rows[0]) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }

  return Response.json({ user: rows[0] });
}
