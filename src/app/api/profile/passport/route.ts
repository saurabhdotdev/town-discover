import { NextRequest } from "next/server";
import { createApiHandler } from "@/lib/server/api-handler";
import { z } from "zod";
import { awardXP, checkAndGrantBadges } from "@/lib/gamification";
import { BadRequestError } from "@/lib/server/api-errors";
import { MOCK_PLACES } from "@/data/mock-places";

const postBodySchema = z.object({
  city: z.string().min(1, { message: "city name required" }).max(100).trim(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isCityMatch = (c1: string, c2: string) => {
  const norm = (s: string) => s.toLowerCase().trim();
  const n1 = norm(c1);
  const n2 = norm(c2);
  if (n1 === n2) return true;
  if (n1.includes("bangalore") && n2.includes("bengaluru")) return true;
  if (n1.includes("bengaluru") && n2.includes("bangalore")) return true;
  if (n1.includes("mumbai") && n2.includes("bombay")) return true;
  if (n1.includes("bombay") && n2.includes("mumbai")) return true;
  if (n1.includes("delhi") && n2.includes("new delhi")) return true;
  if (n1.includes("new delhi") && n2.includes("delhi")) return true;
  return false;
};

export const GET = createApiHandler(
  { auth: "required" },
  async (request: NextRequest, { pool, user }) => {
    const { rows } = await pool.query(
      `
      SELECT city_name AS "cityName", stamped_at AS "stampedAt"
      FROM user_city_stamps
      WHERE user_id = $1
      ORDER BY stamped_at DESC
      `,
      [user!.id]
    );

    return Response.json({ stamps: rows }, { status: 200 });
  }
);

export const POST = createApiHandler(
  { auth: "required", rateLimitKey: "POST:/api/profile/passport" },
  async (request: NextRequest, { pool, user }) => {
    const body = await request.json();
    const parseResult = postBodySchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestError("Invalid request body. 'city' is required.");
    }
    const { city } = parseResult.data;

    // Check if user already claimed this city stamp to prevent double-claiming
    const { rows: existingClaims } = await pool.query(
      `SELECT 1 FROM user_city_stamps WHERE user_id = $1 AND LOWER(city_name) = LOWER($2)`,
      [user!.id, city]
    );

    if (existingClaims.length > 0) {
      throw new BadRequestError(`Stamp for ${city} has already been claimed!`);
    }

    // Retrieve the user's saved place IDs
    const { rows: savedRows } = await pool.query<{ place_id: string }>(
      `SELECT place_id FROM saved_places WHERE user_id = $1`,
      [user!.id]
    );
    const savedIds = new Set(savedRows.map((r) => r.place_id));

    if (savedIds.size === 0) {
      throw new BadRequestError(`You don't have enough saved places in ${city} to claim a stamp.`);
    }

    // 1. Check matching mock places
    const matchingMock = MOCK_PLACES.filter(
      (p) => savedIds.has(p.id) && isCityMatch(p.city, city)
    );

    // 2. Check matching approved places from the database
    const savedIdsArray = Array.from(savedIds);
    const { rows: dbRows } = await pool.query<{ id: string; city: string }>(
      `
      SELECT id, city
      FROM approved_places
      WHERE id = ANY($1)
      `,
      [savedIdsArray]
    );
    const matchingDb = dbRows.filter((p) => isCityMatch(p.city, city));

    const totalMatching = matchingMock.length + matchingDb.length;

    // Validate that the user has at least 3 saved places in the target city
    if (totalMatching < 3) {
      throw new BadRequestError(
        `You have saved ${totalMatching} places in ${city}, but you need at least 3 to claim the stamp.`
      );
    }

    // Claim the stamp
    await pool.query(
      `
      INSERT INTO user_city_stamps (user_id, city_name)
      VALUES ($1, $2)
      ON CONFLICT (user_id, city_name) DO NOTHING
      `,
      [user!.id, city]
    );

    // Award 100 XP for the milestone
    const eventType = `passport_stamp_${city.toLowerCase().replace(/\s+/g, "_")}`;
    await awardXP(pool, user!.id, eventType, 100);

    // Check and grant badges
    const newBadges = await checkAndGrantBadges(pool, user!.id);

    return Response.json(
      {
        success: true,
        city,
        xpAwarded: 100,
        newBadges,
      },
      { status: 201 }
    );
  }
);
