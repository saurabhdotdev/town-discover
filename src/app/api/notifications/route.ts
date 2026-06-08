import { NextRequest } from "next/server";
import { getPool } from "@/lib/postgres";
import { ensureAuthSetup, requireCurrentUser } from "@/lib/auth";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  id: z.string().uuid().optional(),
  all: z.boolean().optional(),
});

const createSchema = z.object({
  type: z.string().trim().min(2).max(60).default("event_reminder"),
  title: z.string().trim().min(2).max(120),
  message: z.string().trim().min(2).max(320),
  link: z.string().trim().max(500).optional(),
});

const isDatabaseConnectionError = (error: unknown) => {
  if (error instanceof AggregateError) return true;
  if (!(error instanceof Error)) return false;

  return ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET"].some((code) =>
    error.message.includes(code)
  );
};

// GET /api/notifications - Get current user notifications
export async function GET(request: NextRequest) {
  try {
    const pool = getPool();
    if (!pool) {
      return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
    }
    await ensureAuthSetup(pool);
    const auth = await requireCurrentUser(pool, request);
    if (!auth.user) return auth.response;

    const { rows: notifications } = await pool.query(
      `
      SELECT
        id,
        type,
        title,
        message,
        link,
        is_read AS "isRead",
        created_at AS "createdAt"
      FROM user_notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [auth.user.id]
    );

    return Response.json({ notifications }, { status: 200 });
  } catch (e: any) {
    console.error("Error in GET /api/notifications:", e);
    if (isDatabaseConnectionError(e)) {
      return Response.json(
        {
          notifications: [],
          warning: "Notifications are temporarily unavailable.",
        },
        { status: 200 }
      );
    }

    return Response.json({ error: "Internal server error", details: e.message }, { status: 500 });
  }
}

// POST /api/notifications - Create a notification for the current user
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
    const parseResult = createSchema.safeParse(body);
    if (!parseResult.success) {
      return Response.json({ error: "Invalid request data", details: parseResult.error.format() }, { status: 400 });
    }

    const { type, title, message, link } = parseResult.data;
    const { rows } = await pool.query(
      `
      INSERT INTO user_notifications (user_id, type, title, message, link)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        type,
        title,
        message,
        link,
        is_read AS "isRead",
        created_at AS "createdAt"
      `,
      [auth.user.id, type, title, message, link || null]
    );

    return Response.json({ notification: rows[0] }, { status: 201 });
  } catch (e: any) {
    console.error("Error in POST /api/notifications:", e);
    return Response.json({ error: "Internal server error", details: e.message }, { status: 500 });
  }
}

// PATCH /api/notifications - Mark a notification or all notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const pool = getPool();
    if (!pool) {
      return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
    }
    await ensureAuthSetup(pool);
    const auth = await requireCurrentUser(pool, request);
    if (!auth.user) return auth.response;

    const body = await request.json();
    const parseResult = patchSchema.safeParse(body);
    if (!parseResult.success) {
      return Response.json({ error: "Invalid request data", details: parseResult.error.format() }, { status: 400 });
    }

    const { id, all } = parseResult.data;

    if (all) {
      await pool.query(
        `UPDATE user_notifications SET is_read = TRUE WHERE user_id = $1`,
        [auth.user.id]
      );
      return Response.json({ success: true, message: "All notifications marked as read." }, { status: 200 });
    }

    if (id) {
      const { rowCount } = await pool.query(
        `UPDATE user_notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
        [id, auth.user.id]
      );
      if (rowCount === 0) {
        return Response.json({ error: "Notification not found or access denied." }, { status: 404 });
      }
      return Response.json({ success: true, message: "Notification marked as read." }, { status: 200 });
    }

    return Response.json({ error: "Either 'id' or 'all' must be provided." }, { status: 400 });
  } catch (e: any) {
    console.error("Error in PATCH /api/notifications:", e);
    return Response.json({ error: "Internal server error", details: e.message }, { status: 500 });
  }
}

// DELETE /api/notifications - Delete a notification
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
      return Response.json({ error: "id query param is required." }, { status: 400 });
    }

    const { rowCount } = await pool.query(
      `DELETE FROM user_notifications WHERE id = $1 AND user_id = $2`,
      [id, auth.user.id]
    );

    if (rowCount === 0) {
      return Response.json({ error: "Notification not found or access denied." }, { status: 404 });
    }

    return Response.json({ success: true, message: "Notification deleted successfully." }, { status: 200 });
  } catch (e: any) {
    console.error("Error in DELETE /api/notifications:", e);
    return Response.json({ error: "Internal server error", details: e.message }, { status: 500 });
  }
}
