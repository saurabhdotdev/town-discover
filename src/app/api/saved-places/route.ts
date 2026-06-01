import { NextRequest } from "next/server";
import { getPool } from "@/lib/postgres";
import { ensureAuthSetup, requireCurrentUser } from "@/lib/auth";
import { z } from "zod";
import { awardXP, checkAndGrantBadges } from "@/lib/gamification";

// Validation schemas
const postBodySchema = z.object({
  placeId: z.string().min(1, { message: "placeId cannot be empty" }).trim(),
  folderId: z.string().trim().optional().nullable(),
});

const deleteQuerySchema = z.object({
  placeId: z.string().min(1, { message: "placeId query param required" }).trim(),
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
    const auth = await requireCurrentUser(pool, request);
    if (!auth.user) return auth.response;

    const { rows } = await pool.query(
      `
      SELECT place_id AS "placeId"
      FROM saved_places
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [auth.user.id]
    );
    return Response.json({ placeIds: rows.map((row) => row.placeId) }, { status: 200, headers: { "Cache-Control": "public, max-age=60" } });
  } catch (e:any) {
    console.error(e);
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
    const parseResult = postBodySchema.safeParse(body);
    if (!parseResult.success) {
      const errors = parseResult.error.format();
      return Response.json({ error: "Invalid request body", details: errors }, { status: 400 });
    }
    const { placeId, folderId } = parseResult.data;

    if (folderId) {
      // Ensure the spot is saved overall in saved_places
      await pool.query(
        `
        INSERT INTO saved_places (user_id, place_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, place_id) DO NOTHING
        `,
        [auth.user.id, placeId]
      );

      // Insert into custom folder items
      await pool.query(
        `
        INSERT INTO saved_place_folder_items (folder_id, place_id)
        VALUES ($1, $2)
        ON CONFLICT (folder_id, place_id) DO NOTHING
        `,
        [folderId, placeId]
      );
      return Response.json({ placeId, folderId, saved: true }, { status: 201 });
    } else {
      const insertResult = await pool.query(
        `
        INSERT INTO saved_places (user_id, place_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, place_id) DO NOTHING
        RETURNING place_id
        `,
        [auth.user.id, placeId]
      );
      // Award XP only for genuinely new saves
      if (insertResult.rowCount && insertResult.rowCount > 0) {
        const category = body?.category as string | undefined;
        const tag = body?.tag as string | undefined;
        const eventType = category ? `save_${category}` : "save_place";
        void awardXP(pool, auth.user.id, eventType, 0).then(() =>
          checkAndGrantBadges(pool, auth.user.id, { savedPlaceCategory: category, savedPlaceTag: tag })
        );
      }
      return Response.json({ placeId, saved: true }, { status: 201 });
    }
  } catch (e:any) {
    console.error(e);
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

    const queryParams = { placeId: request.nextUrl.searchParams.get("placeId") ?? "" };
    const parseQuery = deleteQuerySchema.safeParse(queryParams);
    if (!parseQuery.success) {
      const errors = parseQuery.error.format();
      return Response.json({ error: "Invalid query parameters", details: errors }, { status: 400 });
    }
    const { placeId } = parseQuery.data;
    const folderId = request.nextUrl.searchParams.get("folderId");

    if (folderId) {
      await pool.query(
        "DELETE FROM saved_place_folder_items WHERE folder_id = $1 AND place_id = $2",
        [folderId, placeId]
      );
    } else {
      await pool.query("DELETE FROM saved_places WHERE user_id = $1 AND place_id = $2", [auth.user.id, placeId]);
    }
    return Response.json({ placeId, folderId, saved: false });
  } catch (e:any) {
    console.error(e);
    return Response.json({ error: "Internal server error", details: e.message }, { status: 500 });
  }
}
