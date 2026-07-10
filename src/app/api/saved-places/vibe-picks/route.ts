import { NextRequest } from "next/server";
import { createApiHandler } from "@/lib/server/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/saved-places/vibe-picks
 *
 * Right-swipe handler for Swipe & Vibe Mode.
 * Atomically:
 *   1. Creates (or finds) a folder named "⚡ Vibe Picks" for the user
 *   2. Inserts the place into that folder's items
 *   3. Does NOT touch the main saved_places table
 *
 * Body: { placeId: string }
 *
 * DELETE /api/saved-places/vibe-picks?placeId=X
 *   Removes the place from the Vibe Picks folder only.
 */

const VIBE_PICKS_FOLDER_NAME = "⚡ Vibe Picks";

async function getOrCreateVibeFolder(pool: any, userId: string): Promise<string> {
  // Try to find existing folder
  const { rows } = await pool.query(
    `SELECT id FROM saved_place_folders WHERE user_id = $1 AND name = $2 LIMIT 1`,
    [userId, VIBE_PICKS_FOLDER_NAME]
  );

  if (rows[0]) return rows[0].id as string;

  // Create it if it doesn't exist
  const insert = await pool.query(
    `INSERT INTO saved_place_folders (user_id, name) VALUES ($1, $2) RETURNING id`,
    [userId, VIBE_PICKS_FOLDER_NAME]
  );

  return insert.rows[0].id as string;
}

export const POST = createApiHandler({ auth: "required" }, async (request: NextRequest, { pool, user }) => {
  const body = await request.json();
  const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";

  if (!placeId) {
    return Response.json({ error: "placeId is required." }, { status: 400 });
  }

  const folderId = await getOrCreateVibeFolder(pool, user!.id);

  await pool.query(
    `INSERT INTO saved_place_folder_items (folder_id, place_id)
     VALUES ($1, $2)
     ON CONFLICT (folder_id, place_id) DO NOTHING`,
    [folderId, placeId]
  );

  return Response.json({ placeId, folderId, vibeFolder: VIBE_PICKS_FOLDER_NAME, saved: true }, { status: 201 });
});

export const DELETE = createApiHandler({ auth: "required" }, async (request: NextRequest, { pool, user }) => {
  const placeId = request.nextUrl.searchParams.get("placeId")?.trim() ?? "";

  if (!placeId) {
    return Response.json({ error: "placeId is required." }, { status: 400 });
  }

  const folderId = await getOrCreateVibeFolder(pool, user!.id);

  await pool.query(
    `DELETE FROM saved_place_folder_items WHERE folder_id = $1 AND place_id = $2`,
    [folderId, placeId]
  );

  return Response.json({ placeId, folderId, saved: false });
});

export const GET = createApiHandler({ auth: "required" }, async (_request: NextRequest, { pool, user }) => {
  // Returns the place IDs currently in the Vibe Picks folder
  const { rows: folderRows } = await pool.query(
    `SELECT id FROM saved_place_folders WHERE user_id = $1 AND name = $2 LIMIT 1`,
    [user!.id, VIBE_PICKS_FOLDER_NAME]
  );

  if (!folderRows[0]) {
    return Response.json({ placeIds: [], folderId: null });
  }

  const folderId = folderRows[0].id as string;
  const { rows } = await pool.query(
    `SELECT place_id AS "placeId" FROM saved_place_folder_items WHERE folder_id = $1 ORDER BY created_at DESC`,
    [folderId]
  );

  return Response.json({ placeIds: rows.map((r: any) => r.placeId), folderId });
});
