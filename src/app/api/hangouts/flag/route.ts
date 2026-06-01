import { NextRequest } from "next/server";
import { getPool } from "@/lib/postgres";
import { ensureAuthSetup, requireCurrentUser } from "@/lib/auth";
import { z } from "zod";

const flagSchema = z.object({
  hangoutId: z.string().uuid({ message: "Invalid hangout ID format" }),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const pool = getPool();
    if (!pool) {
      return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
    }
    await ensureAuthSetup(pool);
    const auth = await requireCurrentUser(pool, request);
    if (!auth.user) return auth.response;

    const body = await request.json();
    const parseResult = flagSchema.safeParse(body);
    if (!parseResult.success) {
      return Response.json({ error: "Invalid request data", details: parseResult.error.format() }, { status: 400 });
    }
    const { hangoutId } = parseResult.data;

    // Check if the meetup exists
    const { rows: hangouts } = await pool.query(
      `SELECT id FROM place_hangouts WHERE id = $1`,
      [hangoutId]
    );
    if (hangouts.length === 0) {
      return Response.json({ error: "Hangout not found." }, { status: 404 });
    }

    // Insert flag (primary key handles unique constraint)
    await pool.query(
      `INSERT INTO hangout_flags (hangout_id, user_id) 
       VALUES ($1, $2) 
       ON CONFLICT (hangout_id, user_id) DO NOTHING`,
      [hangoutId, auth.user.id]
    );

    return Response.json({
      success: true,
      flagged: true,
      message: "Hangout reported successfully.",
    }, { status: 200 });
  } catch (e: any) {
    console.error("Error in POST /api/hangouts/flag:", e);
    return Response.json({ error: "Internal server error", details: e.message }, { status: 500 });
  }
}
