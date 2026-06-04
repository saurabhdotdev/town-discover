import { NextRequest } from "next/server";
import { getPool } from "@/lib/postgres";
import { ensureAuthSetup, requireCurrentUser } from "@/lib/auth";
import { z } from "zod/v3";
import { awardXP, checkAndGrantBadges } from "@/lib/gamification";

const patchBodySchema = z.object({
  id: z.string().uuid({ message: "Invalid suggestion ID." }),
  status: z.enum(["approved", "rejected"], {
    errorMap: () => ({ message: "Status must be 'approved' or 'rejected'." }),
  }),
});

const categoryImages: Record<string, string> = {
  cafe: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&h=420&fit=crop",
  restaurant: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=420&fit=crop",
  event: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=600&h=420&fit=crop",
  nightlife: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&h=420&fit=crop",
  "food-stall": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=420&fit=crop",
  bar: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600&h=420&fit=crop",
  dessert: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&h=420&fit=crop",
  "street-food": "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&h=420&fit=crop",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const pool = getPool();
    if (!pool) return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });

    await ensureAuthSetup(pool);
    const auth = await requireCurrentUser(pool, request);
    if (!auth.user) return auth.response;

    if (auth.user.role !== "super_admin") {
      return Response.json({ error: "Only admins can view suggestions." }, { status: 403 });
    }

    const { rows } = await pool.query(
      `
      SELECT
        ps.id,
        ps.title,
        ps.description,
        ps.category,
        ps.latitude,
        ps.longitude,
        ps.price_range AS "priceRange",
        ps.hours,
        ps.phone,
        ps.website,
        ps.city,
        ps.locality,
        ps.status,
        ps.created_at AS "createdAt",
        u.email AS "userEmail",
        u.full_name AS "userFullName"
      FROM place_suggestions ps
      LEFT JOIN users u ON u.id = ps.user_id
      WHERE ps.status = 'pending'
      ORDER BY ps.created_at DESC
      `
    );

    return Response.json({ suggestions: rows });
  } catch (e: any) {
    console.error("Error fetching suggestions:", e);
    return Response.json({ error: "Internal server error", details: e.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const pool = getPool();
    if (!pool) return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });

    await ensureAuthSetup(pool);
    const auth = await requireCurrentUser(pool, request);
    if (!auth.user) return auth.response;

    if (auth.user.role !== "super_admin") {
      return Response.json({ error: "Only admins can moderate suggestions." }, { status: 403 });
    }

    const body = await request.json();
    const parseResult = patchBodySchema.safeParse(body);
    if (!parseResult.success) {
      return Response.json({ error: "Validation failed.", details: parseResult.error.format() }, { status: 400 });
    }

    const { id, status } = parseResult.data;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const updateRes = await client.query(
        `
        UPDATE place_suggestions
        SET status = $1
        WHERE id = $2
        RETURNING *
        `,
        [status, id]
      );

      const suggestion = updateRes.rows[0];
      if (!suggestion) {
        await client.query("ROLLBACK");
        return Response.json({ error: "Suggestion not found." }, { status: 404 });
      }

      if (status === "approved") {
        const placeId = `suggested-${suggestion.id}`;
        const image = categoryImages[suggestion.category] || categoryImages.restaurant;
        const tags = ["suggested", suggestion.category, "community-added"];
        
        let parsedHours = null;
        if (suggestion.hours) {
          const match = suggestion.hours.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
          if (match) {
            parsedHours = {
              open: `${match[1].padStart(2, "0")}:${match[2]}`,
              close: `${match[3].padStart(2, "0")}:${match[4]}`
            };
          }
        }

        await client.query(
          `
          INSERT INTO approved_places (
            id,
            title,
            description,
            category,
            image,
            rating,
            latitude,
            longitude,
            tags,
            city,
            locality,
            price_range,
            phone,
            website,
            hours
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (id) DO UPDATE
          SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            category = EXCLUDED.category,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            city = EXCLUDED.city,
            locality = EXCLUDED.locality
          `,
          [
            placeId,
            suggestion.title,
            suggestion.description,
            suggestion.category,
            image,
            4.5,
            suggestion.latitude,
            suggestion.longitude,
            tags,
            suggestion.city,
            suggestion.locality,
            suggestion.price_range || "$$",
            suggestion.phone,
            suggestion.website,
            parsedHours ? JSON.stringify(parsedHours) : null,
          ]
        );
      }

      await client.query("COMMIT");

      // Award XP to the original suggester on approval (fire-and-forget)
      if (status === "approved" && suggestion.user_id) {
        void awardXP(pool, suggestion.user_id, "suggestion_approved", 50).then(() =>
          checkAndGrantBadges(pool, suggestion.user_id)
        );
      }

      return Response.json({ message: `Suggestion successfully ${status}.`, id, status });
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (e: any) {
    console.error("Error moderating suggestion:", e);
    return Response.json({ error: "Internal server error", details: e.message }, { status: 500 });
  }
}
