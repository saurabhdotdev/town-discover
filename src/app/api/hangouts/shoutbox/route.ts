import { NextRequest } from "next/server";
import { createApiHandler } from "@/lib/server/api-handler";
import { z } from "zod";
import { awardXP } from "@/lib/gamification";
import { BadRequestError } from "@/lib/server/api-errors";
import { computeLevel, getLevelTitle } from "@/lib/gamification";

const messageSchema = z.object({
  text: z.string().min(1, { message: "Message cannot be empty" }).max(200, { message: "Message is too long (max 200 chars)" }).trim(),
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

    const { rows } = await pool.query(
      `
      SELECT
        sm.id,
        sm.user_id AS "userId",
        sm.text,
        sm.city,
        sm.created_at AS "createdAt",
        COALESCE(u.full_name, 'Anonymous explorer') AS "userFullName",
        COALESCE(
          (SELECT SUM(xp) FROM user_xp_events WHERE user_id = sm.user_id),
          0
        ) AS "totalXp"
      FROM shoutbox_messages sm
      JOIN users u ON sm.user_id = u.id
      WHERE LOWER(sm.city) = LOWER($1)
      ORDER BY sm.created_at DESC
      LIMIT 50
      `,
      [city]
    );

    interface ShoutboxRow { id: string; userId: string; text: string; city: string; createdAt: string; userFullName: string; totalXp: string; }
    const messages = rows.map((r: ShoutboxRow) => {
      const totalXp = Number(r.totalXp);
      const levelInfo = computeLevel(totalXp);
      return {
        id: r.id,
        userId: r.userId,
        text: r.text,
        city: r.city,
        createdAt: r.createdAt,
        userFullName: r.userFullName,
        level: levelInfo.level,
        levelTitle: getLevelTitle(levelInfo.level),
      };
    });

    return Response.json({ messages }, { status: 200 });
  }
);

export const POST = createApiHandler(
  { auth: "required", rateLimitKey: "POST:/api/hangouts/shoutbox" },
  async (request: NextRequest, { pool, user }) => {
    const body = await request.json();
    const parseResult = messageSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestError(parseResult.error.issues[0]?.message || "Invalid request data");
    }

    const { text, city } = parseResult.data;

    // Check rate limit/XP limit for shoutbox: how many times have they posted in the last 24 hours?
    // We award +5 XP max 3 times a day. We can always insert, but only award XP if limit not reached.
    const { rows: todayXpCount } = await pool.query(
      `SELECT COUNT(*) AS count FROM user_xp_events
       WHERE user_id = $1 AND event_type = 'shoutbox_message' AND created_at >= NOW() - INTERVAL '24 hours'`,
      [user!.id]
    );
    const xpCount = Number(todayXpCount[0]?.count ?? 0);

    const { rows: newMsg } = await pool.query(
      `
      INSERT INTO shoutbox_messages (user_id, text, city)
      VALUES ($1, $2, $3)
      RETURNING id, created_at
      `,
      [user!.id, text, city]
    );

    let xpAwarded = 0;
    if (xpCount < 3) {
      await awardXP(pool, user!.id, "shoutbox_message", 5);
      xpAwarded = 5;
    }

    const totalXpRes = await pool.query(
      `SELECT COALESCE(SUM(xp), 0) AS total FROM user_xp_events WHERE user_id = $1`,
      [user!.id]
    );
    const currentTotalXp = Number(totalXpRes.rows[0]?.total ?? 0);
    const levelInfo = computeLevel(currentTotalXp);

    return Response.json({
      success: true,
      message: {
        id: newMsg[0].id,
        userId: user!.id,
        text,
        city,
        createdAt: newMsg[0].created_at,
        userFullName: user!.fullName || "Anonymous explorer",
        level: levelInfo.level,
        levelTitle: getLevelTitle(levelInfo.level),
      },
      xpAwarded,
    }, { status: 201 });
  }
);
