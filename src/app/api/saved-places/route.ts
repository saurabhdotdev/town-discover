import { NextRequest } from "next/server";
import { getPool } from "@/lib/postgres";
import { ensureAuthSetup, requireCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const pool = getPool();
  if (!pool) {
    return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  await ensureAuthSetup(pool);
  const auth = await requireCurrentUser(pool, request);
  if (!auth.user) return auth.response;

  const { rows } = await pool.query(
    `
    SELECT place_id AS "placeId"
    FROM saved_places
    WHERE user_id = $1
    ORDER BY created_at DESC
    `,
    [auth.user.id]
  );

  return Response.json({ placeIds: rows.map((row) => row.placeId) });
}

export async function POST(request: NextRequest) {
  const pool = getPool();
  if (!pool) {
    return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  await ensureAuthSetup(pool);
  const auth = await requireCurrentUser(pool, request);
  if (!auth.user) return auth.response;

  const body = await request.json();
  const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
  if (!placeId) {
    return Response.json({ error: "placeId is required." }, { status: 400 });
  }

  await pool.query(
    `
    INSERT INTO saved_places (user_id, place_id)
    VALUES ($1, $2)
    ON CONFLICT (user_id, place_id) DO NOTHING
    `,
    [auth.user.id, placeId]
  );

  return Response.json({ placeId, saved: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const pool = getPool();
  if (!pool) {
    return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  await ensureAuthSetup(pool);
  const auth = await requireCurrentUser(pool, request);
  if (!auth.user) return auth.response;

  const placeId = request.nextUrl.searchParams.get("placeId")?.trim();
  if (!placeId) {
    return Response.json({ error: "placeId is required." }, { status: 400 });
  }

  await pool.query("DELETE FROM saved_places WHERE user_id = $1 AND place_id = $2", [auth.user.id, placeId]);
  return Response.json({ placeId, saved: false });
}
