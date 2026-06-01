import { NextRequest } from "next/server";
import { getPool } from "@/lib/postgres";
import { ensureAuthSetup, requireCurrentUser } from "@/lib/auth";
import { z } from "zod";
import { awardXP, checkAndGrantBadges } from "@/lib/gamification";

const postSchema = z.object({
  placeId: z.string().min(1, { message: "placeId cannot be empty" }).trim(),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1, { message: "Review text cannot be empty" }).trim(),
  imageUrls: z.array(z.string()).optional(),
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
    const placeId = searchParams.get("placeId");
    if (!placeId) {
      return Response.json({ error: "placeId query param required" }, { status: 400 });
    }

    // Fetch reviews
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

    // Calculate aggregate summary
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
      summary: {
        averageRating,
        reviewCount
      }
    }, { status: 200 });
  } catch (e: any) {
    console.error("Error in GET /api/places/reviews:", e);
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
    const parseResult = postSchema.safeParse(body);
    if (!parseResult.success) {
      return Response.json({ error: "Invalid request body", details: parseResult.error.format() }, { status: 400 });
    }
    const { placeId, rating, text, imageUrls = [] } = parseResult.data;

    // Check if user already reviewed this place to determine if it is a new review
    const { rows: existing } = await pool.query(
      `SELECT id FROM place_reviews WHERE user_id = $1 AND place_id = $2`,
      [auth.user.id, placeId]
    );
    const isNew = existing.length === 0;

    await pool.query(
      `
      INSERT INTO place_reviews (user_id, place_id, rating, text, image_urls)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, place_id)
      DO UPDATE SET rating = EXCLUDED.rating, text = EXCLUDED.text, image_urls = EXCLUDED.image_urls, created_at = NOW()
      `,
      [auth.user.id, placeId, rating, text, imageUrls]
    );

    let newBadges: string[] = [];
    if (isNew) {
      // Award +15 XP for the review event
      await awardXP(pool, auth.user.id, "write_review", 15);
      newBadges = await checkAndGrantBadges(pool, auth.user.id);
    }

    return Response.json({
      success: true,
      isNew,
      newBadges,
    }, { status: 201 });
  } catch (e: any) {
    console.error("Error in POST /api/places/reviews:", e);
    return Response.json({ error: "Internal server error", details: e.message }, { status: 500 });
  }
}
