import { NextRequest } from "next/server";
import { getPool } from "@/lib/postgres";
import { ensureAuthSetup, requireCurrentUser } from "@/lib/auth";
import { z } from "zod/v3";
import { awardXP, checkAndGrantBadges } from "@/lib/gamification";

const categories = new Set([
  "cafe",
  "restaurant",
  "event",
  "nightlife",
  "food-stall",
  "bar",
  "dessert",
  "street-food",
]);

const suggestBodySchema = z.object({
  title: z
    .string()
    .min(2, { message: "Title must be at least 2 characters." })
    .max(100)
    .trim(),
  description: z
    .string()
    .min(10, { message: "Description must be at least 10 characters." })
    .max(300)
    .trim(),
  category: z.string().refine((val) => categories.has(val), {
    message: "Invalid category selected.",
  }),
  latitude: z.number({ required_error: "Latitude is required." }),
  longitude: z.number({ required_error: "Longitude is required." }),
  city: z
    .string()
    .min(2, { message: "City name must be at least 2 characters." })
    .trim(),
  locality: z
    .string()
    .min(2, { message: "Locality must be at least 2 characters." })
    .trim(),
  priceRange: z.string().trim().optional().nullable(),
  hours: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  website: z.string().trim().optional().nullable(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const pool = getPool();
    if (!pool) {
      return Response.json(
        { error: "DATABASE_URL is not configured." },
        { status: 503 }
      );
    }

    await ensureAuthSetup(pool);
    const auth = await requireCurrentUser(pool, request);
    if (!auth.user) return auth.response;

    const body = await request.json();
    const parseResult = suggestBodySchema.safeParse(body);
    if (!parseResult.success) {
      return Response.json(
        { error: "Validation failed.", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const {
      title,
      description,
      category,
      latitude,
      longitude,
      city,
      locality,
      priceRange,
      hours,
      phone,
      website,
    } = parseResult.data;

    const { rows } = await pool.query(
      `
      INSERT INTO place_suggestions (
        user_id,
        title,
        description,
        category,
        latitude,
        longitude,
        price_range,
        hours,
        phone,
        website,
        city,
        locality
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, title, status
      `,
      [
        auth.user.id,
        title,
        description,
        category,
        latitude,
        longitude,
        priceRange || null,
        hours || null,
        phone || null,
        website || null,
        city,
        locality,
      ]
    );

    // Fire XP + badge check in background (pool is non-null at this point)
    void awardXP(pool!, auth.user.id, "suggestion_submitted", 20).then(() =>
      checkAndGrantBadges(pool!, auth.user.id)
    );

    return Response.json(
      { suggestion: rows[0], message: "Suggestion submitted successfully." },
      { status: 201 }
    );

  } catch (e: any) {
    console.error("Error submitting suggestion:", e);
    return Response.json(
      { error: "Internal server error.", details: e.message },
      { status: 500 }
    );
  }
}
