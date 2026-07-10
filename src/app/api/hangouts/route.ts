import { NextRequest } from "next/server";
import { createApiHandler } from "@/lib/server/api-handler";
import { z } from "zod";
import { awardXP, checkAndGrantBadges } from "@/lib/gamification";
import { BadRequestError, NotFoundError, ForbiddenError } from "@/lib/server/api-errors";
import { RateLimitError } from "@/lib/server/api-errors";
import { PoolClient } from "pg";

const hangoutSchema = z.object({
  placeId: z.string().min(1, { message: "placeId cannot be empty" }).max(200).trim(),
  title: z.string().min(3, { message: "Title must be at least 3 characters" }).max(100).trim(),
  description: z.string().min(10, { message: "Description must be at least 10 characters" }).max(1000).trim(),
  eventDate: z.string().min(1, { message: "Event date is required" }).max(50),
  whatsappLink: z
    .string()
    .url({ message: "Must be a valid invite link" })
    .max(300)
    .refine((url) => url.toLowerCase().startsWith("https://chat.whatsapp.com/"), {
      message: "Must be a valid WhatsApp group invite link (starts with https://chat.whatsapp.com/)",
    })
    .trim(),
  city: z.string().min(1, { message: "City is required" }).max(50).trim(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createApiHandler(
  { auth: "none" },
  async (request: NextRequest, { pool }) => {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get("city");
    if (!city) {
      throw new BadRequestError("city query param is required");
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
  }
);

export const POST = createApiHandler(
  { auth: "required", rateLimitKey: "POST:/api/hangouts" },
  async (request: NextRequest, { pool, user }) => {
    const body = await request.json();
    const parseResult = hangoutSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestError("Invalid request data");
    }
    const { placeId, title, description, eventDate, whatsappLink, city } = parseResult.data;

    // 1. Enforce Event Date Validation (min 30 min in future, max 30 days ahead)
    const parsedDate = new Date(eventDate);
    if (isNaN(parsedDate.getTime())) {
      throw new BadRequestError("Please enter a valid date and time.");
    }
    const now = new Date();
    const minFuture = new Date(now.getTime() + 30 * 60 * 1000);
    const maxFuture = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (parsedDate < minFuture) {
      throw new BadRequestError("The event must start at least 30 minutes in the future.");
    }
    if (parsedDate > maxFuture) {
      throw new BadRequestError("The event cannot be scheduled more than 30 days in advance.");
    }

    // 2. Enforce Rate Limiting (max 2 meetups per 24 hours per user)
    const { rows: userTodayCount } = await pool.query(
      `SELECT COUNT(*) AS count FROM place_hangouts 
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'`,
      [user!.id]
    );
    const count = Number(userTodayCount[0].count);
    if (count >= 2) {
      throw new RateLimitError(3600, "Rate limit reached. You can only plan up to 2 hangouts per 24 hours to prevent spam.");
    }

    const client = await pool.connect();
    let hangoutId = "";
    let newBadges: string[] = [];
    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        `
        INSERT INTO place_hangouts (user_id, place_id, title, description, event_date, whatsapp_link, city)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        `,
        [user!.id, placeId, title, description, parsedDate, whatsappLink, city]
      );
      hangoutId = rows[0].id;

      // Award +30 XP for organizing a community hangout event
      await awardXP(client, user!.id, "organize_hangout", 30);
      newBadges = await checkAndGrantBadges(client, user!.id);

      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }

    return Response.json({
      success: true,
      hangoutId,
      newBadges,
    }, { status: 201 });
  }
);

export const DELETE = createApiHandler(
  { auth: "required", rateLimitKey: "DELETE:/api/hangouts" },
  async (request: NextRequest, { pool, user }) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      throw new BadRequestError("id query param is required");
    }

    const { rows: hangouts } = await pool.query(
      `SELECT user_id FROM place_hangouts WHERE id = $1`,
      [id]
    );

    if (hangouts.length === 0) {
      throw new NotFoundError("Hangout not found.");
    }

    const hostId = hangouts[0].user_id;
    if (hostId !== user!.id && user!.role !== "super_admin") {
      throw new ForbiddenError("Unauthorized. Only the host can delete this hangout.");
    }

    await pool.query(`DELETE FROM place_hangouts WHERE id = $1`, [id]);

    return Response.json({ success: true }, { status: 200 });
  }
);
