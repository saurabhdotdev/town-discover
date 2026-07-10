import { NextRequest } from "next/server";
import { createApiHandler } from "@/lib/server/api-handler";
import { normalizeEmail } from "@/lib/auth";
import { UserRole } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedRoles = new Set<UserRole>(["user", "super_admin"]);

export const PATCH = createApiHandler({ auth: "admin" }, async (request, { pool }) => {
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
});
