import { NextRequest } from "next/server";
import { createApiHandler } from "@/lib/server/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// List all folders for the current user with their place IDs
export const GET = createApiHandler({ auth: "required" }, async (request, { pool, user }) => {
  const { rows: folders } = await pool.query(
    `
    SELECT 
      f.id, 
      f.name, 
      COALESCE(
        (
          SELECT array_agg(fi.place_id) 
          FROM saved_place_folder_items fi 
          WHERE fi.folder_id = f.id
        ), 
        ARRAY[]::VARCHAR[]
      ) AS "placeIds"
    FROM saved_place_folders f
    WHERE f.user_id = $1
    ORDER BY f.created_at DESC
    `,
    [user!.id]
  );

  return Response.json({ folders });
});

// Create a new folder
export const POST = createApiHandler({ auth: "required" }, async (request, { pool, user }) => {
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return Response.json({ error: "Folder name is required." }, { status: 400 });
  }

  const { rows } = await pool.query(
    `
    INSERT INTO saved_place_folders (user_id, name)
    VALUES ($1, $2)
    RETURNING id, name
    `,
    [user!.id, name]
  );

  const newFolder = rows[0];
  return Response.json({ folder: { id: newFolder.id, name: newFolder.name, placeIds: [] } }, { status: 201 });
});

// Delete a folder
export const DELETE = createApiHandler({ auth: "required" }, async (request, { pool, user }) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id query param is required" }, { status: 400 });
  }

  await pool.query(
    "DELETE FROM saved_place_folders WHERE id = $1 AND user_id = $2",
    [id, user!.id]
  );

  return Response.json({ success: true, message: "Folder deleted successfully." }, { status: 200 });
});

