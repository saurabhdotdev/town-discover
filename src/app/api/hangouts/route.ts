import { NextRequest } from "next/server";
import { getPool } from "@/lib/postgres";
import { ensureAuthSetup, requireCurrentUser } from "@/lib/auth";
import { z } from "zod";
import { awardXP, checkAndGrantBadges } from "@/lib/gamification";

const hangoutSchema = z.object({
  placeId: z.string().min(1, { message: "placeId cannot be empty" }).trim(),
  title: z.string().min(3, { message: "Title must be at least 3 characters" }).max(100).trim(),
  description: z.string().min(10, { message: "Description must be at least 10 characters" }).max(1000).trim(),
  eventDate: z.string().min(1, { message: "Event date is required" }),
  whatsappLink: z
    .string()
    .url({ message: "Must be a valid invite link" })
    .refine((url) => url.toLowerCase().startsWith("https://chat.whatsapp.com/"), {
      message: "Must be a valid WhatsApp group invite link (starts with https://chat.whatsapp.com/)",
    })
    .trim(),
  city: z.string().min(1, { message: "City is required" }).trim(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const pool = getPool();
    if (!pool) {
      return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
    }
    await ensureAuthSetup(pool);

    const { searchParams } = new URL(request.url);
    const city = searchParams.get("city");
    if (!city) {
      return Response.json({ error: "city query param is required" }, { status: 400 });
    }

    const { rows: hangouts } = await pool.query(
      `
      SELECT
        h.id,
        h.user_id AS "userId",
        h.place_id AS "placeId",
        h.title,
        h.description,
        h.event_date AS "eventDate",
        h.whatsapp_link AS "whatsappLink",
        h.city,
        h.created_at AS "createdAt",
        COALESCE(u.full_name, 'Anonymous explorer') AS "userFullName",
        u.email AS "userEmail",
        COALESCE(p.title, '') AS "placeTitle",
        COALESCE(
          (
            SELECT json_agg(json_build_object('userId', r.user_id, 'fullName', ru.full_name))
            FROM hangout_rsvps r
            JOIN users ru ON r.user_id = ru.id
            WHERE r.hangout_id = h.id
          ),
          '[]'::json
        ) AS "rsvps",
        COALESCE(
          (
            SELECT json_agg(f.user_id)
            FROM hangout_flags f
            WHERE f.hangout_id = h.id
          ),
          '[]'::json
        ) AS "flags"
      FROM place_hangouts h
      JOIN users u ON h.user_id = u.id
      LEFT JOIN approved_places p ON h.place_id = p.id
      WHERE LOWER(h.city) = LOWER($1)
        AND (SELECT COUNT(*) FROM hangout_flags f WHERE f.hangout_id = h.id) < 3
      ORDER BY h.event_date ASC
      `,
      [city]
    );

    return Response.json({ hangouts }, { status: 200 });
  } catch (e: any) {
    console.error("Error in GET /api/hangouts:", e);
    return Response.json({ error: "Internal server error", details: e.message }, { status: 500 });
  }
}

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
    const parseResult = hangoutSchema.safeParse(body);
    if (!parseResult.success) {
      return Response.json({ error: "Invalid request data", details: parseResult.error.format() }, { status: 400 });
    }
    const { placeId, title, description, eventDate, whatsappLink, city } = parseResult.data;

    // 1. Enforce Event Date Validation (min 30 min in future, max 30 days ahead)
    const parsedDate = new Date(eventDate);
    const now = new Date();
    const minFuture = new Date(now.getTime() + 30 * 60 * 1000);
    const maxFuture = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (parsedDate < minFuture) {
      return Response.json({ error: "The event must start at least 30 minutes in the future." }, { status: 400 });
    }
    if (parsedDate > maxFuture) {
      return Response.json({ error: "The event cannot be scheduled more than 30 days in advance." }, { status: 400 });
    }

    // 2. Enforce Rate Limiting (max 2 meetups per 24 hours per user)
    const { rows: userTodayCount } = await pool.query(
      `SELECT COUNT(*) AS count FROM place_hangouts 
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'`,
      [auth.user.id]
    );
    const count = Number(userTodayCount[0].count);
    if (count >= 2) {
      return Response.json({ error: "Rate limit reached. You can only plan up to 2 hangouts per 24 hours to prevent spam." }, { status: 429 });
    }

    const { rows } = await pool.query(
      `
      INSERT INTO place_hangouts (user_id, place_id, title, description, event_date, whatsapp_link, city)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
      `,
      [auth.user.id, placeId, title, description, parsedDate, whatsappLink, city]
    );

    // Award +30 XP for organizing a community hangout event
    await awardXP(pool, auth.user.id, "organize_hangout", 30);
    const newBadges = await checkAndGrantBadges(pool, auth.user.id);

    return Response.json({
      success: true,
      hangoutId: rows[0].id,
      newBadges,
    }, { status: 201 });
  } catch (e: any) {
    console.error("Error in POST /api/hangouts:", e);
    return Response.json({ error: "Internal server error", details: e.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const pool = getPool();
    if (!pool) {
      return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
    }
    await ensureAuthSetup(pool);
    const auth = await requireCurrentUser(pool, request);
    if (!auth.user) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return Response.json({ error: "id query param is required" }, { status: 400 });
    }

    const { rows: hangouts } = await pool.query(
      `SELECT user_id FROM place_hangouts WHERE id = $1`,
      [id]
    );

    if (hangouts.length === 0) {
      return Response.json({ error: "Hangout not found." }, { status: 404 });
    }

    const hostId = hangouts[0].user_id;
    if (hostId !== auth.user.id && auth.user.role !== "super_admin") {
      return Response.json({ error: "Unauthorized. Only the host can delete this hangout." }, { status: 403 });
    }

    await pool.query(
      `DELETE FROM place_hangouts WHERE id = $1`,
      [id]
    );

    return Response.json({ success: true }, { status: 200 });
  } catch (e: any) {
    console.error("Error in DELETE /api/hangouts:", e);
    return Response.json({ error: "Internal server error", details: e.message }, { status: 500 });
  }
}
