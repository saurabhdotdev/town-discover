import { NextRequest } from "next/server";
import { createApiHandler } from "@/lib/server/api-handler";
import {
  hashPassword,
  isValidEmail,
  normalizeFullName,
  normalizeEmail,
  validateFullName,
  validatePassword,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createApiHandler({ auth: "admin" }, async (request, { pool }) => {
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

  try {
    const { rows } = await pool.query(
      `
      INSERT INTO users (email, full_name, password_hash, password_salt, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, full_name AS "fullName", role
      `,
      [email, fullName, passwordData.hash, passwordData.salt, role]
    );

    return Response.json({ user: rows[0], message: "Account created successfully." }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return Response.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    throw error;
  }
});
