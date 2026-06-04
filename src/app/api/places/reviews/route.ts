import { NextRequest } from "next/server";
import { createApiHandler } from "@/lib/server/api-handler";
import { z } from "zod";
import { awardXP, checkAndGrantBadges } from "@/lib/gamification";
import { BadRequestError } from "@/lib/server/api-errors";

const postSchema = z.object({
  placeId: z.string().min(1, { message: "placeId cannot be empty" }).max(200).trim(),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1, { message: "Review text cannot be empty" }).max(2000).trim(),
  imageUrls: z.array(z.string().url().max(2048)).max(10).optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createApiHandler(
  { auth: "none" },
  async (request: NextRequest, { pool }) => {
    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get("placeId");
    if (!placeId) {
      throw new BadRequestError("placeId query param required");
    }

    const { rows: reviews } = await pool.query(
      `
      SELECT
        r.id,
        r.user_id AS "userId",
        r.place_id AS "placeId",
        r.rating,
        r.text,
        r.image_urls AS "imageUrls",
        r.created_at AS "createdAt",
        COALESCE(u.full_name, 'Anonymous Wanderer') AS "userFullName",
        u.email AS "userEmail"
      FROM place_reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.place_id = $1
      ORDER BY r.created_at DESC
      `,
      [placeId]
    );

    const { rows: statsRows } = await pool.query(
      `
      SELECT
        COALESCE(AVG(rating), 0.0) AS "averageRating",
        COUNT(*) AS "reviewCount"
      FROM place_reviews
      WHERE place_id = $1
      `,
      [placeId]
    );

    const averageRating = parseFloat(Number(statsRows[0]?.averageRating ?? 0).toFixed(1));
    const reviewCount = parseInt(statsRows[0]?.reviewCount ?? 0, 10);

    return Response.json({
      reviews,
      summary: { averageRating, reviewCount },
    }, { status: 200 });
  }
);

export const POST = createApiHandler(
  { auth: "required", rateLimitKey: "POST:/api/places/reviews" },
  async (request: NextRequest, { pool, user }) => {
    const body = await request.json();
    const parseResult = postSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestError("Invalid request body");
    }
    const { placeId, rating, text, imageUrls = [] } = parseResult.data;

    // Check if user already reviewed this place to determine if it is a new review
    const { rows: existing } = await pool.query(
      `SELECT id FROM place_reviews WHERE user_id = $1 AND place_id = $2`,
      [user!.id, placeId]
    );
    const isNew = existing.length === 0;

    await pool.query(
      `
      INSERT INTO place_reviews (user_id, place_id, rating, text, image_urls)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, place_id)
      DO UPDATE SET rating = EXCLUDED.rating, text = EXCLUDED.text, image_urls = EXCLUDED.image_urls, created_at = NOW()
      `,
      [user!.id, placeId, rating, text, imageUrls]
    );

    let newBadges: string[] = [];
    if (isNew) {
      // Award +15 XP for the review event
      await awardXP(pool, user!.id, "write_review", 15);
      newBadges = await checkAndGrantBadges(pool, user!.id);
    }

    return Response.json({ success: true, isNew, newBadges }, { status: 201 });
  }
);
