import { NextRequest } from "next/server";
import { createApiHandler } from "@/lib/server/api-handler";
import { z } from "zod/v3";
import { awardXP, checkAndGrantBadges } from "@/lib/gamification";
import { BadRequestError } from "@/lib/server/api-errors";

const categories = new Set([
  "cafe", "restaurant", "event", "nightlife", "food-stall", "bar", "dessert", "street-food",
]);

const suggestBodySchema = z.object({
  title: z.string().min(2, { message: "Title must be at least 2 characters." }).max(100).trim(),
  description: z.string().min(10, { message: "Description must be at least 10 characters." }).max(300).trim(),
  category: z.string().refine((val) => categories.has(val), { message: "Invalid category selected." }),
  latitude: z.number({ required_error: "Latitude is required." }),
  longitude: z.number({ required_error: "Longitude is required." }),
  city: z.string().min(2, { message: "City name must be at least 2 characters." }).max(50).trim(),
  locality: z.string().min(2, { message: "Locality must be at least 2 characters." }).max(100).trim(),
  priceRange: z.string().max(10).trim().optional().nullable(),
  hours: z.string().max(50).trim().optional().nullable(),
  phone: z.string().max(20).trim().optional().nullable(),
  website: z.string().max(200).trim().optional().nullable(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createApiHandler(
  { auth: "required" },
  async (request: NextRequest, { pool, user }) => {
    const body = await request.json();
    const parseResult = suggestBodySchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestError("Validation failed.");
    }

    const {
      title, description, category, latitude, longitude,
      city, locality, priceRange, hours, phone, website,
    } = parseResult.data;

    const { rows } = await pool.query(
      `
      INSERT INTO place_suggestions (
        user_id, title, description, category, latitude, longitude,
        price_range, hours, phone, website, city, locality, location
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, ST_SetSRID(ST_MakePoint($6, $5), 4326))
      RETURNING id, title, status
      `,
      [
        user!.id, title, description, category, latitude, longitude,
        priceRange || null, hours || null, phone || null, website || null, city, locality,
      ]
    );

    // Fire XP + badge check in background
    void awardXP(pool, user!.id, "suggestion_submitted", 20).then(() =>
      checkAndGrantBadges(pool, user!.id)
    );

    return Response.json(
      { suggestion: rows[0], message: "Suggestion submitted successfully." },
      { status: 201 }
    );
  }
);
