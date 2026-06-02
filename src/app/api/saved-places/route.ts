import { NextRequest } from "next/server";
import { createApiHandler } from "@/lib/server/api-handler";
import { z } from "zod";
import { awardXP, checkAndGrantBadges } from "@/lib/gamification";
import { BadRequestError } from "@/lib/server/api-errors";

const postBodySchema = z.object({
  placeId: z.string().min(1, { message: "placeId cannot be empty" }).max(200).trim(),
  folderId: z.string().uuid().trim().optional().nullable(),
  category: z.string().max(50).optional(),
  tag: z.string().max(50).optional(),
});

const deleteQuerySchema = z.object({
  placeId: z.string().min(1, { message: "placeId query param required" }).max(200).trim(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createApiHandler(
  { auth: "required" },
  async (request: NextRequest, { pool, user }) => {
    const { rows } = await pool.query(
      `
      SELECT place_id AS "placeId"
      FROM saved_places
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [user!.id]
    );
    return Response.json(
      { placeIds: rows.map((row) => row.placeId) },
      { status: 200, headers: { "Cache-Control": "public, max-age=60" } }
    );
  }
);

export const POST = createApiHandler(
  { auth: "required", rateLimitKey: "POST:/api/saved-places" },
  async (request: NextRequest, { pool, user }) => {
    const body = await request.json();
    const parseResult = postBodySchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestError("Invalid request body");
    }
    const { placeId, folderId, category, tag } = parseResult.data;

    if (folderId) {
      // Ensure the spot is saved overall in saved_places
      await pool.query(
        `INSERT INTO saved_places (user_id, place_id) VALUES ($1, $2) ON CONFLICT (user_id, place_id) DO NOTHING`,
        [user!.id, placeId]
      );

      // Insert into custom folder items
      await pool.query(
        `INSERT INTO saved_place_folder_items (folder_id, place_id) VALUES ($1, $2) ON CONFLICT (folder_id, place_id) DO NOTHING`,
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
        [user!.id, placeId]
      );
      // Award XP only for genuinely new saves
      if (insertResult.rowCount && insertResult.rowCount > 0) {
        const eventType = category ? `save_${category}` : "save_place";
        void awardXP(pool, user!.id, eventType, 0).then(() =>
          checkAndGrantBadges(pool, user!.id, { savedPlaceCategory: category, savedPlaceTag: tag })
        );
      }
      return Response.json({ placeId, saved: true }, { status: 201 });
    }
  }
);

export const DELETE = createApiHandler(
  { auth: "required", rateLimitKey: "DELETE:/api/saved-places" },
  async (request: NextRequest, { pool, user }) => {
    const queryParams = { placeId: request.nextUrl.searchParams.get("placeId") ?? "" };
    const parseQuery = deleteQuerySchema.safeParse(queryParams);
    if (!parseQuery.success) {
      throw new BadRequestError("Invalid query parameters");
    }
    const { placeId } = parseQuery.data;
    const folderId = request.nextUrl.searchParams.get("folderId");

    if (folderId) {
      await pool.query(
        "DELETE FROM saved_place_folder_items WHERE folder_id = $1 AND place_id = $2",
        [folderId, placeId]
      );
    } else {
      await pool.query("DELETE FROM saved_places WHERE user_id = $1 AND place_id = $2", [user!.id, placeId]);
    }
    return Response.json({ placeId, folderId, saved: false });
  }
);
