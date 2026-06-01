import { NextRequest } from "next/server";
import { getPool } from "@/lib/postgres";
import { ensureAuthSetup, requireCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// List all folders for the current user with their place IDs
export async function GET(request: NextRequest) {
  const pool = getPool();
  if (!pool) {
    return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  await ensureAuthSetup(pool);
  const auth = await requireCurrentUser(pool, request);
  if (!auth.user) return auth.response;

  // Get folders
  const { rows: folderRows } = await pool.query(
    `
    SELECT id, name FROM saved_place_folders WHERE user_id = $1 ORDER BY created_at DESC
    `,
    [auth.user.id]
  );

  // For each folder, fetch its place ids
  const folders = await Promise.all(
    folderRows.map(async (f) => {
      const { rows } = await pool.query(
        `
        SELECT place_id AS "placeId" FROM saved_place_folder_items WHERE folder_id = $1
        `,
        [f.id]
      );
      return { id: f.id, name: f.name, placeIds: rows.map((r) => r.placeId) };
    })
  );

  return Response.json({ folders });
}

// Create a new folder
export async function POST(request: NextRequest) {
  const pool = getPool();
  if (!pool) {
    return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  await ensureAuthSetup(pool);
  const auth = await requireCurrentUser(pool, request);
  if (!auth.user) return auth.response;

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
    [auth.user.id, name]
  );

  const newFolder = rows[0];
  return Response.json({ folder: { id: newFolder.id, name: newFolder.name, placeIds: [] } }, { status: 201 });
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return Response.json({ error: "id query param is required" }, { status: 400 });
    }

    await pool.query(
      "DELETE FROM saved_place_folders WHERE id = $1 AND user_id = $2",
      [id, auth.user.id]
    );

    return Response.json({ success: true, message: "Folder deleted successfully." }, { status: 200 });
  } catch (e: any) {
    console.error("Error in DELETE /api/saved-places/folders:", e);
    return Response.json({ error: "Internal server error", details: e.message }, { status: 500 });
  }
}
